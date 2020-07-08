import { applyMiddleware, combineReducers, compose, createStore, Store } from 'redux';
import reduxPromiseMiddleware from 'redux-promise-middleware';
import thunk from 'redux-thunk';
import * as ConfigEditor from '../common/config/configEditor';
import { detectEnv, Environment, isProd } from '../common/util/detectEnv';
import * as Admin from './admin';
import * as Client from './client';
import { Server, Status } from './server';
import ServerMock from './serverMock';

const demoUpdateDelay = 300;
type ErrorSubscribers = ((msg: string, isUserFacing: boolean) => void)[];
type ChallengeSubscriber = ((challenge: string) => Promise<string | undefined>);

export interface Project {
  projectId: string;
  configVersion: string;
  editor: ConfigEditor.Editor;
  server: Server;
  hasUnsavedChanges(): boolean;
  subscribeToUnsavedChanges: (subscriber: () => void) => () => void;
  resetUnsavedChanges(newConfig: Admin.VersionedConfigAdmin);
}

export default class ServerAdmin {
  static instance: ServerAdmin | undefined;
  static mockInstance: ServerAdmin | undefined;

  readonly apiOverride?: Client.ApiInterface & Admin.ApiInterface;
  readonly projects: { [projectId: string]: Project } = {};
  readonly dispatcherClient: Client.Dispatcher;
  readonly dispatcherAdmin: Promise<Admin.Dispatcher>;
  readonly store: Store<ReduxStateAdmin, Admin.Actions>;
  readonly errorSubscribers: ErrorSubscribers = [];
  challengeSubscriber?: ChallengeSubscriber;

  constructor(apiOverride?: Client.ApiInterface & Admin.ApiInterface) {
    if (ServerAdmin.instance !== undefined) throw Error('ServerAdmin singleton instantiating second time');
    this.apiOverride = apiOverride;
    const dispatchers = Server.getDispatchers(
      msg => ServerAdmin._dispatch(msg, this.store, this.errorSubscribers, this.challengeSubscriber),
      apiOverride);
    this.dispatcherClient = dispatchers.client;
    this.dispatcherAdmin = dispatchers.adminPromise;

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
      reducersAdmin,
      ServerAdmin._initialState(),
      storeMiddleware);
  }

  static get(forceMock: boolean = false): ServerAdmin {
    if (forceMock) {
      if (ServerAdmin.mockInstance === undefined) {
        ServerAdmin.mockInstance = new ServerAdmin(ServerMock.get());
      }
      return ServerAdmin.mockInstance;
    } else {
      if (ServerAdmin.instance === undefined) {
        if (detectEnv() === Environment.DEVELOPMENT_FRONTEND) {
          ServerAdmin.mockInstance = new ServerAdmin(ServerMock.get())
          ServerAdmin.instance = ServerAdmin.mockInstance;
        } else {
          ServerAdmin.instance = new ServerAdmin();
        }
      }
      return ServerAdmin.instance;
    }
  }

  getStore(): Store<ReduxStateAdmin, Admin.Actions> {
    return this.store;
  }

  getServers(): Server[] {
    return Object.values(this.projects).map(p => p.server);
  }

  subscribeToErrors(subscriber: ((msg: string, isUserFacing: boolean) => void)) {
    this.errorSubscribers.push(subscriber);
  }

  subscribeChallenger(subscriber: ChallengeSubscriber) {
    this.challengeSubscriber = subscriber;
  }

  dispatch(projectId?: string): Client.Dispatcher {
    return projectId === undefined ? this.dispatcherClient : this.projects[projectId].server.dispatch();
  }

  dispatchAdmin(projectId?: string): Promise<Admin.Dispatcher> {
    return projectId === undefined ? this.dispatcherAdmin : this.projects[projectId].server.dispatchAdmin();
  }

  static async _dispatch(msg: any, store: Store<any, any>, errorSubscribers: ErrorSubscribers, challengeSubscriber?: ChallengeSubscriber): Promise<any> {
    try {
      var result = await store.dispatch(msg);
    } catch (response) {
      console.log("Dispatch error: ", msg, response);
      console.trace();
      try {
        if (response && response.status === 429 && response.headers && response.headers.has && response.headers.has('x-cf-challenge')) {
          if (!challengeSubscriber) {
            errorSubscribers.forEach(subscriber => subscriber && subscriber("Failed to show captcha challenge", true));
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
        errorSubscribers.forEach(subscriber => subscriber && subscriber(errorMsg, isUserFacing));
      } catch (err) {
        console.log("Error dispatching error: ", err);
        errorSubscribers.forEach(subscriber => subscriber && subscriber("Unknown error occurred, please try again", true));
      }
      throw response;
    }
    return result.value;
  }

  getProject(versionedConfig: Admin.VersionedConfigAdmin): Project {
    const projectId = versionedConfig.config.projectId;
    var project = this.projects[projectId];
    if (!project) {
      const server = new Server(projectId, undefined, this.apiOverride, versionedConfig);
      const editor = new ConfigEditor.EditorImpl(versionedConfig.config);
      var hasUnsavedChanges = false;
      server.subscribeToChanges(editor, demoUpdateDelay);
      const subscribers: (() => void)[] = [];
      editor.subscribe(() => {
        if (!hasUnsavedChanges) {
          hasUnsavedChanges = true;
          subscribers.forEach(subscriber => subscriber());
        }
      });
      project = {
        projectId: projectId,
        configVersion: versionedConfig.version,
        editor: editor,
        server: server,
        hasUnsavedChanges: () => hasUnsavedChanges,
        subscribeToUnsavedChanges: subscriber => {
          subscribers.push(subscriber);
          return () => {
            const subscriberIndex = subscribers.findIndex(subscriber);
            if (subscriberIndex !== -1) subscribers.splice(subscriberIndex, 1);
          };
        },
        resetUnsavedChanges: (newConfig) => {
          project.configVersion = newConfig.version;
          hasUnsavedChanges = false;
          subscribers.forEach(subscriber => subscriber());
        },
      };
      this.projects[projectId] = project;
    }
    return project;
  }

  static _initialState(): any {
    const state: ReduxStateAdmin = {
      account: stateAccountDefault,
      plans: statePlansDefault,
      configs: stateConfigsDefault,
      legal: stateLegalDefault,
    };
    return state;
  }

  removeProject(projectId: string): void {
    delete this.projects[projectId];
  }
}

export interface StateAccount {
  account: {
    status?: Status;
    account?: Admin.AccountAdmin;
  };
  billing: {
    status?: Status;
    billing?: Admin.AccountBilling;
  };
}
const stateAccountDefault = {
  account: {},
  billing: {},
};
function reducerAccount(state: StateAccount = stateAccountDefault, action: Admin.Actions): StateAccount {
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
    case Admin.accountUpdateAdminActionStatus.Fulfilled:
      return {
        ...state,
        account: {
          status: Status.FULFILLED,
          account: action.payload,
        },
      };
    case Admin.accountBindAdminActionStatus.Fulfilled:
      if (!action.payload.account) return state;
      return {
        ...state,
        account: {
          status: Status.FULFILLED,
          account: action.payload.account,
        },
      };
    case Admin.accountBillingAdminActionStatus.Pending:
      return {
        ...state,
        billing: {
          ...state.billing,
          status: Status.PENDING,
        },
      };
    case Admin.accountBillingAdminActionStatus.Rejected:
      return {
        ...state,
        billing: {
          ...state.billing,
          status: Status.REJECTED,
        },
      };
    case Admin.accountBillingAdminActionStatus.Fulfilled:
      return {
        ...state,
        billing: {
          status: Status.FULFILLED,
          billing: action.payload,
        },
      };
    case Admin.accountLogoutAdminActionStatus.Pending:
    case Admin.accountLogoutAdminActionStatus.Rejected:
    case Admin.accountLogoutAdminActionStatus.Fulfilled:
    case Admin.accountDeleteAdminActionStatus.Fulfilled:
      return stateAccountDefault;
    default:
      return state;
  }
}

