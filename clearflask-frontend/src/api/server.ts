import React from 'react';
import * as Client from './client';
import * as Admin from './admin';
import * as ConfigEditor from '../common/config/configEditor';
import ServerMock from './serverMock';
import { isProd, detectEnv, Environment } from '../common/util/detectEnv';
import { Store, createStore, compose, applyMiddleware, combineReducers } from 'redux';
import thunk from 'redux-thunk';
import reduxPromiseMiddleware from 'redux-promise-middleware';
import randomUuid from '../common/util/uuid';
import debounce from '../common/util/debounce';

export enum Status {
  PENDING = 'PENDING',
  FULFILLED = 'FULFILLED',
  REJECTED = 'REJECTED',
}

export class Server {
  readonly projectId:string;
  readonly store:Store<ReduxState>;
  readonly mockServer:ServerMock|undefined;
  readonly dispatcherClient:Client.Dispatcher;
  readonly dispatcherAdmin:Promise<Admin.Dispatcher>;
  readonly errorSubscribers:((msg:string)=>void)[] = [];

  constructor(projectId:string, apiOverride?:Client.ApiInterface&Admin.ApiInterface) {
    this.projectId = projectId;

    if(isProd()) {
      this.store = createStore(
        reducers,
        Server.initialState(this.projectId),
        applyMiddleware(thunk, reduxPromiseMiddleware));
    } else {
      const composeEnhancers =
        typeof window === 'object' &&
        window['__REDUX_DEVTOOLS_EXTENSION_COMPOSE__']
          ? window['__REDUX_DEVTOOLS_EXTENSION_COMPOSE__']({/* OPTIONS */})
          : compose;
      const enhancer = composeEnhancers(
        applyMiddleware(thunk, reduxPromiseMiddleware),
      );
      this.store = createStore(
        reducers,
        Server.initialState(this.projectId),
        enhancer);
    }

    const dispatchers = Server.getDispatchers(this._dispatch.bind(this), apiOverride);
    this.dispatcherClient = dispatchers.client;
    this.dispatcherAdmin = dispatchers.adminPromise;
  }

