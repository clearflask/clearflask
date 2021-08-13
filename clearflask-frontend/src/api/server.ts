// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
import { CSSProperties } from '@material-ui/styles';
import { applyMiddleware, combineReducers, compose, createStore, Store } from 'redux';
import reduxPromiseMiddleware from 'redux-promise-middleware';
import thunk from 'redux-thunk';
import * as ConfigEditor from '../common/config/configEditor';
import debounce from '../common/util/debounce';
import { detectEnv, Environment, isProd } from '../common/util/detectEnv';
import { htmlDataRetrieve } from '../common/util/htmlData';
import randomUuid from '../common/util/uuid';
import windowIso, { StoresState, StoresStateSerializable } from '../common/windowIso';
import * as Admin from './admin';
import * as Client from './client';
import ServerAdmin from './serverAdmin';
import ServerMock from './serverMock';

export type Unsubscribe = () => void;
export type ErrorSubscriber = ((errorMsg: string, isUserFacing: boolean) => void);
export type ErrorSubscribers = { [subscriberId: string]: ErrorSubscriber };
export const errorSubscribers: ErrorSubscribers = {}
export type ChallengeSubscriber = ((challenge: string) => Promise<string | undefined>);
export type ChallengeSubscribers = { [subscriberId: string]: ChallengeSubscriber };
export const challengeSubscribers: ChallengeSubscribers = {}
export interface DispatchProps {
  ssr?: boolean;
  ssrStatusPassthrough?: boolean;
}
export const ignoreSearchKeys = 'ignoreSearchKeys';

export enum Status {
  PENDING = 'PENDING',
  FULFILLED = 'FULFILLED',
  REJECTED = 'REJECTED',
}

type AllActions = Admin.Actions | Client.Actions
  | updateSettingsAction
  | ideaSearchResultRemoveIdeaAction | ideaSearchResultAddIdeaAction
  | draftSearchResultAddDraftAction;

export class Server {
  static storesState: StoresState | undefined;

  readonly store: Store<ReduxState, AllActions>;
  readonly dispatcherClient: Client.Dispatcher;
  readonly dispatcherAdmin: Admin.Dispatcher;

  // NOTE: If creating multiple projects, only one project can have projectId undefined
  // and is conside
  constructor(projectId?: string, settings?: StateSettings, apiOverride?: Client.ApiInterface & Admin.ApiInterface) {
    var storeMiddleware = applyMiddleware(thunk, reduxPromiseMiddleware);
    if (!windowIso.isSsr) {
      const composeEnhancers =
        windowIso['__REDUX_DEVTOOLS_EXTENSION_COMPOSE__']
          ? windowIso['__REDUX_DEVTOOLS_EXTENSION_COMPOSE__']({
            serialize: true,
            name: projectId,
          })
          : compose;
      storeMiddleware = composeEnhancers(storeMiddleware);
    }

    const projectStoreId = projectId || windowIso.location.hostname;
    if (windowIso.isSsr) {
      windowIso.storesState.serverStores = windowIso.storesState.serverStores || {};
      windowIso.storesState.serverStores[projectStoreId] = windowIso.storesState.serverStores[projectStoreId]
        || createStore(reducers, Server.initialState(projectId, settings), storeMiddleware);
      this.store = windowIso.storesState.serverStores[projectStoreId];
    } else {
      const preloadedState = (htmlDataRetrieve('__SSR_STORE_INITIAL_STATE__') as StoresStateSerializable | undefined)?.serverStores?.[projectStoreId]
        || Server.initialState(projectId, settings);
      this.store = createStore(reducers, preloadedState, storeMiddleware);
    }

    const apiConf: Client.ConfigurationParameters = {
      fetchApi: windowIso.fetch.bind(windowIso),
      basePath: Server.augmentApiBasePath(Client.BASE_PATH),
    };
    if (detectEnv() === Environment.DEVELOPMENT_FRONTEND) {
      apiOverride = ServerMock.get();
    }
    this.dispatcherClient = new Client.Dispatcher(
      msg => Server._dispatch(msg, this.store),
      new Client.Api(new Client.Configuration(apiConf), apiOverride));
    const adminStore = ServerAdmin.get().getStore();
    this.dispatcherAdmin = new Admin.Dispatcher(
      msg => Server._dispatch(msg, this.store, adminStore),
      new Admin.Api(new Admin.Configuration(apiConf), apiOverride));
  }

  static async _dispatch(msg: any, store: Store<any, any>, storeAdmin?: Store<any, any>): Promise<any> {
    try {
      var result = await store.dispatch(msg);
      if (storeAdmin) await storeAdmin.dispatch(msg);
    } catch (response) {
      if (!isProd()) {
        console.log("Dispatch error: ", msg, response);
        console.trace();
      }
      try {
        if (response && response.status === 429 && response.headers && response.headers.has && response.headers.has('x-cf-challenge')) {
          const challengeSubscriber = Object.values(challengeSubscribers)[0];
          if (!challengeSubscriber) {
            Object.values(errorSubscribers).forEach(subscriber => subscriber && subscriber("Failed to show captcha challenge", true));
            throw response;
          }
          var solution: string | undefined = await challengeSubscriber(response.headers.get('x-cf-challenge'));
          if (solution) {
            return msg.meta.retry({ 'x-cf-solution': solution });
          }
        }
        var errorMsg: string = '';
        var isUserFacing = false;
        if (response && response.json) {
          try {
            var body = await response.json();
            if (body && body.userFacingMessage) {
              errorMsg = body.userFacingMessage;
              isUserFacing = true;
            }
          } catch (err) {
          }
        }
        var action = msg && msg.meta && msg.meta.action || 'unknown action';
        if (errorMsg && isUserFacing) {
          // errorMsg already set above
        } else if (response.status && response.status === 403) {
          errorMsg = `Action not allowed, please refresh and try again`;
          isUserFacing = true;
        } else if (response.status && response.status === 501) {
          errorMsg = `This feature is not yet available`;
          isUserFacing = true;
        } else if (response.status && response.status >= 100 && response.status < 300) {
          errorMsg = `${response.status} failed ${action}`;
        } else if (response.status && response.status >= 300 && response.status < 600) {
          errorMsg = `${response.status} failed ${action}`;
          isUserFacing = true;
        } else {
          errorMsg = `Connection failure processing ${action}`;
          isUserFacing = true;
        }
        Object.values(errorSubscribers).forEach(subscriber => subscriber && subscriber(errorMsg, isUserFacing));
      } catch (err) {
        console.log("Error dispatching error: ", err);
        Object.values(errorSubscribers).forEach(subscriber => subscriber && subscriber("Unknown error occurred, please try again", true));
      }
      throw response;
    }
    return result.value;
  }

  static initialState(projectId?: string, settings?: StateSettings): any {
    const state: ReduxState = {
      projectId: projectId || stateProjectIdDefault,
      settings: settings || stateSettingsDefault,
      conf: stateConfDefault,
      drafts: stateDraftsDefault,
      ideas: stateIdeasDefault,
      comments: stateCommentsDefault,
      users: stateUsersDefault,
      votes: stateVotesDefault,
      commentVotes: stateCommentVotesDefault,
      credits: stateCreditsDefault,
      notifications: stateNotificationsDefault,
    };
    return state;
  }

  static augmentApiBasePath(basePath: string): string {
    switch (detectEnv()) {
      case Environment.DEVELOPMENT_FRONTEND:
        break;
      default:
        basePath = basePath.replace('https://clearflask.com', `${windowIso.location.protocol}//${windowIso.location.host}`);
        break;
    }
    return basePath;
  }

  getProjectId(): string {
    return this.store.getState().projectId!;
  }

  getStore(): Store<ReduxState, AllActions> {
    return this.store;
  }

  isModOrAdminLoggedIn(): boolean {
    if (ServerAdmin.get().isAdminLoggedIn()) return true;
    const state = this.store.getState();
    return state.users.loggedIn.status === Status.FULFILLED
      && !!state.users.loggedIn.user?.isMod;
  }

  dispatch(props: DispatchProps = {}): Promise<Client.Dispatcher> {
    return Server.__dispatch(props, this.dispatcherClient);
  }

  dispatchAdmin(props: DispatchProps = {}): Promise<Admin.Dispatcher> {
    return Server.__dispatch(props, this.dispatcherAdmin);
  }

  static __dispatch<D>(props: DispatchProps = {}, dispatcher: D): Promise<D> {
    if (!props.ssr && windowIso.isSsr) {
      return new Promise(() => { }); // Promise that never resolves
    }
    const dispatchPromise = Promise.resolve(dispatcher);
    if (props.ssr && windowIso.isSsr) {
      windowIso.awaitPromises.push(dispatchPromise);
      // Extend the 'then' method and add any API calls
      // to the list of promises to wait for in SSR
      dispatchPromise.then = (function (_super) {
        return function (this: any) {
          var apiPromise = _super.apply(this, arguments as any);
          if (props.ssrStatusPassthrough) {
            apiPromise = apiPromise.catch(err => {
              if (!windowIso.isSsr) return;
              if (isNaN(err?.status)) {
                windowIso.staticRouterContext.statusCode = 500;
              } else {
                windowIso.staticRouterContext.statusCode = err.status;
              }
            })
          }
          if (!!windowIso.isSsr) windowIso.awaitPromises.push(apiPromise);
          return apiPromise;
        };
      })(dispatchPromise.then) as any;
    }
    return dispatchPromise;
  }

