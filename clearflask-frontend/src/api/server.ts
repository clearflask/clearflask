import { applyMiddleware, combineReducers, compose, createStore, Store } from 'redux';
import reduxPromiseMiddleware from 'redux-promise-middleware';
import thunk from 'redux-thunk';
import * as ConfigEditor from '../common/config/configEditor';
import debounce from '../common/util/debounce';
import { detectEnv, Environment, isProd } from '../common/util/detectEnv';
import randomUuid from '../common/util/uuid';
import * as Admin from './admin';
import * as Client from './client';
import ServerMock from './serverMock';

export type Unsubscribe = () => void;
export type ErrorSubscriber = ((errorMsg: string, isUserFacing: boolean) => void);
export type ErrorSubscribers = { [subscriberId: string]: ErrorSubscriber };
export const errorSubscribers: ErrorSubscribers = {}
export type ChallengeSubscriber = ((challenge: string) => Promise<string | undefined>);
export type ChallengeSubscribers = { [subscriberId: string]: ChallengeSubscriber };
export const challengeSubscribers: ChallengeSubscribers = {}

export enum Status {
  PENDING = 'PENDING',
  FULFILLED = 'FULFILLED',
  REJECTED = 'REJECTED',
}

type AllActions = Admin.Actions | Client.Actions | updateSettingsAction;

export class Server {
  readonly store: Store<ReduxState, AllActions>;
  readonly mockServer: ServerMock | undefined;
  readonly dispatcherClient: Client.Dispatcher;
  readonly dispatcherAdmin: Promise<Admin.Dispatcher>;

  constructor(projectId?: string, settings?: StateSettings, apiOverride?: Client.ApiInterface & Admin.ApiInterface) {
    var storeMiddleware = applyMiddleware(thunk, reduxPromiseMiddleware);
    if (!isProd()) {
      const composeEnhancers =
        typeof window === 'object' &&
          window['__REDUX_DEVTOOLS_EXTENSION_COMPOSE__']
          ? window['__REDUX_DEVTOOLS_EXTENSION_COMPOSE__']({
            serialize: true,
          })
          : compose;
      storeMiddleware = composeEnhancers(storeMiddleware);
    }
    this.store = createStore(
      reducers,
      Server.initialState(projectId, settings),
      storeMiddleware);

    const dispatchers = Server.getDispatchers(
      msg => Server._dispatch(msg, this.store),
      apiOverride);
    this.dispatcherClient = dispatchers.client;
    this.dispatcherAdmin = dispatchers.adminPromise;
  }