  static getDispatchers(
    dispatcherDelegate:(msg:any)=>Promise<any>,
    apiOverride?:Client.ApiInterface&Admin.ApiInterface) {

    const apiConf:Client.ConfigurationParameters = {};
    if(!apiOverride && detectEnv() === Environment.DEVELOPMENT_FRONTEND) {
      apiOverride = ServerMock.get();
    } else if(detectEnv() === Environment.DEVELOPMENT_LOCAL) {
      apiConf.basePath = Client.BASE_PATH.replace(/api\.clearflask\.com/, 'localhost');
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

  static initialState(projectId:string):any {
    const state:ReduxState = {
      projectId: projectId,
      conf: {},
      ideas: stateIdeasDefault,
      comments: stateCommentsDefault,
      users: stateUsersDefault,
      votes: stateVotesDefault,
      credits: stateCreditsDefault,
    };
    return state;
  }

  getProjectId():string {
    return this.projectId;
  }

  getStore():Store<ReduxState> {
    return this.store;
  }

  dispatch():Client.Dispatcher {
    return this.dispatcherClient;
  }

  async dispatchAdmin():Promise<Admin.Dispatcher> {
    // TODO load as async webpack here. remove all references to Admin.*
    return this.dispatcherAdmin;
  }

  subscribeToChanges(editor:ConfigEditor.Editor, debounceWait:number|undefined = undefined) {
    if(debounceWait == undefined) {
      editor.subscribe(() => this.overrideConfig(editor.getConfig()));
    } else {
      const overrideConfigDebounced = debounce(this.overrideConfig.bind(this), debounceWait);
      editor.subscribe(() => overrideConfigDebounced(editor.getConfig()));
    }
  }

  subscribeToErrors(subscriber:((msg:string)=>void)) {
    this.errorSubscribers.push(subscriber);
  }

  overrideConfig(config:Admin.Config):void {
    const msg:Admin.configGetAdminActionFulfilled = {
      type: Admin.configGetAdminActionStatus.Fulfilled,
      meta: {
        action: Admin.Action.configGetAdmin,
        request: {
          projectId: this.projectId
        },
      },
      payload: { config: config, version: randomUuid() },
    };
    this._dispatch(msg);
  }

  async _dispatch(msg:any):Promise<any>{
    try {
    var result = await this.store.dispatch(msg);
    } catch(err) {
      // Error exceptions
      if((msg.type === Client.Action.userBind || msg.type === 'userBindAdmin') && err.status === 404) {
        throw err;
      }
      var errorMsg;
      if(err.json && err.json.userFacingMessage) {
        errorMsg = err.json.userFacingMessage;
      } else if(msg && msg.meta && msg.meta.action) {
        errorMsg = `Failed to process: ${msg.meta.action}`;
      } else {
        errorMsg = `Unknown error processing: ${JSON.stringify(msg)}`;
      }
      this.errorSubscribers.forEach(subscriber => subscriber && subscriber(errorMsg));
      throw err;
    }
    return result.value;
  }
}

export const getSearchKey = (search:Client.IdeaSearch):string => {
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

export const getTransactionSearchKey = (search:Client.TransactionSearch):string => {
  return [
    (search.filterTransactionTypes || []).join('.'),
    search.filterAmountMin || -1,
    search.filterAmountMax || -1,
    search.filterCreatedStart || '',
    search.filterCreatedEnd || '',
  ].join('-');
}

export interface StateConf {
  status?:Status;
  conf?:Client.Config;
  ver?:string;
}
function reducerConf(state:StateConf = {}, action:Client.Actions):StateConf {
  switch (action.type) {
    case Client.configGetActionStatus.Pending:
      return { status: Status.PENDING };
    // Quick hack to use Admin functionality without importing admin library to keep ourselves thin
    case 'configGetAdmin_FULFILLED' as Client.configGetActionStatus.Fulfilled:
    case Client.configGetActionStatus.Fulfilled:
      return {
        status: Status.FULFILLED,
        conf: action.payload.config,
        ver: action.payload.version,
      };
    case Client.configGetActionStatus.Rejected:
      return { status: Status.REJECTED };
    default:
      return state;
  }
}

export interface StateIdeas {
  byId:{[ideaId:string]:{
    status:Status;
    idea?:Client.Idea;
  }};
  // TODO eventually we should invalidate these searches over time
  bySearch:{[searchKey:string]:{
    status: Status,
    ideaIds?: string[],
    cursor?: string,
  }};
  maxFundAmountSeen:number;
}
const stateIdeasDefault = {
  byId: {},
  bySearch: {},
  maxFundAmountSeen: 0,
};
function reducerIdeas(state:StateIdeas = stateIdeasDefault, action:Client.Actions):StateIdeas {
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
    case Client.ideaSearchActionStatus.Pending:
      searchKey = getSearchKey(action.meta.request.search);
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
      searchKey = getSearchKey(action.meta.request.search);
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
      searchKey = getSearchKey(action.meta.request.search);
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
            ideaIds: (action.meta.request.cursor!== undefined && state.bySearch[searchKey] && action.meta.request.cursor === state.bySearch[searchKey].cursor)
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
          action.payload.results.reduce((max, idea) => Math.max(max, idea.funded || 0),  0) || 0,
          state.maxFundAmountSeen),
      };
    case Client.voteUpdateActionStatus.Pending:
    case Client.voteUpdateActionStatus.Rejected:
      // All of this below fakes the vote counts before server returns a real value
      // In case of rejection, it undoes the faking
      const isPending = action.type === Client.voteUpdateActionStatus.Pending;
      const idea = state.byId[action.meta.request.update.ideaId];
      if(!idea || !idea.idea) return state;
      state.byId[action.meta.request.update.ideaId] = idea;
      const previousVote = action.meta['previousVote'] || {};
      if(previousVote === undefined ) throw Error('voteUpdate expecting previousVote in extra meta, set to null if not present');
      const fromVote:Partial<Client.Vote>|Client.VoteUpdate = isPending ? previousVote : action.meta.request.update;
      const toVote:Partial<Client.Vote>|Client.VoteUpdate = isPending ? action.meta.request.update : previousVote;
      if(action.meta.request.update.fundAmount !== undefined) {
        const fundDiff = (toVote.fundAmount || 0) - (fromVote.fundAmount || 0);
        if(fundDiff !== 0) {
          idea.idea.funded = (idea.idea.funded || 0) + fundDiff;
          if(!toVote.fundAmount || !fromVote.fundAmount) {
            idea.idea.fundersCount = (idea.idea.fundersCount || 0) + (fundDiff > 0 ? 1 : -1);
          }
        }
      }
      if(action.meta.request.update.vote !== undefined) {
        const fromVoteVal = (fromVote.vote === Client.VoteVoteEnum.Upvote ? 1 : (fromVote.vote === Client.VoteVoteEnum.Downvote ? -1 : 0));
        const toVoteVal = (toVote.vote === Client.VoteVoteEnum.Upvote ? 1 : (toVote.vote === Client.VoteVoteEnum.Downvote ? -1 : 0));
        const voteDiff = toVoteVal - fromVoteVal;
        const votersCountDiff = Math.abs(toVoteVal) - Math.abs(fromVoteVal);
        if(voteDiff !== 0) {
          idea.idea.voteValue = (idea.idea.voteValue || 0) + voteDiff;
          if(!toVote.vote || !fromVote.vote) {
            idea.idea.votersCount = (idea.idea.votersCount || 0) + votersCountDiff;
          }
        }
      }
      if(action.meta.request.update.expressions !== undefined) {
        const addExpressions = isPending ? action.meta.request.update.expressions.add : action.meta.request.update.expressions.remove;
        const removeExpressions = isPending ? action.meta.request.update.expressions.remove : action.meta.request.update.expressions.add;
        const addedExpressions = new Set<string>();
        idea.idea.expressions = (idea.idea.expressions || []).map(expression => {
          const newExpression = {...expression};
          if(addExpressions && addExpressions.includes(expression.display)) {
            addedExpressions.add(expression.display);
            newExpression.count++;
          }
          if(removeExpressions && removeExpressions.includes(expression.display)) {
            expression.count--;
          }
          return newExpression;
        });
        if(addExpressions && addedExpressions.size !== addExpressions.length) {
          addExpressions.forEach(expression => {
            if(!addedExpressions.has(expression)) {
              idea.idea!.expressions!.push({
                display: expression,
                count: 1,
              });
            }
          })
        }
      }
      return {
        ...state,
        byId: {
          ...state.byId,
          [action.meta.request.update.ideaId]: {
            ...state.byId[action.meta.request.update.ideaId],
            idea: idea.idea,
          }
        }
      };
    case Client.voteUpdateActionStatus.Fulfilled:
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
  byId:{[commentId:string]:{
    status:Status;
    comment?:Client.Comment;
  }};
  byIdeaId:{[ideaId:string]:{
    status:Status;
    commentIds?:string[];
    cursor?:string;
  }};
}
const stateCommentsDefault = {
  byId: {},
  byIdeaId: {},
};
function reducerComments(state:StateComments = stateCommentsDefault, action:Client.Actions):StateComments {
  switch (action.type) {
    case Client.commentListActionStatus.Pending:
      return {
        ...state,
        byIdeaId: {
          ...state.byIdeaId,
          [action.meta.request.ideaId]: { status: Status.PENDING }
        },
      };
    case Client.commentListActionStatus.Rejected:
      return {
        ...state,
        byIdeaId: {
          ...state.byIdeaId,
          [action.meta.request.ideaId]: { status: Status.REJECTED }
        },
      };
    case Client.commentDeleteActionStatus.Fulfilled:
      return {
        ...state,
        byId: {
          ...state.byId,
          [action.meta.request.commentId]: {
            status: Status.FULFILLED,
            comment: action.payload,
          }
        },
      };
    case Client.commentListActionStatus.Fulfilled:
      return {
        ...state,
        byIdeaId: {
          ...state.byIdeaId,
          [action.meta.request.ideaId]: {
            commentIds: action.payload.results.map(comment => comment.commentId),
            cursor: action.payload.cursor,
            status: Status.FULFILLED,
          }
        },
        byId: {
          ...state.byId,
          ...action.payload.results.reduce(
            (commentsById, comment) => {
              commentsById[comment.commentId] = {
                comment: {
                  ...comment,
                  author: undefined, // Change CommentWithAuthor to just Comment
                },
                status: Status.FULFILLED,
              };
              return commentsById;
            }, {}),
        },
      };
    default:
      return state;
  }
}

export interface StateUsers {
  byId:{[userId:string]:{
    status:Status;
    user?:Client.User;
  }};
  loggedIn: {
    status?:Status;
    user?:Client.UserMe,
  };
}
const stateUsersDefault = {
  byId: {},
  loggedIn: {},
};
function reducerUsers(state:StateUsers = stateUsersDefault, action:Client.Actions):StateUsers {
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
    case Client.ideaSearchActionStatus.Fulfilled:
      return {
        ...state,
        byId: {
          ...state.byId,
          ...action.payload.results.reduce(
            (usersById, idea) => {
              usersById[idea.author.userId] = {
                user: idea.author,
                status: Status.FULFILLED,
              };
              return usersById;
            }, {}),
        }
      };
    case Client.commentListActionStatus.Fulfilled:
      return {
        ...state,
        byId: {
          ...state.byId,
          ...action.payload.results.reduce(
            (usersById, comment) => {
              if(comment.author) {
                usersById[comment.author.userId] = {
                  user: comment.author,
                  status: Status.FULFILLED,
                };
              }
              return usersById;
            }, {}),
        }
      };
    case Client.ideaGetActionStatus.Fulfilled:
      return {
        ...state,
        byId: {
          ...state.byId,
          [action.payload.author.userId]: {
            user: action.payload.author,
            status: Status.FULFILLED,
          }
        }
      };
    case Client.userCreateActionStatus.Fulfilled:
    case Client.userSsoCreateOrLoginActionStatus.Fulfilled:
    case Client.userLoginActionStatus.Fulfilled:
    case Client.userUpdateActionStatus.Fulfilled:
    case Client.userBindActionStatus.Fulfilled:
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
    case Client.userLogoutActionStatus.Fulfilled:
    case Client.userDeleteActionStatus.Fulfilled:
      if(!state.loggedIn.user) return state;
      const {[state.loggedIn.user.userId]:removedUser, ...byIdWithout} = state.byId;
      return {
        ...state,
        byId: byIdWithout,
        loggedIn: {},
      };
    default:
      return state;
  }
}

