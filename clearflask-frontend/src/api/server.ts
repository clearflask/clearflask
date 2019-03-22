import React from 'react';
import { combineReducers, Store } from "redux";
import * as Client from './client';
import DataMock from './dataMock';
import { ApiInterface } from './client';

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

export class Server implements Client.ApiInterface {
  apis: any;
  readonly apiDelegate:Client.Api;
  readonly store:Store

  constructor(store:Store, projectName) {
    this.store = store;

    if(projectName === 'demo') {
      // In-memory demo
      const mockServer = new DataMock().mockServerData();
      this.apiDelegate = new Client.Api(new Client.Configuration(), mockServer);
    } else {
      // Production
      this.apiDelegate = new Client.Api(new Client.Configuration({
        basePath: Client.BASE_PATH.replace(/projectId/, projectName),
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

  changeVoteIdea(requestParameters: Client.ChangeVoteIdeaRequest): Promise<Client.VoteIdeaResult> {
    throw new Error("Method not implemented.");
  }
  unvoteIdea(requestParameters: Client.UnvoteIdeaRequest): Promise<Client.VoteIdeaResult> {
    throw new Error("Method not implemented.");
  }
  bindUser(requestParameters: Client.BindUserRequest): Promise<Client.AuthSuccessResult> {
    throw new Error("Method not implemented.");
  }
  loginUser(requestParameters: Client.LoginUserRequest): Promise<Client.AuthSuccessResult> {
    throw new Error("Method not implemented.");
  }
  registerUser(requestParameters: Client.RegisterUserRequest): Promise<Client.AuthSuccessResult> {
    throw new Error("Method not implemented.");
  }
  updateUser(requestParameters: Client.UpdateUserRequest): Promise<void> {
    throw new Error("Method not implemented.");
  }
  getComments(requestParameters: Client.GetCommentsRequest): Promise<Array<Client.Comment>> {
    throw new Error("Method not implemented.");
  }
  getConfig(): Promise<Client.Conf> {
    return this._dispatch({
      type: Action.getConfig,
      payload: this.apiDelegate.getConfigApi().getConfig(),
    });
  }
  getTransactions(requestParameters: Client.GetTransactionsRequest): Promise<Array<Client.Transaction>> {
    throw new Error("Method not implemented.");
  }
  voteIdea(requestParameters: Client.VoteIdeaRequest): Promise<Client.VoteIdeaResult> {
    throw new Error("Method not implemented.");
  }
  createIdea(requestParameters: Client.CreateIdeaRequest): Promise<Client.Idea> {
    throw new Error("Method not implemented.");
  }
  deleteIdea(requestParameters: Client.DeleteIdeaRequest): Promise<void> {
    throw new Error("Method not implemented.");
  }
  updateIdea(requestParameters: Client.UpdateIdeaRequest): Promise<void> {
    throw new Error("Method not implemented.");
  }
  getIdea(requestParameters: Client.GetIdeaRequest): Promise<Client.Idea> {
    return this._dispatch({
      type: Action.getIdea,
      meta: { ideaId: requestParameters.ideaId },
      payload: this.apiDelegate.getIdeaApi().getIdea(requestParameters),
    });
  }
  getIdeas(requestParameters: Client.GetIdeasRequest): Promise<Client.Ideas> {
    return this._dispatch({
      type: Action.getIdeas,
      meta: { searchKey: requestParameters.searchQuery.searchKey },
      payload: this.apiDelegate.getIdeaApi().getIdeas(requestParameters),
    });
  }
  getUser(requestParameters: Client.GetUserRequest): Promise<Client.User> {
    throw new Error("Method not implemented.");
  }

  async _dispatch(msg:any):Promise<any>{
    var result = await this.store.dispatch(msg);
    return result.value;
  }
}

export interface StateConf {
  status?:Status;
  conf?:Client.Conf;
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
    idea:Client.Idea;
  }};
  bySearch:{[searchKey:string]:{
    status: Status,
    ideaIds?: string[],
    cursor?: string,
  }};
}
const stateIdeasDefault = {
  byId: {},
  bySearch: {},
};
function reducerIdeas(state:StateIdeas = stateIdeasDefault, action):StateIdeas {
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
