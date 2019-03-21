import React from 'react';
import { combineReducers, Store } from "redux";
import {
  Api,
  BASE_PATH,
  Configuration,
  ApiInterface,
  Conf,
  GetCommentsRequest,
  GetTransactionsRequest,
  Transaction,
  VoteIdeaResult,
  VoteIdeaRequest,
  CreateIdeaRequest,
  DeleteIdeaRequest,
  GetIdeaRequest,
  GetIdeasRequest,
  GetUserRequest,
  User,
  Ideas,
  Idea,
  Comment,
} from './client';
import DataMock from './dataMock';
import { getSearchKey } from './dataUtil';

export enum Action {
  // ConfigApi
  getConfig = 'getConfig',

  // IdeaApi
  createIdea = 'createIdea',
  deleteIdea = 'deleteIdea',
  getIdea = 'getIdea',
  getIdeas = 'getIdeas',

  // CommentApi
  getComments = 'getComments',
  
  // CreditApi
  getTransactions = 'getTransactions',
  voteIdea = 'voteIdea',

  // getUserApi
  getUser = 'getUser',
}

export enum Status {
  PENDING = 'PENDING',
  FULFILLED = 'FULFILLED',
  REJECTED = 'REJECTED',
}

export class Server implements ApiInterface {
  apis: any;
  readonly apiDelegate:Api;
  readonly store:Store

  constructor(store:Store, projectName) {
    this.store = store;

    if(projectName === 'demo') {
      // In-memory demo
      const mockServer = new DataMock().mockServerData();
      this.apiDelegate = new Api(new Configuration(), mockServer);
    } else {
      // Production
      this.apiDelegate = new Api(new Configuration({
        basePath: BASE_PATH.replace(/projectId/, projectName),
      }));
    }
  }

  static initialState():any {
    // TODO
    // var accountInfo = TokenManager.getInstance().getAccountInfo();
    // if(!accountInfo) {
    //   return undefined;
    // }
    // var initialAuthAction = {
    //   type: `${AuthAction.REGISTER_USER}_${Status.FULFILLED}`,
    //   payload: accountInfo,
    // };
    // return reducers(undefined, initialAuthAction);
  }

  getComments(requestParameters: GetCommentsRequest): Promise<Array<Comment>> {
    throw new Error("Method not implemented.");
  }
  getConfig(): Promise<Conf> {
    return this._dispatch({
      type: Action.getConfig,
      payload: this.apiDelegate.getConfigApi().getConfig(),
    });
  }
  getTransactions(requestParameters: GetTransactionsRequest): Promise<Array<Transaction>> {
    throw new Error("Method not implemented.");
  }
  voteIdea(requestParameters: VoteIdeaRequest): Promise<VoteIdeaResult> {
    throw new Error("Method not implemented.");
  }
  createIdea(requestParameters: CreateIdeaRequest): Promise<Idea> {
    throw new Error("Method not implemented.");
  }
  deleteIdea(requestParameters: DeleteIdeaRequest): Promise<void> {
    throw new Error("Method not implemented.");
  }
  getIdea(requestParameters: GetIdeaRequest): Promise<Idea> {
    return this._dispatch({
      type: Action.getIdea,
      meta: { ideaId: requestParameters.ideaId },
      payload: this.apiDelegate.getIdeaApi().getIdea(requestParameters),
    });
  }
  getIdeas(requestParameters: GetIdeasRequest): Promise<Ideas> {
    return this._dispatch({
      type: Action.getIdeas,
      meta: { searchKey: getSearchKey(requestParameters) },
      payload: this.apiDelegate.getIdeaApi().getIdeas(requestParameters),
    });
  }
  getUser(requestParameters: GetUserRequest): Promise<User> {
    throw new Error("Method not implemented.");
  }

  async _dispatch(msg:any):Promise<any>{
    var result = await this.store.dispatch(msg);
    return result.value;
  }
}

export interface StateConf {
  status?:Status;
  conf?:Conf;
}
function reducerConf(state:StateConf = {}, action):StateConf {
  switch (action.type) {
    case `${Action.getConfig}_${Status.PENDING}`:
      return { status: Status.PENDING };
    case `${Action.getConfig}_${Status.FULFILLED}`:
      return {
        status: Status.FULFILLED,
        conf: action.payload,
      };
    case `${Action.getConfig}_${Status.REJECTED}`:
      return { status: Status.REJECTED };
    default:
      return state;
  }
}

export interface StateIdeas {
  byId:{[ideaId:string]:{
    status:Status;
    idea:Idea;
  }};
  bySearch:{[searchKey:string]:{
    status: Status,
    ideaIds?: string[],
    cursor?: string,
  }};
}
function reducerIdeas(state:StateIdeas = {
  byId: {},
  bySearch: {},
}, action):StateIdeas {
  switch (action.type) {
    case `${Action.getIdea}_${Status.PENDING}`:
      return {
        ...state,
        byId: {
          ...state.byId,
          [action.meta.ideaId]: { status: Status.PENDING }
        }
      };
    case `${Action.getIdea}_${Status.REJECTED}`:
      return {
        ...state,
        byId: {
          ...state.byId,
          [action.meta.ideaId]: { status: Status.REJECTED }
        }
      };
    case `${Action.getIdea}_${Status.FULFILLED}`:
      return {
        ...state,
        byId: {
          ...state.byId,
          [action.meta.ideaId]: {
            idea: action.payload,
            status: Status.FULFILLED,
          }
        }
      };
    case `${Action.getIdeas}_${Status.PENDING}`:
      return {
        ...state,
        bySearch: {
          ...state.bySearch,
          [action.meta.searchKey]: {
            ...state.bySearch[action.meta.searchKey],
            status: Status.PENDING,
          }
        }
      };
    case `${Action.getIdeas}_${Status.REJECTED}`:
      return {
        ...state,
        bySearch: {
          ...state.bySearch,
          [action.meta.searchKey]: {
            ...state.bySearch[action.meta.searchKey],
            status: Status.REJECTED,
          }
        }
      };
    case `${Action.getIdeas}_${Status.FULFILLED}`:
      return {
        ...state,
        byId: {
          ...state.byId,
          ...action.payload.ideas.reduce(
            (ideasById, idea) => {
              ideasById[idea.id] = {
                idea: idea,
                status: Status.FULFILLED,
              };
              return ideasById;
            }, {}),
        },
        bySearch: {
          ...state.bySearch,
          [action.meta.searchKey]: {
            status: Status.FULFILLED,
            // Append results to existing idea ids
            ideaIds: [
              ...(state.bySearch[action.meta.searchKey].ideaIds || []),
              ...action.payload.ideas.map(idea => idea.id),
            ],
            cursor: action.payload.cursor,
          }
        }
      };
    default:
      return state;
  }
}

export interface State {
  conf:StateConf;
  ideas:StateIdeas;
}
export const reducers = combineReducers({
  conf: reducerConf,
  ideas: reducerIdeas,
});