export interface StateVotes {
  byIdeaId:{[ideaId:string]:{
    status:Status;
    vote?:Client.Vote;
  }};
}
const stateVotesDefault = {
  byIdeaId: {},
};
function reducerVotes(state:StateVotes = stateVotesDefault, action:Client.Actions):StateVotes {
  switch (action.type) {
    case Client.voteGetOwnActionStatus.Pending:
      return {
        ...state,
        byIdeaId: {
          ...state.byIdeaId,
          ...action.meta.request.ideaIds.reduce(
            (byIdeaId, ideaId) => {
              byIdeaId[ideaId] = {
                status: Status.PENDING,
              };
              return byIdeaId;
            }, {}),
        },
      };
    case Client.voteGetOwnActionStatus.Rejected:
      return {
        ...state,
        byIdeaId: {
          ...state.byIdeaId,
          ...action.meta.request.ideaIds.reduce(
            (byIdeaId, ideaId) => {
              byIdeaId[ideaId] = {
                status: Status.REJECTED,
              };
              return byIdeaId;
            }, {}),
        },
      };
    case Client.voteGetOwnActionStatus.Fulfilled:
      return {
        ...state,
        byIdeaId: {
          ...state.byIdeaId,
          ...action.meta.request.ideaIds.reduce(
            (byIdeaId, ideaId) => {
              byIdeaId[ideaId] = {
                status: Status.FULFILLED,
              };
              return byIdeaId;
            }, {}),
          ...action.payload.results.reduce(
            (byIdeaId, vote) => {
              byIdeaId[vote.ideaId] = {
                status: Status.FULFILLED,
                vote: vote,
              };
              return byIdeaId;
            }, {}),
        },
      };
    case Client.voteUpdateActionStatus.Pending:
      return {
        ...state,
        byIdeaId: {
          ...state.byIdeaId,
          [action.meta.request.update.ideaId]: {
            ...state.byIdeaId[action.meta.request.update.ideaId],
            ...(action.meta['previousVote'] !== undefined // Fake vote assuming server will accept it
              ? {vote: {
                ...(state.byIdeaId[action.meta.request.update.ideaId] ? state.byIdeaId[action.meta.request.update.ideaId].vote : {}),
                ...(action.meta.request.update.fundAmount ? {fundAmount: action.meta.request.update.fundAmount} : {}),
                ...(action.meta.request.update.vote ? {fundAmount: action.meta.request.update.vote} : {}),
                ...(action.meta.request.update.expressions ? {expressions: [...new Set<string>([
                  ...(state.byIdeaId[action.meta.request.update.ideaId] && state.byIdeaId[action.meta.request.update.ideaId].vote && state.byIdeaId[action.meta.request.update.ideaId].vote!.expressions || []),
                  ...(action.meta.request.update.expressions && action.meta.request.update.expressions.add || [])
                ])].filter(e => !action.meta.request.update.expressions || !action.meta.request.update.expressions.remove || !action.meta.request.update.expressions.remove.includes(e) )} : {}),
              } as Client.Vote}
              : {}),
            status: Status.PENDING,
          },
        },
      };
    case Client.voteUpdateActionStatus.Rejected:
      return {
        ...state,
        byIdeaId: {
          ...state.byIdeaId,
          [action.meta.request.update.ideaId]: {
            ...state.byIdeaId[action.meta.request.update.ideaId],
            ...(action.meta['previousVote'] !== undefined ? {vote: action.meta['previousVote']} : {}), // Undo fake vote
            status: Status.REJECTED,
          },
        },
      };
    case Client.voteUpdateActionStatus.Fulfilled:
      return {
        ...state,
        byIdeaId: {
          ...state.byIdeaId,
          [action.payload.idea.ideaId]: {
            status: Status.FULFILLED,
            vote: action.payload.vote,
          },
        },
      };
    case Client.ideaGetActionStatus.Fulfilled:
      return {
        ...state,
        byIdeaId: {
          ...state.byIdeaId,
          [action.payload.ideaId]: {
            status: Status.FULFILLED,
            vote: action.payload.vote,
          },
        },
      };
    case Client.ideaSearchActionStatus.Fulfilled:
      return {
        ...state,
        byIdeaId: {
          ...state.byIdeaId,
          ...action.payload.results.reduce(
            (byIdeaId, idea) => {
              byIdeaId[idea.ideaId] = {
                status: Status.FULFILLED,
                vote: idea.vote,
              };
              return byIdeaId;
            }, {}),
        },
      };
    case Client.userSsoCreateOrLoginActionStatus.Fulfilled:
    case Client.userCreateActionStatus.Fulfilled:
    case Client.userLogoutActionStatus.Fulfilled:
    case Client.userDeleteActionStatus.Fulfilled:
      return {
        ...state,
        byIdeaId: {}, // Clear on login/logout
      };
    default:
      return state;
  }
}

