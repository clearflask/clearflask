import React from 'react';
import * as Client from './client';
import * as Admin from './admin';
import { Server, Status } from './server';
import { detectEnv, Environment, isProd } from '../common/util/detectEnv';
import ServerMock from './serverMock';
import { Store, createStore, compose, applyMiddleware, combineReducers } from 'redux';
import thunk from 'redux-thunk';
import reduxPromiseMiddleware from 'redux-promise-middleware';
import * as ConfigEditor from '../common/config/configEditor';

type ErrorSubscribers = ((msg:string)=>void)[];

export interface Project {
  projectId:string;
  configVersion:string;
  editor:ConfigEditor.Editor;
  server:Server;
}

export default class ServerAdmin {
  static instance:ServerAdmin|undefined;

  readonly apiOverride?:Client.ApiInterface&Admin.ApiInterface;
  readonly projects:{[projectId:string]:Project} = {};
  readonly dispatcherClient:Client.Dispatcher;
  readonly dispatcherAdmin:Promise<Admin.Dispatcher>;
  readonly store:Store<ReduxStateAdmin>;
  readonly errorSubscribers:ErrorSubscribers = [];

  constructor(apiOverride?:Client.ApiInterface&Admin.ApiInterface) {
    if(ServerAdmin.instance !== undefined) throw Error('ServerAdmin singleton instantiating second time');
    this.apiOverride = apiOverride;
    const dispatchers = Server.getDispatchers(
      msg => ServerAdmin._dispatch(msg, this.store, this.errorSubscribers),
      apiOverride);
    this.dispatcherClient = dispatchers.client;
    this.dispatcherAdmin = dispatchers.adminPromise;

    var storeMiddleware = applyMiddleware(thunk, reduxPromiseMiddleware);
    if(!isProd()) {
      const composeEnhancers =
        typeof window === 'object' &&
        window['__REDUX_DEVTOOLS_EXTENSION_COMPOSE__']
          ? window['__REDUX_DEVTOOLS_EXTENSION_COMPOSE__']({/* OPTIONS */})
          : compose;
      storeMiddleware = composeEnhancers(storeMiddleware);
    }
    this.store = createStore(
      reducersAdmin,
      ServerAdmin._initialState(),
      storeMiddleware);
  }

  static get():ServerAdmin {
    if(ServerAdmin.instance === undefined) {
      if(detectEnv() === Environment.DEVELOPMENT_FRONTEND) {
        ServerAdmin.instance = new ServerAdmin(ServerMock.get());
      } else {
        ServerAdmin.instance = new ServerAdmin();
      }
    }
    return ServerAdmin.instance;
  }

  getStore():Store<ReduxStateAdmin> {
    return this.store;
  }

  getServers():Server[] {
    return Object.values(this.projects).map(p => p.server);
  }

  subscribeToErrors(subscriber:((msg:string)=>void)) {
    this.errorSubscribers.push(subscriber);
  }

  dispatch(projectId?:string):Client.Dispatcher {
    return projectId === undefined ? this.dispatcherClient : this.projects[projectId].server.dispatch();
  }

  dispatchAdmin(projectId?:string):Promise<Admin.Dispatcher> {
    return projectId === undefined ? this.dispatcherAdmin : this.projects[projectId].server.dispatchAdmin();
  }

  static async _dispatch(msg:any, store:Store, errorSubscribers:ErrorSubscribers):Promise<any>{
    try {
      var result = await store.dispatch(msg);
    } catch(err) {
      var errorMsg;
      if(err.json && err.json.userFacingMessage) {
        errorMsg = err.json.userFacingMessage;
      } else if(msg && msg.meta && msg.meta.action) {
        errorMsg = `Failed to process: ${msg.meta.action}`;
      } else {
        errorMsg = `Unknown error processing: ${JSON.stringify(msg)}`;
      }
      errorSubscribers.forEach(subscriber => subscriber && subscriber(errorMsg));
      throw err;
    }
    return result.value;
  }

  getProject(versionedConfig:Admin.VersionedConfigAdmin):Project {
    const projectId = versionedConfig.config.projectId;
    var project = this.projects[projectId];
    if(!project || versionedConfig.version !== project.configVersion) {
      const server = new Server(projectId, this.apiOverride);
      const editor = new ConfigEditor.EditorImpl(versionedConfig.config);
      server.subscribeToChanges(editor, 200);
      project = {
        projectId: projectId,
        configVersion: versionedConfig.version,
        editor: editor,
        server: server,
      };
      this.projects[projectId] = project;
    }
    return project;
  }

