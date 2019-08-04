import React from 'react';
import * as Client from './client';
import * as Admin from './admin';
import { Server, Status } from './server';
import { detectEnv, Environment, isProd } from '../common/util/detectEnv';
import ServerMock from './serverMock';
import { Store, createStore, compose, applyMiddleware, combineReducers } from 'redux';
import thunk from 'redux-thunk';
import reduxPromiseMiddleware from 'redux-promise-middleware';

type ErrorSubscribers = ((msg:string)=>void)[];

export default class ServerAdmin {
  static instance:ServerAdmin|undefined;

  readonly apiOverride?:Client.ApiInterface&Admin.ApiInterface;
  readonly projectIdToServer:{[projectId:string]:Server} = {};
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
    return Object.values(this.projectIdToServer);
  }

  subscribeToErrors(subscriber:((msg:string)=>void)) {
    this.errorSubscribers.push(subscriber);
  }

  dispatch(projectId?:string):Client.Dispatcher {
    return projectId === undefined ? this.dispatcherClient : this.projectIdToServer[projectId].dispatch();
  }

  dispatchAdmin(projectId?:string):Promise<Admin.Dispatcher> {
    return projectId === undefined ? this.dispatcherAdmin : this.projectIdToServer[projectId].dispatchAdmin();
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

  createServer(projectId:string):Server {
    if(!this.projectIdToServer[projectId]) {
      this.projectIdToServer[projectId] = new Server(projectId, this.apiOverride);
    }
    return this.projectIdToServer[projectId];
  }

  static _initialState():any {
    const state:ReduxStateAdmin = {
      account: stateAccountDefault,
      plans: statePlansDefault,
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
    default:
      return state;
  }
}

export interface StatePlans {
  plans:{
    status?:Status;
    plans?:Admin.Plan[];
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
        },
      };
    default:
      return state;
  }
}

export interface ReduxStateAdmin {
  account:StateAccount;
  plans:StatePlans;
}
export const reducersAdmin = combineReducers({
  account: reducerAccount,
  plans: reducerPlans,
});
