import React from 'react';
import { combineReducers, Store } from "redux";
import DataMock from './dataMock';
import * as Client from './client';
import * as Admin from './admin';
import ServerMock from './serverMock';
import * as ConfigEditor from '../common/config/configEditor';

export enum Status {
  PENDING = 'PENDING',
  FULFILLED = 'FULFILLED',
  REJECTED = 'REJECTED',
}

export class Server {
  apis: any;
  readonly store:Store;
  readonly mockServer:ServerMock|undefined;
  readonly dispatcherClient:Client.Dispatcher;
  readonly dispatcherAdmin:Admin.Dispatcher;

  constructor(store:Store, projectName:string, configEditor?:ConfigEditor.Editor) {
    this.store = store;

    var apiDelegateClient;
    var apiDelegateAdmin;
    if(configEditor) {
      // In-memory demo
      this.mockServer = new ServerMock(configEditor);
      apiDelegateClient = new Client.Api(new Client.Configuration(), this.mockServer);
      apiDelegateAdmin = new Admin.Api(new Admin.Configuration(), this.mockServer);
    } else {
      // Production
      const conf = {
        basePath: Client.BASE_PATH.replace(/projectId/, projectName),
      };
      apiDelegateClient = new Client.Api(new Client.Configuration(conf));
      apiDelegateAdmin = new Admin.Api(new Admin.Configuration(conf));
    }
    this.dispatcherClient = new Client.Dispatcher(this._dispatch.bind(this), apiDelegateClient);
    this.dispatcherAdmin = new Admin.Dispatcher(this._dispatch.bind(this), apiDelegateAdmin);
  }

  static initialState(projectId:string):any {
    const state:State = {
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

  dispatch():Client.Dispatcher {
    return this.dispatcherClient;
  }

  async dispatchAdmin():Promise<Admin.Dispatcher> {
    // TODO load as async webpack here. remove all references to Admin.*
    return this.dispatcherAdmin;
  }

  previewConfig(config:any):void {
    // TODO Will be used as Settings Preview to overwrite config while using production endpoint
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

export interface State {
  projectId:string;
  conf:StateConf;
  ideas:StateIdeas;
}
export const reducers = combineReducers({
  projectId: (state = null) => state,
  conf: reducerConf,
  ideas: reducerIdeas,
});