  static _initialState():any {
    const state:ReduxStateAdmin = {
      account: stateAccountDefault,
      plans: statePlansDefault,
      configs: stateConfigsDefault,
    };
    return state;
  }
}

export interface StateAccount {
  account:{
    status?:Status;
    account?:Admin.AccountAdmin;
  };
}
const stateAccountDefault = {
  account: {},
};
function reducerAccount(state:StateAccount = stateAccountDefault, action:Admin.Actions):StateAccount {
  switch (action.type) {
    case Admin.accountSignupAdminActionStatus.Pending:
    case Admin.accountLoginAdminActionStatus.Pending:
      return {
        ...state,
        account: {
          ...state.account,
          status: Status.PENDING,
        },
      };
    case Admin.accountSignupAdminActionStatus.Rejected:
    case Admin.accountLoginAdminActionStatus.Rejected:
      return {
        ...state,
        account: {
          ...state.account,
          status: Status.REJECTED,
        },
      };
    case Admin.accountSignupAdminActionStatus.Fulfilled:
    case Admin.accountLoginAdminActionStatus.Fulfilled:
      return {
        ...state,
        account: {
          status: Status.FULFILLED,
          account: action.payload,
        },
      };
    case Admin.configGetAllAndAccountBindAdminActionStatus.Fulfilled:
      return {
        ...state,
        account: {
          status: Status.FULFILLED,
          account: action.payload.account,
        },
      };
    case Admin.accountLogoutAdminActionStatus.Pending:
    case Admin.accountLogoutAdminActionStatus.Rejected:
    case Admin.accountLogoutAdminActionStatus.Fulfilled:
      return stateAccountDefault;
    default:
      return state;
  }
}

export interface StatePlans {
  plans:{
    status?:Status;
    plans?:Admin.Plan[];
    featuresTable?:Admin.FeaturesTable;
  };
}
const statePlansDefault = {
  plans: {},
};
function reducerPlans(state:StatePlans = statePlansDefault, action:Admin.Actions):StatePlans {
  switch (action.type) {
    case Admin.plansGetActionStatus.Pending:
      return {
        ...state,
        plans: {
          ...state.plans,
          status: Status.PENDING,
        },
      };
    case Admin.plansGetActionStatus.Rejected:
      return {
        ...state,
        plans: {
          ...state.plans,
          status: Status.REJECTED,
        },
      };
    case Admin.plansGetActionStatus.Fulfilled:
      return {
        ...state,
        plans: {
          status: Status.FULFILLED,
          plans: action.payload.plans,
          featuresTable: action.payload.featuresTable,
        },
      };
    default:
      return state;
  }
}

export interface StateConfigs {
  configs:{
    status?:Status;
    configs?:{ [projectId:string]: Admin.VersionedConfigAdmin };
  };
}
const stateConfigsDefault = {
  configs: {},
};
function reducerConfigs(state:StateConfigs = stateConfigsDefault, action:Admin.Actions):StateConfigs {
  switch (action.type) {
    case Admin.configGetAllAndAccountBindAdminActionStatus.Pending:
      return {
        ...state,
        configs: {
          ...state.configs,
          status: Status.PENDING,
        },
      };
    case Admin.configGetAllAndAccountBindAdminActionStatus.Pending:
      return {
        ...state,
        configs: {
          ...state.configs,
          status: Status.REJECTED,
        },
      };
    case Admin.configGetAllAndAccountBindAdminActionStatus.Fulfilled:
      return {
        ...state,
        configs: {
          status: Status.FULFILLED,
          configs: action.payload.configs.reduce((configs, config) => (configs[config.config.projectId] = config, configs), {}),
        },
      };
    case Admin.projectCreateAdminActionStatus.Fulfilled:
      return {
        ...state,
        configs: {
          ...state.configs,
          configs: {
            ...state.configs.configs,
            [action.payload.projectId]: action.payload.config,
          },
        },
      };
    case Admin.accountLogoutAdminActionStatus.Pending:
    case Admin.accountLogoutAdminActionStatus.Rejected:
    case Admin.accountLogoutAdminActionStatus.Fulfilled:
      return stateConfigsDefault;
    default:
      return state;
  }
}

export interface ReduxStateAdmin {
  account:StateAccount;
  plans:StatePlans;
  configs:StateConfigs;
}
export const reducersAdmin = combineReducers({
  account: reducerAccount,
  plans: reducerPlans,
  configs: reducerConfigs,
});
