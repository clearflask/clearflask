// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
import { loadingBarMiddleware } from 'react-redux-loading-bar';
import { applyMiddleware, combineReducers, compose, createStore, Store, StoreEnhancer } from 'redux';
import reduxPromiseMiddleware from 'redux-promise-middleware';
import thunk from 'redux-thunk';
import * as ConfigEditor from '../common/config/configEditor';
import { AllTourActions, reducerTour, ReduxStateTour, stateTourDefault } from '../common/tour';
import Cache from '../common/util/cache';
import { detectEnv, Environment } from '../common/util/detectEnv';
import { htmlDataRetrieve } from '../common/util/htmlData';
import windowIso, { StoresStateSerializable } from '../common/windowIso';
import * as Admin from './admin';
import * as Client from './client';
import { DispatchProps, Server, Status } from './server';
import ServerMock from './serverMock';

export const DemoUpdateDelay = 300;

export interface Project {
  projectId: string;
  configVersion: string;
  user: Client.UserMeWithBalance;
  editor: ConfigEditor.Editor;
  server: Server;
  hasUnsavedChanges(): boolean;
  subscribeToUnsavedChanges: (subscriber: () => void) => () => void;
  resetUnsavedChanges(newConfig: Admin.VersionedConfigAdmin);
}

export type AllActionsAdmin = Admin.Actions | AllTourActions;

export default class ServerAdmin {
  static instance: ServerAdmin | undefined;

  readonly projects: { [projectId: string]: Project } = {};
  readonly dispatcherAdmin: Admin.Dispatcher;
  readonly dispatchDebounceCache = new Cache(1000);
  readonly store: Store<ReduxStateAdmin, Admin.Actions>;

  constructor() {
    if (ServerAdmin.instance !== undefined) throw Error('ServerAdmin singleton instantiating second time');

    const apiConf: Admin.ConfigurationParameters = {
      fetchApi: windowIso.fetch.bind(windowIso),
      basePath: Server.augmentApiBasePath(Admin.BASE_PATH),
    };
    var apiOverride: Client.ApiInterface & Admin.ApiInterface | undefined;
    if (detectEnv() === Environment.DEVELOPMENT_FRONTEND) {
      apiOverride = ServerMock.get();
    }
    this.dispatcherAdmin = new Admin.Dispatcher(
      msg => Server._dispatch(msg, this.store),
      new Admin.Api(new Admin.Configuration(apiConf), apiOverride));

    const storeMiddleware = ServerAdmin.createStoreMiddleware(false, 'main');
    if (windowIso.isSsr) {
      windowIso.storesState.serverAdminStore = windowIso.storesState.serverAdminStore
        || createStore(reducersAdmin, ServerAdmin._initialState(), storeMiddleware);
      this.store = windowIso.storesState.serverAdminStore;
    } else {
      const preloadedState = (htmlDataRetrieve('__SSR_STORE_INITIAL_STATE__') as StoresStateSerializable | undefined)?.serverAdminStore
        || ServerAdmin._initialState();
      this.store = createStore(reducersAdmin, preloadedState, storeMiddleware);
    }
  }

  static get(): ServerAdmin {
    if (ServerAdmin.instance === undefined) {
      ServerAdmin.instance = new ServerAdmin();
    }
    return ServerAdmin.instance;
  }

  getStore(): Store<ReduxStateAdmin, Admin.Actions> {
    return this.store;
  }

  static createStoreMiddleware(isProject: boolean, name: string): StoreEnhancer {
    var storeMiddleware = isProject
      ? applyMiddleware(thunk, reduxPromiseMiddleware, loadingBarMiddleware())
      : applyMiddleware(thunk, reduxPromiseMiddleware);
    if (!windowIso.isSsr) {
      const composeEnhancers =
        windowIso['__REDUX_DEVTOOLS_EXTENSION_COMPOSE__']
          ? windowIso['__REDUX_DEVTOOLS_EXTENSION_COMPOSE__']({
            serialize: true,
            name,
          })
          : compose;
      storeMiddleware = composeEnhancers(storeMiddleware);
    }
    return storeMiddleware;
  }