  static async _dispatch(msg: any, store: Store<any, any>): Promise<any> {
    try {
      var result = await store.dispatch(msg);
    } catch (response) {
      console.log("Dispatch error: ", msg, response);
      console.trace();
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

  static getDispatchers(
    dispatcherDelegate: (msg: any) => Promise<any>,
    apiOverride?: Client.ApiInterface & Admin.ApiInterface) {

    const apiConf: Client.ConfigurationParameters = {};
    if (!apiOverride && detectEnv() === Environment.DEVELOPMENT_FRONTEND) {
      apiOverride = ServerMock.get();
    } else {
      apiConf.basePath = Client.BASE_PATH.replace(/https:\/\/clearflask\.com/, `${window.location.protocol}//${window.location.host}`);
    }

    const dispatcherClient = new Client.Dispatcher(dispatcherDelegate,
      new Client.Api(new Client.Configuration(apiConf), apiOverride));
    const dispatcherAdminPromise = Promise.resolve(new Admin.Dispatcher(dispatcherDelegate,
      new Admin.Api(new Admin.Configuration(apiConf), apiOverride)));
    return {
      client: dispatcherClient,
      adminPromise: dispatcherAdminPromise,
    };
  }

  static initialState(projectId?: string, settings?: StateSettings): any {
    const state: ReduxState = {
      projectId: projectId || stateProjectIdDefault,
      settings: settings || stateSettingsDefault,
      conf: stateConfDefault,
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

  getProjectId(): string {
    return this.store.getState().projectId!;
  }

  getStore(): Store<ReduxState, AllActions> {
    return this.store;
  }

  isModLoggedIn(): boolean {
    const state = this.store.getState();
    return state.users.loggedIn.status === Status.FULFILLED
      && !!state.users.loggedIn.user
      && !!state.users.loggedIn.user.isMod;
  }

  dispatch(): Client.Dispatcher {
    return this.dispatcherClient;
  }

  async dispatchAdmin(): Promise<Admin.Dispatcher> {
    // TODO load as async webpack here. remove all references to Admin.*
    return this.dispatcherAdmin;
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

export const getSearchKey = (search: object): string => {
  const keys = Object.keys(search);
  // Consistently return the same key by sorting by keys
  keys.sort();
  return JSON.stringify(keys.map(key => key + '=' + search[key]));
}

const stateProjectIdDefault = null;
function reducerProjectId(projectId: string | null = stateProjectIdDefault, action: AllActions): string | null {
  switch (action.type) {
    case Admin.configGetAdminActionStatus.Fulfilled:
      return action.payload.config.projectId || projectId;
    case Client.configGetAndUserBindActionStatus.Fulfilled:
      return action.payload.config?.config.projectId || projectId;
    default:
      return projectId;
  }
}

export const cssBlurry = {
  blurry: {
    color: 'transparent',
    textShadow: '0px 0px 6px rgba(0,0,0,0.8)',
  }
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
}
const stateConfDefault = {};
function reducerConf(state: StateConf = stateConfDefault, action: AllActions): StateConf {
  switch (action.type) {
    case Client.configGetAndUserBindActionStatus.Pending:
      return { status: Status.PENDING };
    case Admin.projectCreateAdminActionStatus.Fulfilled:
    case Admin.configGetAdminActionStatus.Fulfilled:
      const versionedConfigAdmin = action.type === Admin.projectCreateAdminActionStatus.Fulfilled
        ? action.payload.config
        : action.payload;
      return {
        status: Status.FULFILLED,
        conf: versionedConfigAdmin.config,
        ver: versionedConfigAdmin.version,
      };
    case Client.configGetAndUserBindActionStatus.Fulfilled:
      return {
        status: Status.FULFILLED,
        conf: action.payload.config?.config,
        onboardBefore: action.payload.onboardBefore,
        ver: action.payload.config?.version,
      };
    case Client.configGetAndUserBindActionStatus.Rejected:
      return { status: Status.REJECTED };
    default:
      return state;
  }
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
          [action.meta.request.ideaId]: { status: Status.PENDING }
        }
      };
    case Client.ideaGetActionStatus.Rejected:
      return {
        ...state,
        byId: {
          ...state.byId,
          [action.meta.request.ideaId]: { status: Status.REJECTED }
        }
      };
    case Admin.ideaCreateAdminActionStatus.Fulfilled:
    case Client.ideaCreateActionStatus.Fulfilled:
    case Client.ideaGetActionStatus.Fulfilled:
      return {
        ...state,
        byId: {
          ...state.byId,
          [action.payload.ideaId]: {
            idea: action.payload,
            status: Status.FULFILLED,
          }
        },
        maxFundAmountSeen: Math.max(action.payload.funded || 0, state.maxFundAmountSeen),
      };
    case Client.ideaDeleteActionStatus.Fulfilled:
    case Admin.ideaDeleteAdminActionStatus.Fulfilled:
      const { [action.meta.request.ideaId]: removedIdea, ...byIdWithoutDeleted } = state.byId;
      return {
        ...state,
        byId: byIdWithoutDeleted,
      };
    case Admin.ideaUpdateAdminActionStatus.Fulfilled:
    case Client.ideaUpdateActionStatus.Fulfilled:
      return {
        ...state,
        byId: {
          ...state.byId,
          [action.payload.ideaId]: {
            idea: action.payload,
            status: Status.FULFILLED,
          }
        },
        maxFundAmountSeen: Math.max(action.payload.funded || 0, state.maxFundAmountSeen),
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
    case Client.ideaSearchActionStatus.Pending:
      searchKey = getSearchKey(action.meta.request.ideaSearch);
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
      searchKey = getSearchKey(action.meta.request.ideaSearch);
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
      searchKey = getSearchKey(action.meta.request.ideaSearch);
      return {
        ...state,
        byId: {
          ...state.byId,
          ...action.payload.results.reduce(
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
                ...action.payload.results.map(idea => idea.ideaId),
              ] : ( // Replace results if cursor doesn't match
                action.payload.results.map(idea => idea.ideaId)
              ),
            cursor: action.payload.cursor,
          }
        },
        maxFundAmountSeen: Math.max(
          action.payload.results.reduce((max, idea) => Math.max(max, idea.funded || 0), 0) || 0,
          state.maxFundAmountSeen),
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
        [comment.parentCommentId || comment.ideaId]: {
          ...newState.byIdeaIdOrParentCommentId[comment.parentCommentId || comment.ideaId],
          status: Status.FULFILLED,
          commentIds: new Set([
            ...(newState.byIdeaIdOrParentCommentId[comment.parentCommentId || comment.ideaId]
              ? newState.byIdeaIdOrParentCommentId[comment.parentCommentId || comment.ideaId].commentIds || []
              : []),
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
    default:
      return state;
  }
}

export interface StateUsers {
  byId: {
    [userId: string]: {
      status: Status;
      user?: Client.User;
    }
  };
  loggedIn: {
    status?: Status;
    user?: Client.UserMe,
  };
}
const stateUsersDefault = {
  byId: {},
  loggedIn: {},
};
function reducerUsers(state: StateUsers = stateUsersDefault, action: AllActions): StateUsers {
  switch (action.type) {
    case Admin.userSearchAdminActionStatus.Fulfilled:
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
        }
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
    case Client.userBindActionStatus.Fulfilled:
    case Client.configGetAndUserBindActionStatus.Fulfilled:
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
    case Admin.userLoginAdminActionStatus.Fulfilled:
    case Client.userUpdateActionStatus.Fulfilled:
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
    case Admin.userLoginAdminActionStatus.Fulfilled:
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
    case Admin.userLoginAdminActionStatus.Fulfilled:
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
    case Client.configGetAndUserBindActionStatus.Fulfilled:
      if (!action.payload.user) return state;
      return {
        ...state,
        myBalance: {
          status: Status.FULFILLED,
          balance: action.payload.user.balance,
        },
      };
    case Client.userLoginActionStatus.Fulfilled:
    case Admin.userLoginAdminActionStatus.Fulfilled:
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
  ideas: reducerIdeas,
  comments: reducerComments,
  users: reducerUsers,
  votes: reducerVotes,
  commentVotes: reducerCommentVotes,
  credits: reducerCredits,
  notifications: reducerNotifications,
});