export interface StatePlans {
  plans: {
    status?: Status;
    plans?: Admin.Plan[];
    featuresTable?: Admin.FeaturesTable;
  };
  changeOptions: {
    status?: Status;
  };
}
const statePlansDefault = {
  plans: {},
  changeOptions: {},
};
function reducerPlans(state: StatePlans = statePlansDefault, action: Admin.Actions): StatePlans {
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
  configs: {
    status?: Status;
    configs?: { [projectId: string]: Admin.VersionedConfigAdmin };
  };
}
const stateConfigsDefault = {
  configs: {},
};
function reducerConfigs(state: StateConfigs = stateConfigsDefault, action: Admin.Actions): StateConfigs {
  switch (action.type) {
    case Admin.configGetAllAdminActionStatus.Pending:
      return {
        ...state,
        configs: {
          ...state.configs,
          status: Status.PENDING,
        },
      };
    case Admin.configGetAllAdminActionStatus.Rejected:
      return {
        ...state,
        configs: {
          ...state.configs,
          status: Status.REJECTED,
        },
      };
    case Admin.configGetAllAdminActionStatus.Fulfilled:
      return {
        ...state,
        configs: {
          status: Status.FULFILLED,
          configs: action.payload.configs.reduce((configs, config) => {
            configs[config.config.projectId] = config;
            return configs;
          }, {}),
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
    case Admin.projectDeleteAdminActionStatus.Fulfilled:
      const { [action.meta.request.projectId]: removedConfig, ...configsWithoutDeleted } = state.configs.configs || {};
      return {
        ...state,
        configs: {
          ...state.configs,
          configs: configsWithoutDeleted,
        },
      };
    case Admin.accountLogoutAdminActionStatus.Pending:
    case Admin.accountLogoutAdminActionStatus.Rejected:
    case Admin.accountLogoutAdminActionStatus.Fulfilled:
    case Admin.accountDeleteAdminActionStatus.Fulfilled:
      return stateConfigsDefault;
    default:
      return state;
  }
}

export interface StateLegal {
  status?: Status;
  legal?: Admin.LegalResponse;
}
const stateLegalDefault = {};
function reducerLegal(state: StateLegal = stateLegalDefault, action: Admin.Actions): StateLegal {
  switch (action.type) {
    case Admin.legalGetActionStatus.Pending:
      return {
        ...state,
        status: Status.PENDING,
      };
    case Admin.legalGetActionStatus.Rejected:
      return {
        ...state,
        status: Status.REJECTED,
      };
    case Admin.legalGetActionStatus.Fulfilled:
      return {
        status: Status.FULFILLED,
        legal: action.payload,
      };
    default:
      return state;
  }
}

export interface ReduxStateAdmin {
  account: StateAccount;
  plans: StatePlans;
  configs: StateConfigs;
  legal: StateLegal;
}
export const reducersAdmin = combineReducers({
  account: reducerAccount,
  plans: reducerPlans,
  configs: reducerConfigs,
  legal: reducerLegal,
});