  subscribeToChanges(editor: ConfigEditor.Editor, debounceWait: number | undefined = undefined) {
    if (debounceWait === undefined) {
      editor.subscribe(() => this.overrideConfig(editor.getConfig()));
    } else {
      const overrideConfigDebounced = debounce(this.overrideConfig.bind(this), debounceWait);
      editor.subscribe(() => overrideConfigDebounced(editor.getConfig()));
    }
  }

  static _subscribeToErrors(subscriber: ((errorMsg: string, isUserFacing: boolean) => void), subscriberId: string = randomUuid()): Unsubscribe | undefined {
    if (!!errorSubscribers[subscriberId]) return;
    errorSubscribers[subscriberId] = subscriber;
    return () => delete errorSubscribers[subscriberId];
  }

  static _subscribeChallenger(subscriber: ((challenge: string) => Promise<string | undefined>)): Unsubscribe {
    const subscriberId = randomUuid();
    challengeSubscribers[subscriberId] = subscriber;
    return () => delete challengeSubscribers[subscriberId];
  }

  overrideConfig(config: Admin.ConfigAdmin): void {
    const msg: Admin.configGetAdminActionFulfilled = {
      type: Admin.configGetAdminActionStatus.Fulfilled,
      meta: {
        action: Admin.Action.configGetAdmin,
        request: {
          projectId: this.getProjectId()
        },
      },
      payload: { config: config, version: randomUuid() },
    };
    Server._dispatch(msg, this.store);
  }
}

export const getSearchKey = (search?: object): string => {
  var searchKey = 'sk';
  if (search === undefined) return searchKey;
  const keys = Object.keys(search);
  // Consistently return the same key by sorting by keys
  keys.sort();
  keys.forEach(key => {
    var val = search[key];
    if (val instanceof Date) val = val + '';
    const isArray = Array.isArray(val);
    const isObject = typeof val === 'object';
    if (val === undefined
      || (isArray && !((val as Array<any>)?.length))
      || (isObject && !Object.keys(val)?.length)) {
      return;
    }

    searchKey += ';' + key + '=' + JSON.stringify(isObject ? getSearchKey(val) : val);
  });
  return searchKey;
}

const stateProjectIdDefault = null;
function reducerProjectId(projectId: string | null = stateProjectIdDefault, action: AllActions): string | null {
  switch (action.type) {
    case Admin.configGetAdminActionStatus.Fulfilled:
      return action.payload.config.projectId || projectId;
    case Client.configBindSlugActionStatus.Fulfilled:
    case Client.configAndUserBindSlugActionStatus.Fulfilled:
      return action.payload.config?.config.projectId || projectId;
    default:
      return projectId;
  }
}

export const cssBlurry: Record<string, string | CSSProperties> = {
  color: 'transparent',
  textShadow: '3px 0px 6px rgba(0,0,0,0.8)',
};
interface updateSettingsAction {
  type: 'updateSettings';
  payload: Partial<StateSettings>;
}
export interface StateSettings {
  suppressSetTitle?: boolean;
  demoUserIsInteracting?: boolean;
  demoPortalContainer?: React.RefObject<any>;
  demoFlashPostVotingControls?: boolean;
  demoFundingControlAnimate?: Array<{
    index: number;
    fundDiff: number;
  }>,
  demoFundingAnimate?: number,
  demoVotingExpressionsAnimate?: Array<{
    type: 'vote';
    upvote: boolean;
  } | {
    type: 'express';
    update: Client.IdeaVoteUpdateExpressions;
  }>,
  demoBlurryShadow?: boolean;
  demoCreateAnimate?: {
    title: string;
    description?: string;
    similarSearchTerm?: string;
  };
  demoSearchAnimate?: Array<{
    term: string;
    update: Partial<Client.IdeaSearch>;
  }>;
  demoMenuAnimate?: Array<{
    path: string;
  }>;
  demoDisableExplorerExpanded?: boolean;
  demoScrollY?: boolean;
  demoDisablePostOpen?: boolean;
};
const stateSettingsDefault = {};
function reducerSettings(state: StateSettings = stateSettingsDefault, action: AllActions): StateSettings {
  switch (action.type) {
    case 'updateSettings':
      return {
        ...state,
        ...action.payload,
      };
    default:
      return state;
  }
}

export interface StateConf {
  status?: Status;
  conf?: Client.Config;
  onboardBefore?: Client.Onboarding;
  ver?: string;
  rejectionMessage?: string;
}
const stateConfDefault = {};
function reducerConf(state: StateConf = stateConfDefault, action: AllActions): StateConf {
  switch (action.type) {
    case Client.configBindSlugActionStatus.Pending:
    case Client.configAndUserBindSlugActionStatus.Pending:
      return {
        status: Status.PENDING,
        rejectionMessage: undefined,
      };
    case Admin.projectCreateAdminActionStatus.Fulfilled:
    case Admin.configGetAdminActionStatus.Fulfilled:
      const versionedConfigAdmin = action.type === Admin.projectCreateAdminActionStatus.Fulfilled
        ? action.payload.config
        : action.payload;
      return {
        status: Status.FULFILLED,
        rejectionMessage: undefined,
        conf: versionedConfigAdmin.config,
        ver: versionedConfigAdmin.version,
      };
    case Client.configBindSlugActionStatus.Fulfilled:
    case Client.configAndUserBindSlugActionStatus.Fulfilled:
      return {
        status: Status.FULFILLED,
        rejectionMessage: undefined,
        conf: action.payload.config?.config,
        onboardBefore: action.payload.onboardBefore,
        ver: action.payload.config?.version,
      };
    case Client.configBindSlugActionStatus.Rejected:
    case Client.configAndUserBindSlugActionStatus.Rejected:
      return {
        status: Status.REJECTED,
        rejectionMessage: action.payload.userFacingMessage,
      };
    default:
      return state;
  }
}

