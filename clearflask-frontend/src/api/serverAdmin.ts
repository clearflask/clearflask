import { applyMiddleware, combineReducers, compose, createStore, Store } from 'redux';
import reduxPromiseMiddleware from 'redux-promise-middleware';
import thunk from 'redux-thunk';
import * as ConfigEditor from '../common/config/configEditor';
import { detectEnv, Environment, isProd } from '../common/util/detectEnv';
import windowIso, { StoresStateSerializable } from '../common/windowIso';
import * as Admin from './admin';
import * as Client from './client';
import { Server, Status } from './server';
import ServerMock from './serverMock';

export const DemoUpdateDelay = 300;

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

  constructor(apiOverride?: Client.ApiInterface & Admin.ApiInterface) {
    if (ServerAdmin.instance !== undefined) throw Error('ServerAdmin singleton instantiating second time');
    this.apiOverride = apiOverride;
    const dispatchers = Server.getDispatchers(
      msg => Server._dispatch(msg, this.store),
      apiOverride);
    this.dispatcherClient = dispatchers.client;
    this.dispatcherAdmin = dispatchers.adminPromise;

    var storeMiddleware = applyMiddleware(thunk, reduxPromiseMiddleware);
    if (!isProd()) {
      const composeEnhancers =
        !windowIso.isSsr && windowIso['__REDUX_DEVTOOLS_EXTENSION_COMPOSE__']
          ? windowIso['__REDUX_DEVTOOLS_EXTENSION_COMPOSE__']({
            serialize: true,
          })
          : compose;
      storeMiddleware = composeEnhancers(storeMiddleware);
    }

    if (windowIso.isSsr) {
      windowIso.storesState.serverAdminStore = windowIso.storesState.serverAdminStore
        || createStore(reducersAdmin, ServerAdmin._initialState(), storeMiddleware);
      this.store = windowIso.storesState.serverAdminStore;
    } else {
      const preloadedState = (windowIso['__SSR_STORE_INITIAL_STATE__'] as StoresStateSerializable)?.serverAdminStore
        || ServerAdmin._initialState();
      this.store = createStore(reducersAdmin, preloadedState, storeMiddleware);
    }
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

  dispatch(projectId?: string): Client.Dispatcher {
    return projectId === undefined ? this.dispatcherClient : this.projects[projectId].server.dispatch();
  }

  dispatchAdmin(projectId?: string): Promise<Admin.Dispatcher> {
    return projectId === undefined ? this.dispatcherAdmin : this.projects[projectId].server.dispatchAdmin();
  }

  getOrCreateProject(versionedConfig: Client.VersionedConfig, loggedInUser?: Client.UserMeWithBalance): Project {
    const projectId = versionedConfig.config.projectId;
    var project = this.projects[projectId];
    if (!project) {
      const server = new Server(
        projectId,
        { suppressSetTitle: true },
        this.apiOverride);
      const editor = new ConfigEditor.EditorImpl(versionedConfig.config);
      var hasUnsavedChanges = false;
      server.subscribeToChanges(editor, DemoUpdateDelay);
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

      // Simulate config get and bind
      const configGetAndUserBindAction: Client.configGetAndUserBindActionFulfilled = {
        type: Client.configGetAndUserBindActionStatus.Fulfilled,
        meta: { action: Client.Action.configGetAndUserBind, request: { slug: versionedConfig.config.slug, userBind: {} } },
        payload: {
          config: versionedConfig,
          user: loggedInUser,
        },
      };
      project.server.getStore().dispatch(configGetAndUserBindAction);
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

  isSuperAdminLoggedIn(): boolean {
    const state = this.store.getState();
    return !!state.account.isSuperAdmin || !!state.account.account.account?.isSuperAdmin;
  }

  isAdminLoggedIn(): boolean {
    const state = this.store.getState();
    return !!state.account.account.account?.accountId;
  }
}

export interface StateAccount {
  isSuperAdmin: boolean;
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
  isSuperAdmin: false,
  account: {},
  billing: {},
};
function reducerAccount(state: StateAccount = stateAccountDefault, action: Admin.Actions): StateAccount {
  switch (action.type) {
    case Admin.accountSignupAdminActionStatus.Pending:
    case Admin.accountLoginAdminActionStatus.Pending:
    case Admin.accountLoginAsSuperAdminActionStatus.Pending:
      return {
        ...state,
        account: {
          ...state.account,
          status: Status.PENDING,
        },
      };
    case Admin.accountSignupAdminActionStatus.Rejected:
    case Admin.accountLoginAdminActionStatus.Rejected:
    case Admin.accountLoginAsSuperAdminActionStatus.Rejected:
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
    case Admin.accountLoginAsSuperAdminActionStatus.Fulfilled:
      return {
        ...state,
        isSuperAdmin: !!state.isSuperAdmin || !!action.payload.isSuperAdmin,
        account: {
          status: Status.FULFILLED,
          account: action.payload,
        },
        billing: {},
      };
    case Admin.accountBindAdminActionStatus.Fulfilled:
      if (!action.payload.account) return state;
      return {
        ...state,
        isSuperAdmin: !!state.isSuperAdmin || !!action.payload.isSuperAdmin || !!action.payload.account.isSuperAdmin,
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
        account: !state.account.account ? state.account : {
          ...state.account,
          account: {
            ...state.account.account,
            subscriptionStatus: action.payload.subscriptionStatus,
            basePlanId: action.payload.plan.basePlanId,
          },
        },
        billing: {
          status: Status.FULFILLED,
          billing: action.payload,
        },
      };
    case Admin.accountLogoutAdminActionStatus.Pending:
    case Admin.accountLogoutAdminActionStatus.Rejected:
    case Admin.accountLogoutAdminActionStatus.Fulfilled:
      return stateAccountDefault;
    case Admin.accountDeleteAdminActionStatus.Fulfilled:
      return {
        ...stateAccountDefault,
        isSuperAdmin: state.isSuperAdmin,
      };
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
    byProjectId?: { [projectId: string]: Admin.ConfigAndBindAllResultByProjectId };
  };
}
const stateConfigsDefault = {
  configs: {},
};
function reducerConfigs(state: StateConfigs = stateConfigsDefault, action: Admin.Actions): StateConfigs {
  switch (action.type) {
    case Admin.configGetAllAndUserBindAllAdminActionStatus.Pending:
      return {
        ...state,
        configs: {
          ...state.configs,
          status: Status.PENDING,
        },
      };
    case Admin.configGetAllAndUserBindAllAdminActionStatus.Rejected:
      return {
        ...state,
        configs: {
          ...state.configs,
          status: Status.REJECTED,
        },
      };
    case Admin.configGetAllAndUserBindAllAdminActionStatus.Fulfilled:
      return {
        ...state,
        configs: {
          status: Status.FULFILLED,
          byProjectId: action.payload.byProjectId,
        },
      };
    case Admin.projectCreateAdminActionStatus.Fulfilled:
      return {
        ...state,
        configs: {
          ...state.configs,
          byProjectId: {
            ...state.configs.byProjectId,
            [action.payload.projectId]: {
              config: action.payload.config,
            },
          },
        },
      };
    case Admin.projectDeleteAdminActionStatus.Fulfilled:
      const { [action.meta.request.projectId]: removedConfig, ...projectsWithoutDeleted } = state.configs.byProjectId || {};
      return {
        ...state,
        configs: {
          ...state.configs,
          byProjectId: projectsWithoutDeleted,
        },
      };
    case Admin.accountLogoutAdminActionStatus.Pending:
    case Admin.accountLogoutAdminActionStatus.Rejected:
    case Admin.accountLogoutAdminActionStatus.Fulfilled:
    case Admin.accountDeleteAdminActionStatus.Fulfilled:
    case Admin.accountLoginAsSuperAdminActionStatus.Fulfilled:
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