  getServers(): Server[] {
    return Object.values(this.projects).map(p => p.server);
  }
  dispatchAdmin(props: DispatchProps = {}): Promise<Admin.Dispatcher> {
    return Server.__dispatch(props, this.dispatcherAdmin, this.dispatchDebounceCache);
  }

  getProject(projectId: string): Project | undefined {
    return this.projects[projectId];
  }

  getOrCreateProject(projectId: string): Project {
    var project = this.projects[projectId];
    if (!project) {
      const bind = this.getStore().getState().configs.configs.byProjectId?.[projectId];
      if (!bind) throw new Error('Cannot find project by ID: ' + projectId);
      const versionedConfigAdmin: Admin.VersionedConfigAdmin = bind.config;
      const loggedInUser: Client.UserMeWithBalance = bind.user;
      const server = new Server(
        projectId,
        { suppressSetTitle: true });
      const editor = new ConfigEditor.EditorImpl(versionedConfigAdmin.config);
      var hasUnsavedChanges = false;
      server.subscribeToChanges(editor, DemoUpdateDelay);
      const subscribers: (() => void)[] = [];
      editor.subscribe(() => {
        if (!hasUnsavedChanges) {
          hasUnsavedChanges = true;
          subscribers.forEach(subscriber => subscriber());
        }
      });
      !windowIso.isSsr && windowIso.addEventListener('beforeunload', e => {
        if (!hasUnsavedChanges) return undefined;
        const confirmationMessage = 'If you leave before publishing, your changes will be lost.';
        //Gecko + IE
        if ((e || windowIso['event'])) {
          (e || windowIso['event']).returnValue = confirmationMessage;
        }
        //Gecko + Webkit, Safari, Chrome etc.
        return confirmationMessage;
      });
      project = {
        projectId: projectId,
        configVersion: versionedConfigAdmin.version,
        user: loggedInUser,
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
          project.editor.setConfig(newConfig.config);
          hasUnsavedChanges = false;
          subscribers.forEach(subscriber => subscriber());
        },
      };
      this.projects[projectId] = project;

      // Simulate config get and bind
      const action: Client.configAndUserBindSlugActionFulfilled = {
        type: Client.configAndUserBindSlugActionStatus.Fulfilled,
        meta: { action: Client.Action.configAndUserBindSlug, request: { slug: versionedConfigAdmin.config.slug, userBind: {} } },
        payload: {
          projectId,
          config: versionedConfigAdmin,
          user: loggedInUser,
        },
      };
      project.server.getStore().dispatch(action);
    }