interface ideaSearchResultRemoveIdeaAction {
  type: 'ideaSearchResultRemoveIdea';
  payload: {
    searchKey: string;
    ideaId: string;
  };
}
interface ideaSearchResultAddIdeaAction {
  type: 'ideaSearchResultAddIdea';
  payload: {
    searchKey: string;
    ideaId: string;
    index: number;
  };
}
export interface StateIdeas {
  byId: {
    [ideaId: string]: {
      status: Status;
      idea?: Client.Idea;
    }
  };
  // TODO eventually we should invalidate these searches over time
  bySearch: {
    [searchKey: string]: {
      status: Status,
      ideaIds?: string[],
      cursor?: string,
      filterStatusIds?: string[],
    }
  };
  maxFundAmountSeen: number;
}
const stateIdeasDefault = {
  byId: {},
  bySearch: {},
  maxFundAmountSeen: 0,
};
function reducerIdeas(state: StateIdeas = stateIdeasDefault, action: AllActions): StateIdeas {
  var searchKey;
  switch (action.type) {
    case Client.ideaGetActionStatus.Pending:
      return {
        ...state,
        byId: {
          ...state.byId,
          [action.meta.request.ideaId]: { status: Status.PENDING },
        }
      };
    case Client.ideaGetActionStatus.Rejected:
      return {
        ...state,
        byId: {
          ...state.byId,
          [action.meta.request.ideaId]: { status: Status.REJECTED },
        }
      };
    case Client.ideaGetActionStatus.Fulfilled:
      return {
        ...state,
        byId: {
          ...state.byId,
          [action.payload.ideaId]: {
            idea: action.payload,
            status: Status.FULFILLED,
          },
        },
        maxFundAmountSeen: Math.max(action.payload.funded || 0, state.maxFundAmountSeen),
      };
    case Admin.ideaCreateAdminActionStatus.Fulfilled:
    case Client.ideaCreateActionStatus.Fulfilled:
      var bySearchFilteredForCreate = new Set<string>();
      const createdIdeaStatus = action.payload.statusId;
      Object.entries(state.bySearch).forEach(([searchKey, search]) => {
        if (action.meta[ignoreSearchKeys]?.has?.(searchKey)) return;
        if ((createdIdeaStatus === undefined && !search.filterStatusIds?.length)
          || (createdIdeaStatus !== undefined && search.filterStatusIds?.includes(createdIdeaStatus))) {
          bySearchFilteredForCreate.add(searchKey);
        }
      });
      return {
        ...state,
        byId: {
          ...state.byId,
          [action.payload.ideaId]: {
            idea: action.payload,
            status: Status.FULFILLED,
          },
        },
        bySearch: !bySearchFilteredForCreate.size ? state.bySearch : Object.keys(state.bySearch)
          .filter(key => !bySearchFilteredForCreate.has(key))
          .reduce((obj, key) => ({ ...obj, [key]: state.bySearch[key] }), {}),
        maxFundAmountSeen: Math.max(action.payload.funded || 0, state.maxFundAmountSeen),
      };
    case Client.ideaDeleteActionStatus.Fulfilled:
    case Admin.ideaDeleteAdminActionStatus.Fulfilled:
      const { [action.meta.request.ideaId]: removedIdea, ...byIdWithoutDeleted } = state.byId;
      var bySearchFilteredForDelete = {};
      Object.entries(state.bySearch).forEach(([searchKey, search]) => {
        if (action.meta[ignoreSearchKeys]?.has?.(searchKey)) return;
        if (search.ideaIds?.includes(action.meta.request.ideaId)) {
          bySearchFilteredForDelete[searchKey] = {
            ...search,
            ideaIds: search.ideaIds.filter(ideaId => ideaId !== action.meta.request.ideaId),
          };
        }
      });
      return {
        ...state,
        byId: byIdWithoutDeleted,
        bySearch: Object.keys(bySearchFilteredForDelete).length > 0 ? {
          ...state.bySearch,
          ...bySearchFilteredForDelete,
        } : state.bySearch,
      };
    case Admin.ideaUpdateAdminActionStatus.Fulfilled:
    case Client.ideaUpdateActionStatus.Fulfilled:
      var bySearchFilteredForUpdate = new Set<string>();
      const updatedIdeaStatus = state.byId[action.meta.request.ideaId]?.idea?.statusId;
      const updatedToIdeaStatus = action.type === Admin.ideaUpdateAdminActionStatus.Fulfilled
        ? action.meta.request.ideaUpdateAdmin.statusId : undefined;
      Object.entries(state.bySearch).forEach(([searchKey, search]) => {
        if (action.meta[ignoreSearchKeys]?.has?.(searchKey)) return;
        if ((updatedIdeaStatus === undefined && !search.filterStatusIds?.length)
          || (updatedIdeaStatus !== undefined && search.filterStatusIds?.includes(updatedIdeaStatus))) {
          bySearchFilteredForUpdate.add(searchKey);
        }
        if (updatedToIdeaStatus !== undefined && updatedToIdeaStatus !== updatedIdeaStatus
          && ((updatedToIdeaStatus === undefined && !search.filterStatusIds?.length)
            || (updatedToIdeaStatus !== undefined && search.filterStatusIds?.includes(updatedToIdeaStatus)))) {
          bySearchFilteredForUpdate.add(searchKey);
        }
      });
      return {
        ...state,
        byId: {
          ...state.byId,
          [action.payload.ideaId]: {
            idea: action.payload,
            status: Status.FULFILLED,
          },
        },
        bySearch: !bySearchFilteredForUpdate.size ? state.bySearch : Object.keys(state.bySearch)
          .filter(key => !bySearchFilteredForUpdate.has(key))
          .reduce((obj, key) => ({ ...obj, [key]: state.bySearch[key] }), {}),
        maxFundAmountSeen: Math.max(action.payload.funded || 0, state.maxFundAmountSeen),
      };
    case Client.ideaMergeActionStatus.Fulfilled:
    case Admin.ideaMergeAdminActionStatus.Fulfilled:
    case Admin.ideaUnMergeAdminActionStatus.Fulfilled:
    case Admin.ideaLinkAdminActionStatus.Fulfilled:
    case Admin.ideaUnLinkAdminActionStatus.Fulfilled:
      return {
        ...state,
        byId: {
          ...state.byId,
          [action.payload.idea.ideaId]: {
            idea: action.payload.idea,
            status: Status.FULFILLED,
          },
          [action.payload.parentIdea.ideaId]: {
            idea: action.payload.parentIdea,
            status: Status.FULFILLED,
          },
        },
        maxFundAmountSeen: Math.max(
          action.payload.idea.funded || 0,
          action.payload.parentIdea.funded || 0,
          state.maxFundAmountSeen),
      };
    case Client.commentCreateActionStatus.Fulfilled:
      // For comment creation, update idea comment counts
      return !state.byId[action.meta.request.ideaId] ? state : {
        ...state,
        byId: {
          ...state.byId,
          [action.meta.request.ideaId]: {
            ...state.byId[action.meta.request.ideaId],
            idea: {
              ...state.byId[action.meta.request.ideaId].idea!,
              commentCount: (state.byId[action.meta.request.ideaId].idea?.commentCount || 0) + 1,
              ...(!!action.payload.parentCommentId ? {} : {
                childCommentCount: (state.byId[action.meta.request.ideaId].idea?.childCommentCount || 0) + 1,
              }),
            },
          }
        },
      };
    case Client.ideaGetAllActionStatus.Pending:
      return {
        ...state,
        byId: {
          ...state.byId,
          ...action.meta.request.ideaGetAll.postIds.reduce(
            (ideasById, ideaId) => {
              ideasById[ideaId] = {
                status: Status.PENDING,
              };
              return ideasById;
            }, {}),
        },
      };
    case Client.ideaGetAllActionStatus.Rejected:
      return {
        ...state,
        byId: {
          ...state.byId,
          ...action.meta.request.ideaGetAll.postIds.reduce(
            (ideasById, ideaId) => {
              ideasById[ideaId] = {
                status: Status.REJECTED,
              };
              return ideasById;
            }, {}),
        },
      };
    case Client.ideaGetAllActionStatus.Fulfilled:
      return {
        ...state,
        byId: {
          ...state.byId,
          ...(action.meta.request.ideaGetAll.postIds.length === action.payload.results.length
            ? action.payload.results.reduce(
              (ideasById, idea) => {
                ideasById[idea.ideaId] = {
                  idea: idea,
                  status: Status.FULFILLED,
                };
                return ideasById;
              }, {})
            : action.meta.request.ideaGetAll.postIds.reduce(
              (ideasById, ideaId) => {
                const idea = action.payload.results.find(idea => idea.ideaId === ideaId);
                ideasById[ideaId] = {
                  idea: idea,
                  status: !!idea ? Status.FULFILLED : Status.REJECTED,
                };
                return ideasById;
              }, {})),
        },
        maxFundAmountSeen: Math.max(
          action.payload.results.reduce((max, idea) => Math.max(max, idea.funded || 0), 0) || 0,
          state.maxFundAmountSeen),
      };
    case Client.ideaSearchActionStatus.Pending:
    case Admin.ideaSearchAdminActionStatus.Pending:
      searchKey = getSearchKey(action.type === Admin.ideaSearchAdminActionStatus.Pending
        ? action.meta.request.ideaSearchAdmin
        : action.meta.request.ideaSearch);
      return {
        ...state,
        bySearch: {
          ...state.bySearch,
          [searchKey]: {
            ...state.bySearch[searchKey],
            status: Status.PENDING,
          }
        }
      };
    case Client.ideaSearchActionStatus.Rejected:
    case Admin.ideaSearchAdminActionStatus.Rejected:
      searchKey = getSearchKey(action.type === Admin.ideaSearchAdminActionStatus.Rejected
        ? action.meta.request.ideaSearchAdmin
        : action.meta.request.ideaSearch);
      return {
        ...state,
        bySearch: {
          ...state.bySearch,
          [searchKey]: {
            ...state.bySearch[searchKey],
            status: Status.REJECTED,
          }
        }
      };
    case Client.ideaSearchActionStatus.Fulfilled:
    case Admin.ideaSearchAdminActionStatus.Fulfilled:
      searchKey = getSearchKey(action.type === Admin.ideaSearchAdminActionStatus.Fulfilled
        ? action.meta.request.ideaSearchAdmin
        : action.meta.request.ideaSearch);
      var filterStatusIds = action.type === Admin.ideaSearchAdminActionStatus.Fulfilled
        ? action.meta.request.ideaSearchAdmin.filterStatusIds
        : action.meta.request.ideaSearch.filterStatusIds;
      return {
        ...state,
        byId: {
          ...state.byId,
          ...(action.payload.results as Client.Idea[]).reduce<any>(
            (ideasById, idea) => {
              ideasById[idea.ideaId] = {
                idea: idea,
                status: Status.FULFILLED,
              };
              return ideasById;
            }, {}),
        },
        bySearch: {
          ...state.bySearch,
          [searchKey]: {
            status: Status.FULFILLED,
            ideaIds: (action.meta.request.cursor !== undefined && state.bySearch[searchKey] && action.meta.request.cursor === state.bySearch[searchKey].cursor)
              ? [ // Append results to existing idea ids
                ...(state.bySearch[searchKey].ideaIds || []),
                ...(action.payload.results as Client.Idea[]).map(idea => idea.ideaId),
              ] : ( // Replace results if cursor doesn't match
                (action.payload.results as Client.Idea[]).map(idea => idea.ideaId)
              ),
            cursor: action.payload.cursor,
            filterStatusIds,
          }
        },
        maxFundAmountSeen: Math.max(
          (action.payload.results as Client.Idea[]).reduce((max, idea) => Math.max(max, idea.funded || 0), 0) || 0,
          state.maxFundAmountSeen),
      };
    case 'ideaSearchResultRemoveIdea':
      searchKey = action.payload.searchKey;
      return {
        ...state,
        bySearch: {
          ...state.bySearch,
          [searchKey]: {
            ...state.bySearch[searchKey],
            ideaIds: (state.bySearch[searchKey]?.ideaIds || []).filter(id => id !== action.payload.ideaId),
          }
        },
      };
    case 'ideaSearchResultAddIdea':
      searchKey = action.payload.searchKey;
      return {
        ...state,
        bySearch: {
          ...state.bySearch,
          [searchKey]: {
            ...state.bySearch[searchKey],
            ideaIds: [
              ...(state.bySearch[searchKey]?.ideaIds?.slice(0, action.payload.index) || []),
              action.payload.ideaId,
              ...(state.bySearch[searchKey]?.ideaIds?.slice(action.payload.index) || []),
            ],
          }
        },
      };
    case Client.ideaVoteUpdateActionStatus.Pending:
    case Client.ideaVoteUpdateActionStatus.Rejected:
      // All of this below fakes the vote counts before server returns a real value
      // In case of rejection, it undoes the faking
      const isPending = action.type === Client.ideaVoteUpdateActionStatus.Pending;
      const idea = state.byId[action.meta.request.ideaId];
      if (!idea || !idea.idea) return state;
      state.byId[action.meta.request.ideaId] = idea;
      const previousVote: Client.IdeaVote = action.meta['previousVote'] || {};
      if (previousVote === undefined) throw Error('voteUpdate expecting previousVote in extra meta, set to null if not present');
      if (action.meta.request.ideaVoteUpdate.fundDiff !== undefined) {
        const fundDiff = isPending ? action.meta.request.ideaVoteUpdate.fundDiff : -action.meta.request.ideaVoteUpdate.fundDiff;
        if (fundDiff !== 0) {
          idea.idea.funded = (idea.idea.funded || 0) + fundDiff;
        }
        const previousFundersCount = (previousVote.fundAmount || 0) > 0 ? 1 : 0;
        const fundersCount = (previousVote.fundAmount || 0) + fundDiff > 0 ? 1 : 0;
        const fundersCountDiff = isPending ? fundersCount - previousFundersCount : previousFundersCount - fundersCount;
        if (fundersCountDiff) {
          idea.idea.fundersCount = fundersCountDiff;
        }
      }
      if (action.meta.request.ideaVoteUpdate.vote !== undefined) {
        const previousVoteVal = (previousVote.vote === Client.VoteOption.Upvote ? 1 : (previousVote.vote === Client.VoteOption.Downvote ? -1 : 0));
        const voteVal = (action.meta.request.ideaVoteUpdate.vote === Client.VoteOption.Upvote ? 1 : (action.meta.request.ideaVoteUpdate.vote === Client.VoteOption.Downvote ? -1 : 0));
        const voteDiff = isPending ? voteVal - previousVoteVal : previousVoteVal - voteVal;
        if (voteDiff !== 0) {
          idea.idea.voteValue = (idea.idea.voteValue || 0) + voteDiff;
        }
      }
      if (action.meta.request.ideaVoteUpdate.expressions !== undefined) {
        const expression: string | undefined = action.meta.request.ideaVoteUpdate.expressions.expression;
        var addExpressions: string[] = [];
        var removeExpressions: string[] = [];
        switch (action.meta.request.ideaVoteUpdate.expressions.action) {
          case Client.IdeaVoteUpdateExpressionsActionEnum.Set:
            expression && addExpressions.push(expression);
            removeExpressions = (previousVote.expression || []).filter(e => e !== expression);
            break;
          case Client.IdeaVoteUpdateExpressionsActionEnum.Unset:
            removeExpressions = (previousVote.expression || []);
            break;
          case Client.IdeaVoteUpdateExpressionsActionEnum.Add:
            if (expression && !(previousVote.expression || []).includes(expression)) {
              addExpressions.push(expression);
            }
            break;
          case Client.IdeaVoteUpdateExpressionsActionEnum.Remove:
            if (expression && (previousVote.expression || []).includes(expression)) {
              removeExpressions.push(expression);
            }
            break;
        }
        (isPending ? addExpressions : removeExpressions).forEach(e => idea.idea!.expressions = {
          ...idea.idea!.expressions,
          e: (idea.idea!.expressions && idea.idea!.expressions[e] || 0) + 1,
        });
        (isPending ? addExpressions : removeExpressions).forEach(e => idea.idea!.expressions = {
          ...idea.idea!.expressions,
          e: (idea.idea!.expressions && idea.idea!.expressions[e] || 0) - 1,
        });
      }
      return {
        ...state,
        byId: {
          ...state.byId,
          [action.meta.request.ideaId]: {
            ...state.byId[action.meta.request.ideaId],
            idea: idea.idea,
          }
        }
      };
    case Client.ideaVoteUpdateActionStatus.Fulfilled:
      return {
        ...state,
        byId: {
          ...state.byId,
          [action.payload.idea.ideaId]: {
            idea: action.payload.idea,
            status: Status.FULFILLED,
          }
        },
        maxFundAmountSeen: Math.max(action.payload.idea.funded || 0, state.maxFundAmountSeen),
      };
    default:
      return state;
  }
}

