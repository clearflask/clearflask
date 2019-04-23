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
      users: stateUsersDefault,
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

  subscribeToChanges(editor:ConfigEditor.Editor) {
    editor.subscribe(() => this.overrideConfig(editor.getConfig()));
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

  mockData():void {
    // TODO Will be used to inject data into mock in-memory client-side "server"
  }

  async _dispatch(msg:any):Promise<any>{
    try {
    var result = await this.store.dispatch(msg);
    } catch(err) {
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
function reducerIdeas(state:StateIdeas = stateIdeasDefault, action:Client.Actions):StateIdeas {
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
    case Client.ideaGetActionStatus.Fulfilled:
      return {
        ...state,
        byId: {
          ...state.byId,
          [action.meta.request.ideaId]: {
            idea: action.payload,
            status: Status.FULFILLED,
          }
        }
      };
    case Client.ideaSearchActionStatus.Pending:
      return {
        ...state,
        bySearch: {
          ...state.bySearch,
          [action.meta.request.search.searchKey]: {
            ...state.bySearch[action.meta.request.search.searchKey],
            status: Status.PENDING,
          }
        }
      };
    case Client.ideaSearchActionStatus.Rejected:
      return {
        ...state,
        bySearch: {
          ...state.bySearch,
          [action.meta.request.search.searchKey]: {
            ...state.bySearch[action.meta.request.search.searchKey],
            status: Status.REJECTED,
          }
        }
      };
    case Client.ideaSearchActionStatus.Fulfilled:
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
          [action.meta.request.search.searchKey]: {
            status: Status.FULFILLED,
            // Append results to existing idea ids
            ideaIds: [
              ...(state.bySearch[action.meta.request.search.searchKey].ideaIds || []),
              ...action.payload.results.map(idea => idea.ideaId),
            ],
            cursor: action.payload.cursor,
          }
        }
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
  },
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
          [action.meta.request.userId]: {
            user: action.payload,
            status: Status.FULFILLED,
          }
        }
      };
      case Client.userCreateActionStatus.Fulfilled:
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
    case Client.userDeleteActionStatus.Fulfilled:
      const {[action.meta.request.userId]:removedUser, ...byIdWithout} = state.byId;
      return {...state, byId: byIdWithout};
    default:
      return state;
  }
}

export interface ReduxState {
  projectId:string;
  conf:StateConf;
  ideas:StateIdeas;
  users:StateUsers;
}
export const reducers = combineReducers({
  projectId: (projectId?:string) => (projectId ? projectId : 'unknown'),
  conf: reducerConf,
  ideas: reducerIdeas,
  users: reducerUsers,
});
