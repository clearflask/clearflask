import React from 'react';
import DataMock from './dataMock';
import * as Client from './client';
import * as Admin from './admin';
import ServerMock from './serverMock';
import * as ConfigEditor from '../common/config/configEditor';
import { isProd } from '../common/util/detectEnv';
import { Store, createStore, compose, applyMiddleware, combineReducers } from 'redux';
import thunk from 'redux-thunk';
import reduxPromiseMiddleware from 'redux-promise-middleware';

export enum Status {
  PENDING = 'PENDING',
  FULFILLED = 'FULFILLED',
  REJECTED = 'REJECTED',
}

export class Server {
  apis: any;
  readonly projectId:string;
  readonly store:Store<ReduxState>;
  readonly mockServer:ServerMock|undefined;
  readonly dispatcherClient:Client.Dispatcher;
  readonly dispatcherAdmin:Admin.Dispatcher;

  constructor(projectId:string, mockServer:boolean = false) {
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
      this.store = createStore(reducers, enhancer);
    }

    if(mockServer) {
      this.mockServer = new ServerMock();
    }
    const apiConf = {
      basePath: Client.BASE_PATH.replace(/projectId/, projectId),
    };
    const apiDelegateClient = new Client.Api(new Client.Configuration(apiConf), this.mockServer);
    const apiDelegateAdmin = new Admin.Api(new Admin.Configuration(apiConf), this.mockServer);

    this.dispatcherClient = new Client.Dispatcher(this._dispatch.bind(this), apiDelegateClient);
    this.dispatcherAdmin = new Admin.Dispatcher(this._dispatch.bind(this), apiDelegateAdmin);

  }

  static initialState(projectId:string):any {
    const state:ReduxState = {
      projectId: projectId,
      conf: {},
      ideas: stateIdeasDefault,
    };
    return state;
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

  /** Override config. Used for config change preview and demos */
  overrideConfig(config:Admin.Config):void {
    const msg:Admin.configGetAdminActionFulfilled = {
      type: Admin.configGetAdminActionStatus.Fulfilled,
      meta: {
        action: Admin.Action.configGetAdmin,
        request: {
          projectId: this.projectId
        },
      },
      payload: config,
    };
    this._dispatch(msg);
  }

  mockData():void {
    // TODO Will be used to inject data into mock in-memory client-side "server"
  }

  async _dispatch(msg:any):Promise<any>{
    var result = await this.store.dispatch(msg);
    return result.value;
  }
}

export interface StateConf {
  status?:Status;
  conf?:Client.Config;
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
        conf: action.payload,
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

export interface ReduxState {
  projectId:string;
  conf:StateConf;
  ideas:StateIdeas;
}
export const reducers = combineReducers({
  projectId: (state) => ((!state || state.projectId === null) ? { projectId: 'unknown' } : state),
  conf: reducerConf,
  ideas: reducerIdeas,
});