interface draftSearchResultAddDraftAction {
  type: 'draftSearchResultAddDraft';
  payload: {
    searchKey: string;
    draftId: string;
  };
}
export interface StateDrafts {
  byId: {
    [draftId: string]: {
      status: Status;
      draft?: Admin.IdeaDraftAdmin;
    }
  };
  // TODO eventually we should invalidate these searches over time
  bySearch: {
    [searchKey: string]: {
      status: Status,
      draftIds?: string[],
      cursor?: string,
    }
  };
}
const stateDraftsDefault = {
  byId: {},
  bySearch: {},
};
function reducerDrafts(state: StateDrafts = stateDraftsDefault, action: AllActions): StateDrafts {
  var searchKey;
  switch (action.type) {
    case 'draftSearchResultAddDraft':
      searchKey = action.payload.searchKey;
      return {
        ...state,
        bySearch: {
          ...state.bySearch,
          [searchKey]: {
            ...state.bySearch[searchKey],
            draftIds: [
              action.payload.draftId,
              ...(state.bySearch[searchKey]?.draftIds || []),
            ],
          }
        },
      };
    case Admin.ideaDraftCreateAdminActionStatus.Fulfilled:
      return {
        ...state,
        byId: {
          ...state.byId,
          [action.payload.draftId]: {
            draft: action.payload,
            status: Status.FULFILLED,
          },
        },
      };
    case Admin.ideaDraftDeleteAdminActionStatus.Fulfilled:
    case Admin.ideaCreateAdminActionStatus.Fulfilled:
      const draftIdToDelete = action.type === Admin.ideaDraftDeleteAdminActionStatus.Fulfilled
        ? action.meta.request.draftId
        : action.meta.request.deleteDraftId
      if (!draftIdToDelete) return state;
      const { [draftIdToDelete]: removedDraft, ...byIdWithoutDeleted } = state.byId;
      return {
        ...state,
        byId: byIdWithoutDeleted,
      };
    case Admin.ideaDraftGetAdminActionStatus.Pending:
    case Admin.ideaDraftUpdateAdminActionStatus.Pending:
      return {
        ...state,
        byId: {
          ...state.byId,
          [action.meta.request.draftId]: {
            ...state.byId[action.meta.request.draftId],
            status: Status.PENDING,
          },
        },
      };
    case Admin.ideaDraftGetAdminActionStatus.Rejected:
    case Admin.ideaDraftUpdateAdminActionStatus.Rejected:
      return {
        ...state,
        byId: {
          ...state.byId,
          [action.meta.request.draftId]: {
            ...state.byId[action.meta.request.draftId],
            status: Status.REJECTED,
          },
        },
      };
    case Admin.ideaDraftGetAdminActionStatus.Fulfilled:
    case Admin.ideaDraftUpdateAdminActionStatus.Fulfilled:
      const draft = action.type === Admin.ideaDraftUpdateAdminActionStatus.Fulfilled
        ? action.meta.request.ideaCreateAdmin
        : action.payload;
      return {
        ...state,
        byId: {
          ...state.byId,
          [action.meta.request.draftId]: {
            draft: {
              lastSaved: new Date(),
              ...draft,
              draftId: action.meta.request.draftId,
            },
            status: Status.FULFILLED,
          },
        },
      };
    case Admin.ideaDraftSearchAdminActionStatus.Pending:
      searchKey = getSearchKey(action.meta.request.ideaDraftSearch);
      return {
        ...state,
        bySearch: {
          ...state.bySearch,
          [searchKey]: {
            ...state.bySearch[searchKey],
            status: Status.PENDING,
          }
        }
      };
    case Admin.ideaDraftSearchAdminActionStatus.Rejected:
      searchKey = getSearchKey(action.meta.request.ideaDraftSearch);
      return {
        ...state,
        bySearch: {
          ...state.bySearch,
          [searchKey]: {
            ...state.bySearch[searchKey],
            status: Status.REJECTED,
          }
        }
      };
    case Admin.ideaDraftSearchAdminActionStatus.Fulfilled:
      searchKey = getSearchKey(action.meta.request.ideaDraftSearch);
      return {
        ...state,
        byId: {
          ...state.byId,
          ...action.payload.results.reduce<any>(
            (draftsById, draft) => {
              draftsById[draft.draftId] = {
                draft,
                status: Status.FULFILLED,
              };
              return draftsById;
            }, {}),
        },
        bySearch: {
          ...state.bySearch,
          [searchKey]: {
            status: Status.FULFILLED,
            draftIds: (action.meta.request.cursor !== undefined && state.bySearch[searchKey] && action.meta.request.cursor === state.bySearch[searchKey].cursor)
              ? [ // Append results to existing draft ids
                ...(state.bySearch[searchKey].draftIds || []),
                ...action.payload.results.map(idea => idea.draftId),
              ] : ( // Replace results if cursor doesn't match
                action.payload.results.map(draft => draft.draftId)
              ),
            cursor: action.payload.cursor,
          }
        },
      };
    default:
      return state;
  }
}