export interface StateCredits {
  transactionSearch:{
    searchKey?:string;
    status?:Status;
    transactions?:Client.Transaction[];
    cursor?:string;
  };
  myBalance:{
    status?:Status;
    balance?:number;
  }
}
const stateCreditsDefault = {
  transactionSearch: {},
  myBalance: {},
};
function reducerCredits(state:StateCredits = stateCreditsDefault, action:Client.Actions):StateCredits {
  switch (action.type) {
    case Client.transactionSearchActionStatus.Pending:
      return {
        ...state,
        transactionSearch: {
          ...state.transactionSearch,
          status: Status.PENDING,
          searchKey: getTransactionSearchKey(action.meta.request.search),
        },
      };
    case Client.transactionSearchActionStatus.Rejected:
      return {
        ...state,
        transactionSearch: {
          ...state.transactionSearch,
          status: Status.REJECTED,
          searchKey: getTransactionSearchKey(action.meta.request.search),
        },
      };
    case Client.transactionSearchActionStatus.Fulfilled:
      return {
        ...state,
        transactionSearch: {
          status: Status.FULFILLED,
          searchKey: getTransactionSearchKey(action.meta.request.search),
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
    case Client.voteUpdateActionStatus.Fulfilled:
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
    case Client.userSsoCreateOrLoginActionStatus.Fulfilled:
    case Client.userLoginActionStatus.Fulfilled:
    case Client.userBindActionStatus.Fulfilled:
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

export interface ReduxState {
  projectId:string;
  conf:StateConf;
  ideas:StateIdeas;
  comments:StateComments;
  users:StateUsers;
  votes:StateVotes;
  credits:StateCredits;
}
export const reducers = combineReducers({
  projectId: (projectId?:string) => (projectId ? projectId : 'unknown'),
  conf: reducerConf,
  ideas: reducerIdeas,
  comments: reducerComments,
  users: reducerUsers,
  votes: reducerVotes,
  credits: reducerCredits
});