    return project;
  }

  static _initialState(): any {
    const state: ReduxStateAdmin = {
      account: stateAccountDefault,
      plans: statePlansDefault,
      configs: stateConfigsDefault,
      legal: stateLegalDefault,
      tour: stateTourDefault,
      invitations: stateInvitationsDefault,
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
function reducerAccount(state: StateAccount = stateAccountDefault, action: AllActionsAdmin): StateAccount {
  switch (action.type) {
    case Admin.accountSignupAdminActionStatus.Pending:
    case Admin.accountLoginAdminActionStatus.Pending:
    case Admin.accountLoginAsSuperAdminActionStatus.Pending:
    case Admin.accountBindAdminActionStatus.Pending:
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
    case Admin.accountBindAdminActionStatus.Rejected:
      return {
        ...state,
        account: {
          ...state.account,
          status: Status.REJECTED,
        },
      };
    case Admin.accountSignupAdminActionStatus.Fulfilled:
    case Admin.accountLoginAdminActionStatus.Fulfilled:
    case Admin.accountLoginAsSuperAdminActionStatus.Fulfilled:
    case Admin.accountUpdateAdminActionStatus.Fulfilled:
    case Admin.accountAttrsUpdateAdminActionStatus.Fulfilled:
    case Admin.accountAcceptCouponAdminActionStatus.Fulfilled:
    case Admin.accountUpdateSuperAdminActionStatus.Fulfilled:
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
      return {
        ...state,
        isSuperAdmin: !!state.isSuperAdmin || !!action.payload.isSuperAdmin || !!action.payload.account?.isSuperAdmin,
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
function reducerPlans(state: StatePlans = statePlansDefault, action: AllActionsAdmin): StatePlans {
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
function reducerConfigs(state: StateConfigs = stateConfigsDefault, action: AllActionsAdmin): StateConfigs {
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
    case Admin.configSetAdminActionStatus.Fulfilled:
      if (!state.configs.byProjectId?.[action.payload.config.projectId]) return state;
      return {
        ...state,
        configs: {
          ...state.configs,
          byProjectId: {
            ...state.configs.byProjectId,
            [action.payload.config.projectId]: {
              ...state.configs.byProjectId[action.payload.config.projectId],
              config: action.payload,
            },
          },
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
              user: action.payload.user,
              isExternal: false,
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
function reducerLegal(state: StateLegal = stateLegalDefault, action: AllActionsAdmin): StateLegal {
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

export interface StateInvitations {
  byId: {
    [invitationId: string]: {
      status?: Status;
      invitation?: Admin.InvitationResult;
    }
  };
}
const stateInvitationsDefault = {
  byId: {},
};
function reducerInvitations(state: StateInvitations = stateInvitationsDefault, action: AllActionsAdmin): StateInvitations {
  switch (action.type) {
    case Admin.accountViewInvitationAdminActionStatus.Pending:
      return {
        ...state,
        byId: {
          ...state.byId,
          [action.meta.request.invitationId]: {
            ...state.byId[action.meta.request.invitationId],
            status: Status.PENDING,
          },
        }
      };
    case Admin.accountViewInvitationAdminActionStatus.Rejected:
      return {
        ...state,
        byId: {
          ...state.byId,
          [action.meta.request.invitationId]: {
            status: Status.REJECTED,
          },
        }
      };
    case Admin.accountViewInvitationAdminActionStatus.Fulfilled:
      return {
        ...state,
        byId: {
          ...state.byId,
          [action.meta.request.invitationId]: {
            status: Status.FULFILLED,
            invitation: action.payload,
          },
        }
      };
    case Admin.accountAcceptInvitationAdminActionStatus.Fulfilled:
      if (!state.byId[action.meta.request.invitationId].invitation) return state;
      return {
        ...state,
        byId: {
          ...state.byId,
          [action.meta.request.invitationId]: {
            ...state.byId[action.meta.request.invitationId],
            invitation: {
              ...state.byId[action.meta.request.invitationId].invitation!,
              isAcceptedByYou: true,
            },
          },
        }
      };
    case Admin.accountSignupAdminActionStatus.Fulfilled:
    case Admin.accountBindAdminActionStatus.Fulfilled:
      const invitationIdAcceptedAsPartOfSignup = action.type === Admin.accountBindAdminActionStatus.Fulfilled
        ? (!!action.payload.created && action.meta.request.accountBindAdmin.oauthToken?.invitationId)
        : (action.meta.request.accountSignupAdmin.invitationId)
      if (!invitationIdAcceptedAsPartOfSignup) return state;
      if (!state.byId[invitationIdAcceptedAsPartOfSignup]?.invitation) return state;
      return {
        ...state,
        byId: {
          ...state.byId,
          [invitationIdAcceptedAsPartOfSignup]: {
            ...state.byId[invitationIdAcceptedAsPartOfSignup],
            invitation: {
              ...state.byId[invitationIdAcceptedAsPartOfSignup].invitation!,
              isAcceptedByYou: true,
            },
          },
        }
      };
    default:
      return state;
  }
}

export interface ReduxStateAdmin extends ReduxStateTour {
  account: StateAccount;
  plans: StatePlans;
  configs: StateConfigs;
  legal: StateLegal;
  invitations: StateInvitations;
}
export const reducersAdmin = combineReducers({
  account: reducerAccount,
  plans: reducerPlans,
  configs: reducerConfigs,
  legal: reducerLegal,
  tour: reducerTour,
  invitations: reducerInvitations,
});