export interface StateComments {
  byId: {
    [commentId: string]: {
      status: Status;
      comment?: Client.Comment;
    }
  };
  byIdeaIdOrParentCommentId: {
    [ideaIdOrParentCommentId: string]: {
      status: Status;
      commentIds?: Set<string>;
    }
  };
  bySearch: {
    [searchKey: string]: {
      status: Status,
      commentIds?: string[],
      cursor?: string,
    }
  };
  bySearchAdmin: {
    [searchKey: string]: {
      status: Status,
      commentIds?: string[],
      cursor?: string,
    }
  };
}
const stateCommentsDefault = {
  byId: {},
  byIdeaIdOrParentCommentId: {},
  bySearch: {},
  bySearchAdmin: {},
};
function reducerComments(state: StateComments = stateCommentsDefault, action: AllActions): StateComments {
  var searchKey;
  switch (action.type) {
    case Client.ideaCommentSearchActionStatus.Pending:
      return {
        ...state,
        byIdeaIdOrParentCommentId: {
          ...state.byIdeaIdOrParentCommentId,
          [action.meta.request.ideaCommentSearch.parentCommentId || action.meta.request.ideaId]: {
            ...state.byIdeaIdOrParentCommentId[action.meta.request.ideaCommentSearch.parentCommentId || action.meta.request.ideaId],
            status: Status.PENDING
          }
        },
      };
    case Client.ideaCommentSearchActionStatus.Rejected:
      return {
        ...state,
        byIdeaIdOrParentCommentId: {
          ...state.byIdeaIdOrParentCommentId,
          [action.meta.request.ideaCommentSearch.parentCommentId || action.meta.request.ideaId]: {
            ...state.byIdeaIdOrParentCommentId[action.meta.request.ideaCommentSearch.parentCommentId || action.meta.request.ideaId],
            status: Status.REJECTED
          }
        },
      };
    case Client.commentDeleteActionStatus.Fulfilled:
    case Admin.commentDeleteAdminActionStatus.Fulfilled:
    case Client.commentUpdateActionStatus.Fulfilled:
    case Client.commentVoteUpdateActionStatus.Fulfilled:
      const comment = action.type === Client.commentVoteUpdateActionStatus.Fulfilled
        ? action.payload.comment : action.payload;
      return {
        ...state,
        byId: {
          ...state.byId,
          [action.meta.request.commentId]: {
            status: Status.FULFILLED,
            comment,
          }
        },
      };
    case Client.ideaCommentSearchActionStatus.Fulfilled:
      // First set state
      var newState = {
        ...state,
        byIdeaIdOrParentCommentId: {
          ...state.byIdeaIdOrParentCommentId,
          [action.meta.request.ideaCommentSearch.parentCommentId || action.meta.request.ideaId]: {
            ...state.byIdeaIdOrParentCommentId[action.meta.request.ideaCommentSearch.parentCommentId || action.meta.request.ideaId],
            status: Status.FULFILLED
          }
        },
      };
      // Then put all the comments in the right places
      action.payload.results.forEach(comment => newState.byIdeaIdOrParentCommentId = {
        ...newState.byIdeaIdOrParentCommentId,
        [comment.parentCommentId || action.meta.request.ideaId]: {
          ...newState.byIdeaIdOrParentCommentId[comment.parentCommentId || action.meta.request.ideaId],
          status: Status.FULFILLED,
          commentIds: new Set([
            ...(newState.byIdeaIdOrParentCommentId[comment.parentCommentId || action.meta.request.ideaId]?.commentIds || []),
            comment.commentId,
          ]),
        }
      });
      return {
        ...newState,
        byIdeaIdOrParentCommentId: newState.byIdeaIdOrParentCommentId,
        byId: {
          ...newState.byId,
          ...action.payload.results.reduce(
            (commentsById, comment) => {
              commentsById[comment.commentId] = {
                comment: {
                  ...comment,
                },
                status: Status.FULFILLED,
              };
              return commentsById;
            }, {}),
        },
      };
    case Client.commentCreateActionStatus.Fulfilled:
      return {
        ...state,
        byIdeaIdOrParentCommentId: {
          ...state.byIdeaIdOrParentCommentId,
          [action.payload.parentCommentId || action.payload.ideaId]: {
            ...state.byIdeaIdOrParentCommentId[action.payload.parentCommentId || action.payload.ideaId],
            status: Status.FULFILLED,
            commentIds: new Set([
              ...(state.byIdeaIdOrParentCommentId[action.payload.parentCommentId || action.payload.ideaId] && state.byIdeaIdOrParentCommentId[action.payload.parentCommentId || action.payload.ideaId].commentIds || []),
              action.payload.commentId,
            ]),
          }
        },
        byId: {
          ...state.byId,
          [action.payload.commentId]: {
            comment: action.payload,
            status: Status.FULFILLED,
          },
          // Also increase the child comment count on the parent comment
          ...(action.payload.parentCommentId
            ? {
              [action.payload.parentCommentId]: {
                ...state.byId[action.payload.parentCommentId],
                status: Status.FULFILLED,
                comment: {
                  ...state.byId[action.payload.parentCommentId].comment as any,
                  childCommentCount: (state.byId[action.payload.parentCommentId].comment?.childCommentCount || 0) + 1,
                },
              }
            }
            : {}),
        },
      };
    case Client.commentSearchActionStatus.Pending:
      searchKey = getSearchKey(action.meta.request.commentSearch);
      return {
        ...state,
        bySearch: {
          ...state.bySearch,
          [searchKey]: {
            ...state.bySearch[searchKey],
            status: Status.PENDING,
          }
        }
      };
    case Client.commentSearchActionStatus.Rejected:
      searchKey = getSearchKey(action.meta.request.commentSearch);
      return {
        ...state,
        bySearch: {
          ...state.bySearch,
          [searchKey]: {
            ...state.bySearch[searchKey],
            status: Status.REJECTED,
          }
        }
      };
    case Client.commentSearchActionStatus.Fulfilled:
      searchKey = getSearchKey(action.meta.request.commentSearch);
      return {
        ...state,
        byId: {
          ...state.byId,
          ...action.payload.results.reduce(
            (commentsById, comment) => {
              commentsById[comment.commentId] = {
                comment,
                status: Status.FULFILLED,
              };
              return commentsById;
            }, {}),
        },
        bySearch: {
          ...state.bySearch,
          [searchKey]: {
            status: Status.FULFILLED,
            commentIds: (action.meta.request.cursor !== undefined && state.bySearch[searchKey] && action.meta.request.cursor === state.bySearch[searchKey].cursor)
              ? [ // Append results to existing comment ids
                ...(state.bySearch[searchKey].commentIds || []),
                ...action.payload.results.map(comment => comment.commentId),
              ] : ( // Replace results if cursor doesn't match
                action.payload.results.map(comment => comment.commentId)
              ),
            cursor: action.payload.cursor,
          }
        },
      };
    case Admin.commentSearchAdminActionStatus.Pending:
      searchKey = getSearchKey(action.meta.request.commentSearchAdmin);
      return {
        ...state,
        bySearchAdmin: {
          ...state.bySearchAdmin,
          [searchKey]: {
            ...state.bySearchAdmin[searchKey],
            status: Status.PENDING,
          }
        }
      };
    case Admin.commentSearchAdminActionStatus.Rejected:
      searchKey = getSearchKey(action.meta.request.commentSearchAdmin);
      return {
        ...state,
        bySearchAdmin: {
          ...state.bySearchAdmin,
          [searchKey]: {
            ...state.bySearchAdmin[searchKey],
            status: Status.REJECTED,
          }
        }
      };
    case Admin.commentSearchAdminActionStatus.Fulfilled:
      searchKey = getSearchKey(action.meta.request.commentSearchAdmin);
      return {
        ...state,
        byId: {
          ...state.byId,
          ...action.payload.results.reduce(
            (commentsById, comment) => {
              commentsById[comment.commentId] = {
                comment,
                status: Status.FULFILLED,
              };
              return commentsById;
            }, {}),
        },
        bySearchAdmin: {
          ...state.bySearchAdmin,
          [searchKey]: {
            status: Status.FULFILLED,
            commentIds: (action.meta.request.cursor !== undefined && state.bySearchAdmin[searchKey] && action.meta.request.cursor === state.bySearchAdmin[searchKey].cursor)
              ? [ // Append results to existing comment ids
                ...(state.bySearchAdmin[searchKey].commentIds || []),
                ...action.payload.results.map(comment => comment.commentId),
              ] : ( // Replace results if cursor doesn't match
                action.payload.results.map(comment => comment.commentId)
              ),
            cursor: action.payload.cursor,
          }
        },
      };
    case Admin.ideaUnMergeAdminActionStatus.Fulfilled:
      const { [action.meta.request.ideaId]: removedMergedPostAsComment, ...byIdWithoutMergedPostAsComment } = state.byId;
      if (!removedMergedPostAsComment) return state;
      return {
        ...state,
        byId: byIdWithoutMergedPostAsComment,
      };
    default:
      return state;
  }
}

