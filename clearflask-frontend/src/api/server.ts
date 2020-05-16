import { applyMiddleware, combineReducers, compose, createStore, Store } from 'redux';
import reduxPromiseMiddleware from 'redux-promise-middleware';
import thunk from 'redux-thunk';
import * as ConfigEditor from '../common/config/configEditor';
import debounce from '../common/util/debounce';
import { detectEnv, Environment, isProd } from '../common/util/detectEnv';
import randomUuid from '../common/util/uuid';
import * as Admin from './admin';
import * as Client from './client';
import ServerAdmin from './serverAdmin';
import ServerMock from './serverMock';

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
  readonly errorSubscribers: ((errorMsg: string, isUserFacing: boolean) => void)[] = [];
  challengeSubscriber?: ((challenge: string) => Promise<string | undefined>);

  constructor(projectId: string, settings?: StateSettings, apiOverride?: Client.ApiInterface & Admin.ApiInterface, versionedConfig?: Admin.VersionedConfigAdmin) {
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
      Server.initialState(projectId, settings, versionedConfig),
      storeMiddleware);

    const dispatchers = Server.getDispatchers(
      msg => ServerAdmin._dispatch(msg, this.store, this.errorSubscribers, this.challengeSubscriber),
      apiOverride);
    this.dispatcherClient = dispatchers.client;
    this.dispatcherAdmin = dispatchers.adminPromise;
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

  static initialState(projectId: string, settings?: StateSettings, versionedConfig?: Admin.VersionedConfigAdmin): any {
    const state: ReduxState = {
      projectId: projectId,
      settings: settings || stateSettingsDefault,
      conf: versionedConfig ? {
        status: Status.FULFILLED, conf: versionedConfig.config, ver: versionedConfig.version,
      } : {},
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
    return this.store.getState().projectId;
  }

  getStore(): Store<ReduxState, AllActions> {
    return this.store;
  }

  isAdminLoggedIn(): boolean {
    const state = this.store.getState();
    return state.users.loggedIn.status === Status.FULFILLED
      && !!state.users.loggedIn.user
      && !!state.users.loggedIn.user.isAdmin;
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

  subscribeToErrors(subscriber: ((errorMsg: string, isUserFacing: boolean) => void)) {
    this.errorSubscribers.push(subscriber);
  }

  subscribeChallenger(subscriber: ((challenge: string) => Promise<string | undefined>)) {
    this.challengeSubscriber = subscriber;
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
    ServerAdmin._dispatch(msg, this.store, this.errorSubscribers, this.challengeSubscriber);
  }
}

export const getSearchKey = (search: Client.IdeaSearch): string => {
  return [
    (search.filterCategoryIds || []).join('.'),
    (search.filterStatusIds || []).join('.'),
    (search.filterTagIds || []).join('.'),
    search.limit || -1,
    search.sortBy,
    search.searchText || '',
    search.fundedByMeAndActive ? 't' : 'f',
  ].join('-');
}

export const getTransactionSearchKey = (search: Client.TransactionSearch): string => {
  return [
    (search.filterTransactionTypes || []).join('.'),
    search.filterAmountMin || -1,
    search.filterAmountMax || -1,
    search.filterCreatedStart || '',
    search.filterCreatedEnd || '',
  ].join('-');
}

function reducerProjectId(projectId: string = 'unknown', action: AllActions): string {
  switch (action.type) {
    case Admin.configGetAdminActionStatus.Fulfilled:
      return (action as any).payload.config.projectId || projectId;
    case Client.configGetAndUserBindActionStatus.Fulfilled:
      return action.payload.config.config.projectId || projectId;
    default:
      return projectId;
  }
}

export const cssBlurry = {
  blurry: {
    color: 'transparent',
    textShadow: '0px 0px 12px rgba(0,0,0,0.8)',
  }
};
interface updateSettingsAction {
  type: 'updateSettings';
  payload: Partial<StateSettings>;
}
export interface StateSettings {
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
  };
  demoSearchAnimate?: Array<{
    term: string;
    update: Partial<Client.IdeaSearch>;
  }>;
  demoMenuAnimate?: Array<{
    path: string;
  }>;
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
  ver?: string;
}
function reducerConf(state: StateConf = {}, action: AllActions): StateConf {
  switch (action.type) {
    case Client.configGetAndUserBindActionStatus.Pending:
      return { status: Status.PENDING };
    case Admin.configGetAdminActionStatus.Fulfilled:
      return {
        status: Status.FULFILLED,
        conf: (action as any).payload.config,
        ver: (action as any).payload.version,
      };
    case Client.configGetAndUserBindActionStatus.Fulfilled:
      return {
        status: Status.FULFILLED,
        conf: action.payload.config.config,
        ver: action.payload.config.version,
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
}
const stateCommentsDefault = {
  byId: {},
  byIdeaIdOrParentCommentId: {},
};
function reducerComments(state: StateComments = stateCommentsDefault, action: AllActions): StateComments {
  switch (action.type) {
    case Client.commentListActionStatus.Pending:
      return {
        ...state,
        byIdeaIdOrParentCommentId: {
          ...state.byIdeaIdOrParentCommentId,
          [action.meta.request.commentSearch.parentCommentId || action.meta.request.ideaId]: {
            ...state.byIdeaIdOrParentCommentId[action.meta.request.commentSearch.parentCommentId || action.meta.request.ideaId],
            status: Status.PENDING
          }
        },
      };
    case Client.commentListActionStatus.Rejected:
      return {
        ...state,
        byIdeaIdOrParentCommentId: {
          ...state.byIdeaIdOrParentCommentId,
          [action.meta.request.commentSearch.parentCommentId || action.meta.request.ideaId]: {
            ...state.byIdeaIdOrParentCommentId[action.meta.request.commentSearch.parentCommentId || action.meta.request.ideaId],
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
    case Client.commentListActionStatus.Fulfilled:
      // First set state
      var newState = {
        ...state,
        byIdeaIdOrParentCommentId: {
          ...state.byIdeaIdOrParentCommentId,
          [action.meta.request.commentSearch.parentCommentId || action.meta.request.ideaId]: {
            ...state.byIdeaIdOrParentCommentId[action.meta.request.commentSearch.parentCommentId || action.meta.request.ideaId],
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
    case Client.userGetActionStatus.Pending:
      return {
        ...state,
        byId: {
          ...state.byId,
          [action.meta.request.userId]: { status: Status.PENDING }
        }
      };
    case Client.userGetActionStatus.Rejected:
      return {
        ...state,
        byId: {
          ...state.byId,
          [action.meta.request.userId]: { status: Status.REJECTED }
        }
      };
    case Client.userGetActionStatus.Fulfilled:
    case Admin.userUpdateAdminActionStatus.Fulfilled:
      return {
        ...state,
        byId: {
          ...state.byId,
          [action.payload.userId]: {
            user: action.payload,
            status: Status.FULFILLED,
          }
        }
      };
    case Client.commentListActionStatus.Fulfilled:
      return {
        ...state,
        byId: {
          ...state.byId,
          ...action.payload.results.reduce(
            (usersById, comment) => {
              if (comment.author) {
                usersById[comment.author.userId] = {
                  user: comment.author,
                  status: Status.FULFILLED,
                };
              }
              return usersById;
            }, {}),
        }
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
    case Client.userSsoCreateOrLoginActionStatus.Fulfilled:
    case Client.userLoginActionStatus.Fulfilled:
    case Client.userUpdateActionStatus.Fulfilled:
      return {
        ...state,
        byId: {
          ...state.byId,
          [action.payload.userId]: {
            user: action.payload,
            status: Status.FULFILLED,
          }
        },
        loggedIn: {
          user: action.payload,
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
    case Client.userSsoCreateOrLoginActionStatus.Fulfilled:
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
    case Client.commentListActionStatus.Fulfilled:
      return {
        ...state,
        statusByCommentId: {
          ...state.statusByCommentId,
          ...action.payload.results.reduce(
            (byCommentId, comment) => {
              byCommentId[comment.commentId] = Status.FULFILLED;
              return byCommentId;
            }, {}),
        },
        votesByCommentId: {
          ...state.votesByCommentId,
          ...action.payload.results.reduce(
            (votesByCommentId, comment) => {
              if (comment.vote) votesByCommentId[comment.commentId] = comment.vote;
              return votesByCommentId;
            }, {}),
        },
      };
    case Client.userSsoCreateOrLoginActionStatus.Fulfilled:
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
          searchKey: getTransactionSearchKey(action.meta.request.transactionSearch),
        },
      };
    case Client.transactionSearchActionStatus.Rejected:
      return {
        ...state,
        transactionSearch: {
          ...state.transactionSearch,
          status: Status.REJECTED,
          searchKey: getTransactionSearchKey(action.meta.request.transactionSearch),
        },
      };
    case Client.transactionSearchActionStatus.Fulfilled:
      return {
        ...state,
        transactionSearch: {
          status: Status.FULFILLED,
          searchKey: getTransactionSearchKey(action.meta.request.transactionSearch),
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
    case Client.userSsoCreateOrLoginActionStatus.Fulfilled:
    case Client.userLoginActionStatus.Fulfilled:
    case Client.userCreateActionStatus.Fulfilled:
      return {
        ...state,
        myBalance: {
          status: Status.FULFILLED,
          balance: action.payload.balance,
        },
      };
    case Client.userDeleteActionStatus.Fulfilled:
    case Client.userLogoutActionStatus.Fulfilled:
      return {
        ...state,
        myBalance: {}, // Clear on logout
      };
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
  projectId: string;
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