export interface StateUsers {
  byId: {
    [userId: string]: {
      status: Status;
      user?: Client.User | Admin.UserAdmin;
    }
  };
  // TODO eventually we should invalidate these searches over time
  bySearch: {
    [searchKey: string]: {
      status: Status,
      userIds?: string[],
      cursor?: string,
    }
  };
  loggedIn: {
    status?: Status;
    user?: Client.UserMe,
  };
}
const stateUsersDefault = {
  byId: {},
  bySearch: {},
  loggedIn: {},
};
function reducerUsers(state: StateUsers = stateUsersDefault, action: AllActions): StateUsers {
  var searchKey;
  switch (action.type) {
    case Admin.userSearchAdminActionStatus.Pending:
      searchKey = getSearchKey(action.meta.request.userSearchAdmin);
      return {
        ...state,
        bySearch: {
          ...state.bySearch,
          [searchKey]: {
            ...state.bySearch[searchKey],
            status: Status.PENDING,
          }
        }
      };
    case Admin.userSearchAdminActionStatus.Rejected:
      searchKey = getSearchKey(action.meta.request.userSearchAdmin);
      return {
        ...state,
        bySearch: {
          ...state.bySearch,
          [searchKey]: {
            ...state.bySearch[searchKey],
            status: Status.REJECTED,
          }
        }
      };
    case Admin.userSearchAdminActionStatus.Fulfilled:
      searchKey = getSearchKey(action.meta.request.userSearchAdmin);
      return {
        ...state,
        byId: {
          ...state.byId,
          ...action.payload.results.reduce(
            (usersById, user) => {
              usersById[user.userId] = {
                user,
                status: Status.FULFILLED,
              };
              return usersById;
            }, {}),
        },
        bySearch: {
          ...state.bySearch,
          [searchKey]: {
            status: Status.FULFILLED,
            userIds: (action.meta.request.cursor !== undefined && state.bySearch[searchKey] && action.meta.request.cursor === state.bySearch[searchKey].cursor)
              ? [ // Append results to existing user ids
                ...(state.bySearch[searchKey].userIds || []),
                ...(action.payload.results.map(user => user.userId)),
              ] : ( // Replace results if cursor doesn't match
                action.payload.results.map(user => user.userId)
              ),
            cursor: action.payload.cursor,
          }
        },
      };
    case Admin.userUpdateAdminActionStatus.Pending:
    case Client.userGetActionStatus.Pending:
    case Admin.userGetAdminActionStatus.Pending:
      return {
        ...state,
        byId: {
          ...state.byId,
          [action.meta.request.userId]: {
            status: Status.PENDING,
          }
        }
      };
    case Admin.userUpdateAdminActionStatus.Rejected:
    case Client.userGetActionStatus.Rejected:
    case Admin.userGetAdminActionStatus.Rejected:
      return {
        ...state,
        byId: {
          ...state.byId,
          [action.meta.request.userId]: {
            status: Status.REJECTED,
          }
        }
      };
    case Admin.userUpdateAdminActionStatus.Fulfilled:
    case Client.userGetActionStatus.Fulfilled:
    case Admin.userGetAdminActionStatus.Fulfilled:
      return {
        ...state,
        byId: {
          ...state.byId,
          [action.meta.request.userId]: {
            user: action.payload,
            status: Status.FULFILLED,
          },
        },
        ...(state.loggedIn.user?.userId === action.payload.userId ? {
          loggedIn: {
            ...state.loggedIn,
            user: {
              ...state.loggedIn.user,
              ...action.payload,
            },
          },
        } : {}),
      };
    case Client.userBindActionStatus.Pending:
    case Client.userBindSlugActionStatus.Pending:
    case Client.configAndUserBindSlugActionStatus.Pending:
      return {
        ...state,
        loggedIn: {
          status: Status.PENDING,
        },
      };
    case Client.userBindActionStatus.Rejected:
    case Client.userBindSlugActionStatus.Rejected:
    case Client.configAndUserBindSlugActionStatus.Rejected:
      return {
        ...state,
        loggedIn: {
          status: Status.REJECTED,
        },
      };
    case Client.userBindActionStatus.Fulfilled:
    case Client.userBindSlugActionStatus.Fulfilled:
    case Client.configAndUserBindSlugActionStatus.Fulfilled:
      if (!action.payload.user) return state;
      return {
        ...state,
        byId: {
          ...state.byId,
          [action.payload.user.userId]: {
            user: action.payload.user,
            status: Status.FULFILLED,
          }
        },
        loggedIn: {
          user: action.payload.user,
          status: Status.FULFILLED,
        },
      };
    case Client.userCreateActionStatus.Fulfilled:
    case Client.userLoginActionStatus.Fulfilled:
    case Client.userUpdateActionStatus.Fulfilled:
    case Client.categorySubscribeActionStatus.Fulfilled:
      const user = action.type === Client.userCreateActionStatus.Fulfilled
        ? action.payload.user : action.payload;
      if (user === undefined) return state;
      return {
        ...state,
        byId: {
          ...state.byId,
          [user.userId]: {
            user,
            status: Status.FULFILLED,
          }
        },
        loggedIn: {
          user,
          status: Status.FULFILLED,
        },
      };
    case Admin.userDeleteAdminActionStatus.Fulfilled:
      const { [action.meta.request.userId]: removedUser, ...byIdWithoutDeleted } = state.byId;
      return {
        ...state,
        byId: byIdWithoutDeleted,
      };
    case Client.userLogoutActionStatus.Fulfilled:
    case Client.userDeleteActionStatus.Fulfilled:
      if (!state.loggedIn.user) return state;
      const { [state.loggedIn.user.userId]: loggedOutUser, ...byIdWithoutLoggedOut } = state.byId;
      return {
        ...state,
        byId: byIdWithoutLoggedOut,
        loggedIn: {},
      };
    default:
      return state;
  }
}

export interface StateVotes {
  statusByIdeaId: { [ideaId: string]: Status };
  votesByIdeaId: { [ideaId: string]: Client.VoteOption };
  expressionByIdeaId: { [ideaId: string]: Array<string> };
  fundAmountByIdeaId: { [ideaId: string]: number };
}
const stateVotesDefault = {
  statusByIdeaId: {},
  votesByIdeaId: {},
  expressionByIdeaId: {},
  fundAmountByIdeaId: {},
};
function reducerVotes(state: StateVotes = stateVotesDefault, action: AllActions): StateVotes {
  switch (action.type) {
    case Client.ideaVoteGetOwnActionStatus.Pending:
      return {
        ...state,
        statusByIdeaId: {
          ...state.statusByIdeaId,
          ...action.meta.request.ideaIds.reduce(
            (byIdeaId, ideaId) => {
              byIdeaId[ideaId] = Status.PENDING;
              return byIdeaId;
            }, {}),
        },
      };
    case Client.ideaVoteGetOwnActionStatus.Rejected:
      return {
        ...state,
        statusByIdeaId: {
          ...state.statusByIdeaId,
          ...action.meta.request.ideaIds.reduce(
            (byIdeaId, ideaId) => {
              byIdeaId[ideaId] = Status.REJECTED;
              return byIdeaId;
            }, {}),
        },
      };
    case Client.ideaVoteGetOwnActionStatus.Fulfilled:
      return {
        ...state,
        statusByIdeaId: {
          ...state.statusByIdeaId,
          ...action.meta.request.ideaIds.reduce(
            (byIdeaId, ideaId) => {
              byIdeaId[ideaId] = Status.FULFILLED;
              return byIdeaId;
            }, {}),
        },
        votesByIdeaId: {
          ...state.votesByIdeaId,
          ...action.payload.votesByIdeaId,
        },
        expressionByIdeaId: {
          ...state.expressionByIdeaId,
          ...action.payload.expressionByIdeaId,
        },
        fundAmountByIdeaId: {
          ...state.fundAmountByIdeaId,
          ...action.payload.fundAmountByIdeaId,
        },
      };
    case Client.ideaVoteUpdateActionStatus.Pending:
      return {
        ...state,
        statusByIdeaId: {
          ...state.statusByIdeaId,
          [action.meta.request.ideaId]: Status.PENDING,
        },
        ...(action.meta.request.ideaVoteUpdate.vote ? {
          votesByIdeaId: {
            ...state.votesByIdeaId,
            [action.meta.request.ideaId]: action.meta.request.ideaVoteUpdate.vote,
          },
        } : {}),
        ...(action.meta.request.ideaVoteUpdate.expressions ? {
          expressionByIdeaId: {
            ...state.expressionByIdeaId,
            [action.meta.request.ideaId]:
              action.meta.request.ideaVoteUpdate.expressions.action === Client.IdeaVoteUpdateExpressionsActionEnum.Set
              && [action.meta.request.ideaVoteUpdate.expressions.expression!]
              || action.meta.request.ideaVoteUpdate.expressions.action === Client.IdeaVoteUpdateExpressionsActionEnum.Unset
              && []
              || action.meta.request.ideaVoteUpdate.expressions.action === Client.IdeaVoteUpdateExpressionsActionEnum.Add
              && [...new Set<string>([
                action.meta.request.ideaVoteUpdate.expressions.expression!,
                ...(state.expressionByIdeaId[action.meta.request.ideaId] || []),])]
              || action.meta.request.ideaVoteUpdate.expressions.action === Client.IdeaVoteUpdateExpressionsActionEnum.Remove
              && (state.expressionByIdeaId[action.meta.request.ideaId] || []).filter(e => e !== action.meta.request.ideaVoteUpdate.expressions!.expression)
              || [],
          },
        } : {}),
        ...(action.meta.request.ideaVoteUpdate.fundDiff ? {
          fundAmountByIdeaId: {
            ...state.fundAmountByIdeaId,
            [action.meta.request.ideaId]: (state.fundAmountByIdeaId[action.meta.request.ideaId] || 0) + action.meta.request.ideaVoteUpdate.fundDiff,
          },
        } : {}),
      };
    case Client.ideaVoteUpdateActionStatus.Rejected:
      return {
        ...state,
        statusByIdeaId: {
          ...state.statusByIdeaId,
          [action.meta.request.ideaId]: Status.REJECTED,
        },
        ...(action.meta.request.ideaVoteUpdate.vote ? {
          votesByIdeaId: {
            ...state.votesByIdeaId,
            [action.meta.request.ideaId]: Client.VoteOption.None,
          },
        } : {}),
        ...(action.meta.request.ideaVoteUpdate.expressions ? {
          expressionByIdeaId: {
            ...state.expressionByIdeaId,
            [action.meta.request.ideaId]:
              action.meta.request.ideaVoteUpdate.expressions.action === Client.IdeaVoteUpdateExpressionsActionEnum.Set
              && []
              || action.meta.request.ideaVoteUpdate.expressions.action === Client.IdeaVoteUpdateExpressionsActionEnum.Unset
              && [...(action.meta.request.ideaVoteUpdate.expressions.expression ? [action.meta.request.ideaVoteUpdate.expressions.expression] : [])]
              || action.meta.request.ideaVoteUpdate.expressions.action === Client.IdeaVoteUpdateExpressionsActionEnum.Add
              && (state.expressionByIdeaId[action.meta.request.ideaId] || []).filter(e => e !== action.meta.request.ideaVoteUpdate.expressions!.expression)
              || action.meta.request.ideaVoteUpdate.expressions.action === Client.IdeaVoteUpdateExpressionsActionEnum.Remove
              && [...new Set<string>([
                action.meta.request.ideaVoteUpdate.expressions.expression!,
                ...(state.expressionByIdeaId[action.meta.request.ideaId] || []),])]
              || [],
          },
        } : {}),
        ...(action.meta.request.ideaVoteUpdate.fundDiff ? {
          fundAmountByIdeaId: {
            ...state.fundAmountByIdeaId,
            [action.meta.request.ideaId]: (state.fundAmountByIdeaId[action.meta.request.ideaId] || 0) - action.meta.request.ideaVoteUpdate.fundDiff,
          },
        } : {}),
      };
    case Client.ideaVoteUpdateActionStatus.Fulfilled:
    case Client.ideaGetActionStatus.Fulfilled:
    case Client.ideaCreateActionStatus.Fulfilled:
    case Admin.ideaCreateAdminActionStatus.Fulfilled:
      const ideaId = action.type === Client.ideaVoteUpdateActionStatus.Fulfilled
        ? action.meta.request.ideaId : action.payload.ideaId;
      return {
        ...state,
        statusByIdeaId: {
          ...state.statusByIdeaId,
          [ideaId]: Status.FULFILLED,
        },
        ...(action.payload.vote.vote ? {
          votesByIdeaId: {
            ...state.votesByIdeaId,
            [ideaId]: action.payload.vote.vote,
          },
        } : {}),
        ...(action.payload.vote.expression ? {
          expressionByIdeaId: {
            ...state.expressionByIdeaId,
            [ideaId]: action.payload.vote.expression,
          },
        } : {}),
        ...(action.payload.vote.fundAmount ? {
          fundAmountByIdeaId: {
            ...state.fundAmountByIdeaId,
            [ideaId]: action.payload.vote.fundAmount,
          },
        } : {}),
      };
    case Client.ideaSearchActionStatus.Fulfilled:
    case Client.ideaGetAllActionStatus.Fulfilled:
      return {
        ...state,
        statusByIdeaId: {
          ...state.statusByIdeaId,
          ...action.payload.results.reduce(
            (byIdeaId, idea) => {
              byIdeaId[idea.ideaId] = Status.FULFILLED;
              return byIdeaId;
            }, {}),
        },
        votesByIdeaId: {
          ...state.votesByIdeaId,
          ...action.payload.results.reduce(
            (votesByIdeaId, idea) => {
              if (idea.vote.vote) votesByIdeaId[idea.ideaId] = idea.vote.vote;
              return votesByIdeaId;
            }, {}),
        },
        expressionByIdeaId: {
          ...state.expressionByIdeaId,
          ...action.payload.results.reduce(
            (expressionByIdeaId, idea) => {
              if (idea.vote.expression) expressionByIdeaId[idea.ideaId] = idea.vote.expression;
              return expressionByIdeaId;
            }, {}),
        },
        fundAmountByIdeaId: {
          ...state.fundAmountByIdeaId,
          ...action.payload.results.reduce(
            (fundAmountByIdeaId, idea) => {
              if (idea.vote.fundAmount) fundAmountByIdeaId[idea.ideaId] = idea.vote.fundAmount;
              return fundAmountByIdeaId;
            }, {}),
        },
      };
    case Client.userLoginActionStatus.Fulfilled:
    case Client.userCreateActionStatus.Fulfilled:
    case Client.userLogoutActionStatus.Fulfilled:
    case Client.userDeleteActionStatus.Fulfilled:
      return { // Clear on login/logout
        statusByIdeaId: {},
        votesByIdeaId: {},
        expressionByIdeaId: {},
        fundAmountByIdeaId: {},
      };
    default:
      return state;
  }
}

export interface StateCommentVotes {
  statusByCommentId: { [commentId: string]: Status };
  votesByCommentId: { [commentId: string]: Client.VoteOption };
}
const stateCommentVotesDefault = {
  statusByCommentId: {},
  votesByCommentId: {},
};
function reducerCommentVotes(state: StateCommentVotes = stateCommentVotesDefault, action: AllActions): StateCommentVotes {
  switch (action.type) {
    case Client.commentVoteGetOwnActionStatus.Pending:
      return {
        ...state,
        statusByCommentId: {
          ...state.statusByCommentId,
          ...action.meta.request.commentIds.reduce(
            (byCommentId, commentId) => {
              byCommentId[commentId] = Status.PENDING;
              return byCommentId;
            }, {}),
        },
      };
    case Client.commentVoteGetOwnActionStatus.Rejected:
      return {
        ...state,
        statusByCommentId: {
          ...state.statusByCommentId,
          ...action.meta.request.commentIds.reduce(
            (byCommentId, commentId) => {
              byCommentId[commentId] = Status.REJECTED;
              return byCommentId;
            }, {}),
        },
      };
    case Client.commentVoteGetOwnActionStatus.Fulfilled:
      return {
        ...state,
        statusByCommentId: {
          ...state.statusByCommentId,
          ...action.meta.request.commentIds.reduce(
            (byCommentId, commentId) => {
              byCommentId[commentId] = Status.FULFILLED;
              return byCommentId;
            }, {}),
        },
        votesByCommentId: {
          ...state.votesByCommentId,
          ...action.payload.votesByCommentId,
        },
      };
    case Client.commentVoteUpdateActionStatus.Pending:
      return {
        ...state,
        statusByCommentId: {
          ...state.statusByCommentId,
          [action.meta.request.commentId]: Status.PENDING,
        },
        ...(action.meta.request.commentVoteUpdate.vote ? {
          votesByCommentId: {
            ...state.votesByCommentId,
            [action.meta.request.commentId]: action.meta.request.commentVoteUpdate.vote,
          },
        } : {}),
      };
    case Client.commentVoteUpdateActionStatus.Rejected:
      return {
        ...state,
        statusByCommentId: {
          ...state.statusByCommentId,
          [action.meta.request.commentId]: Status.REJECTED,
        },
        ...(action.meta.request.commentVoteUpdate.vote ? {
          votesByCommentId: {
            ...state.votesByCommentId,
            [action.meta.request.commentId]: Client.VoteOption.None,
          },
        } : {}),
      };
    case Client.commentCreateActionStatus.Fulfilled:
    case Client.commentVoteUpdateActionStatus.Fulfilled:
      const vote = action.type === Client.commentCreateActionStatus.Fulfilled
        ? action.payload.vote : action.payload.comment.vote;
      const commentId = action.type === Client.commentCreateActionStatus.Fulfilled
        ? action.payload.commentId : action.payload.comment.commentId;
      return {
        ...state,
        statusByCommentId: {
          ...state.statusByCommentId,
          [commentId]: Status.FULFILLED,
        },
        ...(vote ? {
          votesByCommentId: {
            ...state.votesByCommentId,
            [commentId]: vote,
          },
        } : {}),
      };
    case Client.ideaCommentSearchActionStatus.Fulfilled:
    case Admin.commentSearchAdminActionStatus.Fulfilled:
      const results = (action.payload.results as Client.CommentWithVote[]);
      return {
        ...state,
        statusByCommentId: {
          ...state.statusByCommentId,
          ...results.reduce(
            (byCommentId, comment) => {
              byCommentId[comment.commentId] = Status.FULFILLED;
              return byCommentId;
            }, {}),
        },
        votesByCommentId: {
          ...state.votesByCommentId,
          ...results.reduce(
            (votesByCommentId, comment) => {
              if (comment.vote) votesByCommentId[comment.commentId] = comment.vote;
              return votesByCommentId;
            }, {}),
        },
      };
    case Client.userLoginActionStatus.Fulfilled:
    case Client.userCreateActionStatus.Fulfilled:
    case Client.userLogoutActionStatus.Fulfilled:
    case Client.userDeleteActionStatus.Fulfilled:
      return { // Clear on login/logout
        statusByCommentId: {},
        votesByCommentId: {},
      };
    default:
      return state;
  }
}

export interface StateCredits {
  transactionSearch: {
    searchKey?: string;
    status?: Status;
    transactions?: Client.Transaction[];
    cursor?: string;
  };
  myBalance: {
    status?: Status;
    balance?: number;
  }
}
const stateCreditsDefault = {
  transactionSearch: {},
  myBalance: {},
};
function reducerCredits(state: StateCredits = stateCreditsDefault, action: AllActions): StateCredits {
  switch (action.type) {
    case Client.transactionSearchActionStatus.Pending:
      return {
        ...state,
        transactionSearch: {
          ...state.transactionSearch,
          status: Status.PENDING,
          searchKey: getSearchKey(action.meta.request.transactionSearch),
        },
      };
    case Client.transactionSearchActionStatus.Rejected:
      return {
        ...state,
        transactionSearch: {
          ...state.transactionSearch,
          status: Status.REJECTED,
          searchKey: getSearchKey(action.meta.request.transactionSearch),
        },
      };
    case Client.transactionSearchActionStatus.Fulfilled:
      return {
        ...state,
        transactionSearch: {
          status: Status.FULFILLED,
          searchKey: getSearchKey(action.meta.request.transactionSearch),
          transactions: (action.meta.request.cursor !== undefined && action.meta.request.cursor === state.transactionSearch.cursor)
            ? [ // Append results
              ...(state.transactionSearch.transactions || []),
              ...action.payload.results,
            ] : ( // Replace results
              action.payload.results
            ),
          cursor: action.payload.cursor,
        },
        myBalance: {
          status: Status.FULFILLED,
          balance: action.payload.balance.balance,
        },
      };
    case Client.ideaVoteUpdateActionStatus.Fulfilled:
      return {
        ...state,
        ...(action.payload.balance !== undefined ? {
          myBalance: {
            status: Status.FULFILLED,
            balance: action.payload.balance.balance,
          }
        } : {}),
        ...(action.payload.transaction !== undefined ? {
          transactionSearch: {},
        } : {}),
      };
    case Client.userBindActionStatus.Fulfilled:
    case Client.userBindSlugActionStatus.Fulfilled:
    case Client.configAndUserBindSlugActionStatus.Fulfilled:
      if (!action.payload.user) return state;
      return {
        ...state,
        myBalance: {
          status: Status.FULFILLED,
          balance: action.payload.user.balance,
        },
      };
    case Client.userLoginActionStatus.Fulfilled:
    case Client.userCreateActionStatus.Fulfilled:
      const balance = action.type === Client.userCreateActionStatus.Fulfilled
        ? action.payload.user?.balance : action.payload.balance;
      if (balance === undefined) return state;
      return {
        ...state,
        myBalance: {
          status: Status.FULFILLED,
          balance,
        },
      };
    case Client.userLogoutActionStatus.Fulfilled:
    case Client.userDeleteActionStatus.Fulfilled:
      return {
        ...state,
        transactionSearch: {}, // Clear on logout
        myBalance: {}, // Clear on logout
      };
    case Admin.userUpdateAdminActionStatus.Fulfilled:
      if (action.meta.action['isMe']) {
        return {
          ...state,
          transactionSearch: {}, // Clear instead of merging
          myBalance: {
            status: Status.FULFILLED,
            balance: action.payload.balance,
          },
        };
      }
      return state;
    default:
      return state;
  }
}

export interface StateNotifications {
  notificationSearch: {
    status?: Status;
    notifications?: Client.Notification[];
    cursor?: string;
  };
}
const stateNotificationsDefault = {
  notificationSearch: {},
};
function reducerNotifications(state: StateNotifications = stateNotificationsDefault, action: AllActions): StateNotifications {
  switch (action.type) {
    case Client.notificationSearchActionStatus.Pending:
      return {
        ...state,
        notificationSearch: {
          ...state.notificationSearch,
          status: Status.PENDING,
        },
      };
    case Client.notificationSearchActionStatus.Rejected:
      return {
        ...state,
        notificationSearch: {
          ...state.notificationSearch,
          status: Status.REJECTED,
        },
      };
    case Client.notificationSearchActionStatus.Fulfilled:
      return {
        ...state,
        notificationSearch: {
          status: Status.FULFILLED,
          notifications: (action.meta.request.cursor !== undefined && action.meta.request.cursor === state.notificationSearch.cursor)
            ? [ // Append results
              ...(state.notificationSearch.notifications || []),
              ...action.payload.results,
            ] : ( // Replace results
              action.payload.results
            ),
          cursor: action.payload.cursor,
        },
      };
    case Client.notificationClearActionStatus.Fulfilled:
      return {
        ...state,
        notificationSearch: {
          ...state.notificationSearch,
          notifications: state.notificationSearch.notifications === undefined ? undefined :
            state.notificationSearch.notifications.filter(n => n.notificationId !== action.meta.request.notificationId),
        },
      };
    case Client.notificationClearAllActionStatus.Fulfilled:
      return {
        ...state,
        notificationSearch: {
          ...state.notificationSearch,
          notifications: [],
        },
      };
    default:
      return state;
  }
}

export interface ReduxState {
  projectId: string | null;
  settings: StateSettings;
  conf: StateConf;
  drafts: StateDrafts;
  ideas: StateIdeas;
  comments: StateComments;
  users: StateUsers;
  votes: StateVotes;
  commentVotes: StateCommentVotes;
  credits: StateCredits;
  notifications: StateNotifications;
}
export const reducers = combineReducers({
  projectId: reducerProjectId,
  settings: reducerSettings,
  conf: reducerConf,
  drafts: reducerDrafts,
  ideas: reducerIdeas,
  comments: reducerComments,
  users: reducerUsers,
  votes: reducerVotes,
  commentVotes: reducerCommentVotes,
  credits: reducerCredits,
  notifications: reducerNotifications,
});
