/* tslint:disable */
// eslint-disable-next-line no-unused-vars
import * as runtime from './runtime';
// eslint-disable-next-line no-unused-vars
import { Api, ApiInterface } from './apis';
// eslint-disable-next-line no-unused-vars
import * as Model from './models';
// eslint-disable-next-line no-unused-vars
import * as SniConnectApi from './apis/SniConnectApi';

export * from './runtime';
export * from './apis';
export * from './models';

export enum Action {
  accountKeypairDeleteConnect = 'accountKeypairDeleteConnect',
  accountKeypairGetConnect = 'accountKeypairGetConnect',
  accountKeypairPutConnect = 'accountKeypairPutConnect',
  certChallengeDeleteConnect = 'certChallengeDeleteConnect',
  certChallengeGetConnect = 'certChallengeGetConnect',
  certChallengePutConnect = 'certChallengePutConnect',
  certDeleteConnect = 'certDeleteConnect',
  certGetConnect = 'certGetConnect',
  certKeypairDeleteConnect = 'certKeypairDeleteConnect',
  certKeypairGetConnect = 'certKeypairGetConnect',
  certKeypairPutConnect = 'certKeypairPutConnect',
  certPutConnect = 'certPutConnect',
}


export type Actions = 
  accountKeypairDeleteConnectActionFulfilled
  | accountKeypairDeleteConnectActionPending
  | accountKeypairDeleteConnectActionRejected
  | accountKeypairGetConnectActionFulfilled
  | accountKeypairGetConnectActionPending
  | accountKeypairGetConnectActionRejected
  | accountKeypairPutConnectActionFulfilled
  | accountKeypairPutConnectActionPending
  | accountKeypairPutConnectActionRejected
  | certChallengeDeleteConnectActionFulfilled
  | certChallengeDeleteConnectActionPending
  | certChallengeDeleteConnectActionRejected
  | certChallengeGetConnectActionFulfilled
  | certChallengeGetConnectActionPending
  | certChallengeGetConnectActionRejected
  | certChallengePutConnectActionFulfilled
  | certChallengePutConnectActionPending
  | certChallengePutConnectActionRejected
  | certDeleteConnectActionFulfilled
  | certDeleteConnectActionPending
  | certDeleteConnectActionRejected
  | certGetConnectActionFulfilled
  | certGetConnectActionPending
  | certGetConnectActionRejected
  | certKeypairDeleteConnectActionFulfilled
  | certKeypairDeleteConnectActionPending
  | certKeypairDeleteConnectActionRejected
  | certKeypairGetConnectActionFulfilled
  | certKeypairGetConnectActionPending
  | certKeypairGetConnectActionRejected
  | certKeypairPutConnectActionFulfilled
  | certKeypairPutConnectActionPending
  | certKeypairPutConnectActionRejected
  | certPutConnectActionFulfilled
  | certPutConnectActionPending
  | certPutConnectActionRejected
;



export enum accountKeypairDeleteConnectActionStatus {
  Pending = 'accountKeypairDeleteConnect_PENDING',
  Fulfilled = 'accountKeypairDeleteConnect_FULFILLED',
  Rejected = 'accountKeypairDeleteConnect_REJECTED',
}
export interface accountKeypairDeleteConnectActionFulfilled {
  type: accountKeypairDeleteConnectActionStatus.Fulfilled;
  meta: { action: Action.accountKeypairDeleteConnect; request: SniConnectApi.AccountKeypairDeleteConnectRequest; };
  payload: void;
}
export interface accountKeypairDeleteConnectActionPending {
  type: accountKeypairDeleteConnectActionStatus.Pending;
  meta: { action: Action.accountKeypairDeleteConnect; request: SniConnectApi.AccountKeypairDeleteConnectRequest; };
}
export interface accountKeypairDeleteConnectActionRejected {
  type: accountKeypairDeleteConnectActionStatus.Rejected;
  meta: { action: Action.accountKeypairDeleteConnect; request: SniConnectApi.AccountKeypairDeleteConnectRequest; };
  error: true;
  payload: {
    userFacingMessage?:string
  };
}

export enum accountKeypairGetConnectActionStatus {
  Pending = 'accountKeypairGetConnect_PENDING',
  Fulfilled = 'accountKeypairGetConnect_FULFILLED',
  Rejected = 'accountKeypairGetConnect_REJECTED',
}
export interface accountKeypairGetConnectActionFulfilled {
  type: accountKeypairGetConnectActionStatus.Fulfilled;
  meta: { action: Action.accountKeypairGetConnect; request: SniConnectApi.AccountKeypairGetConnectRequest; };
  payload: Model.Keypair;
}
export interface accountKeypairGetConnectActionPending {
  type: accountKeypairGetConnectActionStatus.Pending;
  meta: { action: Action.accountKeypairGetConnect; request: SniConnectApi.AccountKeypairGetConnectRequest; };
}
export interface accountKeypairGetConnectActionRejected {
  type: accountKeypairGetConnectActionStatus.Rejected;
  meta: { action: Action.accountKeypairGetConnect; request: SniConnectApi.AccountKeypairGetConnectRequest; };
  error: true;
  payload: {
    userFacingMessage?:string
  };
}

export enum accountKeypairPutConnectActionStatus {
  Pending = 'accountKeypairPutConnect_PENDING',
  Fulfilled = 'accountKeypairPutConnect_FULFILLED',
  Rejected = 'accountKeypairPutConnect_REJECTED',
}
export interface accountKeypairPutConnectActionFulfilled {
  type: accountKeypairPutConnectActionStatus.Fulfilled;
  meta: { action: Action.accountKeypairPutConnect; request: SniConnectApi.AccountKeypairPutConnectRequest; };
  payload: void;
}
export interface accountKeypairPutConnectActionPending {
  type: accountKeypairPutConnectActionStatus.Pending;
  meta: { action: Action.accountKeypairPutConnect; request: SniConnectApi.AccountKeypairPutConnectRequest; };
}
export interface accountKeypairPutConnectActionRejected {
  type: accountKeypairPutConnectActionStatus.Rejected;
  meta: { action: Action.accountKeypairPutConnect; request: SniConnectApi.AccountKeypairPutConnectRequest; };
  error: true;
  payload: {
    userFacingMessage?:string
  };
}

export enum certChallengeDeleteConnectActionStatus {
  Pending = 'certChallengeDeleteConnect_PENDING',
  Fulfilled = 'certChallengeDeleteConnect_FULFILLED',
  Rejected = 'certChallengeDeleteConnect_REJECTED',
}
export interface certChallengeDeleteConnectActionFulfilled {
  type: certChallengeDeleteConnectActionStatus.Fulfilled;
  meta: { action: Action.certChallengeDeleteConnect; request: SniConnectApi.CertChallengeDeleteConnectRequest; };
  payload: void;
}
export interface certChallengeDeleteConnectActionPending {
  type: certChallengeDeleteConnectActionStatus.Pending;
  meta: { action: Action.certChallengeDeleteConnect; request: SniConnectApi.CertChallengeDeleteConnectRequest; };
}
export interface certChallengeDeleteConnectActionRejected {
  type: certChallengeDeleteConnectActionStatus.Rejected;
  meta: { action: Action.certChallengeDeleteConnect; request: SniConnectApi.CertChallengeDeleteConnectRequest; };
  error: true;
  payload: {
    userFacingMessage?:string
  };
}

export enum certChallengeGetConnectActionStatus {
  Pending = 'certChallengeGetConnect_PENDING',
  Fulfilled = 'certChallengeGetConnect_FULFILLED',
  Rejected = 'certChallengeGetConnect_REJECTED',
}
export interface certChallengeGetConnectActionFulfilled {
  type: certChallengeGetConnectActionStatus.Fulfilled;
  meta: { action: Action.certChallengeGetConnect; request: SniConnectApi.CertChallengeGetConnectRequest; };
  payload: Model.Challenge;
}
export interface certChallengeGetConnectActionPending {
  type: certChallengeGetConnectActionStatus.Pending;
  meta: { action: Action.certChallengeGetConnect; request: SniConnectApi.CertChallengeGetConnectRequest; };
}
export interface certChallengeGetConnectActionRejected {
  type: certChallengeGetConnectActionStatus.Rejected;
  meta: { action: Action.certChallengeGetConnect; request: SniConnectApi.CertChallengeGetConnectRequest; };
  error: true;
  payload: {
    userFacingMessage?:string
  };
}

export enum certChallengePutConnectActionStatus {
  Pending = 'certChallengePutConnect_PENDING',
  Fulfilled = 'certChallengePutConnect_FULFILLED',
  Rejected = 'certChallengePutConnect_REJECTED',
}
export interface certChallengePutConnectActionFulfilled {
  type: certChallengePutConnectActionStatus.Fulfilled;
  meta: { action: Action.certChallengePutConnect; request: SniConnectApi.CertChallengePutConnectRequest; };
  payload: void;
}
export interface certChallengePutConnectActionPending {
  type: certChallengePutConnectActionStatus.Pending;
  meta: { action: Action.certChallengePutConnect; request: SniConnectApi.CertChallengePutConnectRequest; };
}
export interface certChallengePutConnectActionRejected {
  type: certChallengePutConnectActionStatus.Rejected;
  meta: { action: Action.certChallengePutConnect; request: SniConnectApi.CertChallengePutConnectRequest; };
  error: true;
  payload: {
    userFacingMessage?:string
  };
}

export enum certDeleteConnectActionStatus {
  Pending = 'certDeleteConnect_PENDING',
  Fulfilled = 'certDeleteConnect_FULFILLED',
  Rejected = 'certDeleteConnect_REJECTED',
}
export interface certDeleteConnectActionFulfilled {
  type: certDeleteConnectActionStatus.Fulfilled;
  meta: { action: Action.certDeleteConnect; request: SniConnectApi.CertDeleteConnectRequest; };
  payload: void;
}
export interface certDeleteConnectActionPending {
  type: certDeleteConnectActionStatus.Pending;
  meta: { action: Action.certDeleteConnect; request: SniConnectApi.CertDeleteConnectRequest; };
}
export interface certDeleteConnectActionRejected {
  type: certDeleteConnectActionStatus.Rejected;
  meta: { action: Action.certDeleteConnect; request: SniConnectApi.CertDeleteConnectRequest; };
  error: true;
  payload: {
    userFacingMessage?:string
  };
}

export enum certGetConnectActionStatus {
  Pending = 'certGetConnect_PENDING',
  Fulfilled = 'certGetConnect_FULFILLED',
  Rejected = 'certGetConnect_REJECTED',
}
export interface certGetConnectActionFulfilled {
  type: certGetConnectActionStatus.Fulfilled;
  meta: { action: Action.certGetConnect; request: SniConnectApi.CertGetConnectRequest; };
  payload: Model.Cert;
}
export interface certGetConnectActionPending {
  type: certGetConnectActionStatus.Pending;
  meta: { action: Action.certGetConnect; request: SniConnectApi.CertGetConnectRequest; };
}
export interface certGetConnectActionRejected {
  type: certGetConnectActionStatus.Rejected;
  meta: { action: Action.certGetConnect; request: SniConnectApi.CertGetConnectRequest; };
  error: true;
  payload: {
    userFacingMessage?:string
  };
}

export enum certKeypairDeleteConnectActionStatus {
  Pending = 'certKeypairDeleteConnect_PENDING',
  Fulfilled = 'certKeypairDeleteConnect_FULFILLED',
  Rejected = 'certKeypairDeleteConnect_REJECTED',
}
export interface certKeypairDeleteConnectActionFulfilled {
  type: certKeypairDeleteConnectActionStatus.Fulfilled;
  meta: { action: Action.certKeypairDeleteConnect; request: SniConnectApi.CertKeypairDeleteConnectRequest; };
  payload: void;
}
export interface certKeypairDeleteConnectActionPending {
  type: certKeypairDeleteConnectActionStatus.Pending;
  meta: { action: Action.certKeypairDeleteConnect; request: SniConnectApi.CertKeypairDeleteConnectRequest; };
}
export interface certKeypairDeleteConnectActionRejected {
  type: certKeypairDeleteConnectActionStatus.Rejected;
  meta: { action: Action.certKeypairDeleteConnect; request: SniConnectApi.CertKeypairDeleteConnectRequest; };
  error: true;
  payload: {
    userFacingMessage?:string
  };
}

export enum certKeypairGetConnectActionStatus {
  Pending = 'certKeypairGetConnect_PENDING',
  Fulfilled = 'certKeypairGetConnect_FULFILLED',
  Rejected = 'certKeypairGetConnect_REJECTED',
}
export interface certKeypairGetConnectActionFulfilled {
  type: certKeypairGetConnectActionStatus.Fulfilled;
  meta: { action: Action.certKeypairGetConnect; request: SniConnectApi.CertKeypairGetConnectRequest; };
  payload: Model.Keypair;
}
export interface certKeypairGetConnectActionPending {
  type: certKeypairGetConnectActionStatus.Pending;
  meta: { action: Action.certKeypairGetConnect; request: SniConnectApi.CertKeypairGetConnectRequest; };
}
export interface certKeypairGetConnectActionRejected {
  type: certKeypairGetConnectActionStatus.Rejected;
  meta: { action: Action.certKeypairGetConnect; request: SniConnectApi.CertKeypairGetConnectRequest; };
  error: true;
  payload: {
    userFacingMessage?:string
  };
}

export enum certKeypairPutConnectActionStatus {
  Pending = 'certKeypairPutConnect_PENDING',
  Fulfilled = 'certKeypairPutConnect_FULFILLED',
  Rejected = 'certKeypairPutConnect_REJECTED',
}
export interface certKeypairPutConnectActionFulfilled {
  type: certKeypairPutConnectActionStatus.Fulfilled;
  meta: { action: Action.certKeypairPutConnect; request: SniConnectApi.CertKeypairPutConnectRequest; };
  payload: void;
}
export interface certKeypairPutConnectActionPending {
  type: certKeypairPutConnectActionStatus.Pending;
  meta: { action: Action.certKeypairPutConnect; request: SniConnectApi.CertKeypairPutConnectRequest; };
}
export interface certKeypairPutConnectActionRejected {
  type: certKeypairPutConnectActionStatus.Rejected;
  meta: { action: Action.certKeypairPutConnect; request: SniConnectApi.CertKeypairPutConnectRequest; };
  error: true;
  payload: {
    userFacingMessage?:string
  };
}

export enum certPutConnectActionStatus {
  Pending = 'certPutConnect_PENDING',
  Fulfilled = 'certPutConnect_FULFILLED',
  Rejected = 'certPutConnect_REJECTED',
}
export interface certPutConnectActionFulfilled {
  type: certPutConnectActionStatus.Fulfilled;
  meta: { action: Action.certPutConnect; request: SniConnectApi.CertPutConnectRequest; };
  payload: void;
}
export interface certPutConnectActionPending {
  type: certPutConnectActionStatus.Pending;
  meta: { action: Action.certPutConnect; request: SniConnectApi.CertPutConnectRequest; };
}
export interface certPutConnectActionRejected {
  type: certPutConnectActionStatus.Rejected;
  meta: { action: Action.certPutConnect; request: SniConnectApi.CertPutConnectRequest; };
  error: true;
  payload: {
    userFacingMessage?:string
  };
}

export class Dispatcher implements ApiInterface {
  readonly apiDelegate:Api;
  readonly dispatcherDelegate:(msg:any)=>Promise<any>;
  constructor(dispatcherDelegate:(msg:any)=>Promise<any>, apiDelegate:Api) {
    this.dispatcherDelegate = dispatcherDelegate;
    this.apiDelegate = apiDelegate || Api;
  }

  accountKeypairDeleteConnect(request: SniConnectApi.AccountKeypairDeleteConnectRequest, metaExtra?:any, headerExtra?:{[key:string]:string}): Promise<void> {
    return this.dispatcherDelegate({
      type: Action.accountKeypairDeleteConnect,
      meta: {
        ...metaExtra,
        action: Action.accountKeypairDeleteConnect,
        request: request,
        retry: (headerExtraOverride?:{[key:string]:string}) => this.accountKeypairDeleteConnect(request, metaExtra, headerExtraOverride || headerExtra),
      },
      payload: this.apiDelegate.getSniConnectApi().accountKeypairDeleteConnect(request, headerExtra),
    });
  }

  accountKeypairGetConnect(request: SniConnectApi.AccountKeypairGetConnectRequest, metaExtra?:any, headerExtra?:{[key:string]:string}): Promise<Model.Keypair> {
    return this.dispatcherDelegate({
      type: Action.accountKeypairGetConnect,
      meta: {
        ...metaExtra,
        action: Action.accountKeypairGetConnect,
        request: request,
        retry: (headerExtraOverride?:{[key:string]:string}) => this.accountKeypairGetConnect(request, metaExtra, headerExtraOverride || headerExtra),
      },
      payload: this.apiDelegate.getSniConnectApi().accountKeypairGetConnect(request, headerExtra),
    });
  }

  accountKeypairPutConnect(request: SniConnectApi.AccountKeypairPutConnectRequest, metaExtra?:any, headerExtra?:{[key:string]:string}): Promise<void> {
    return this.dispatcherDelegate({
      type: Action.accountKeypairPutConnect,
      meta: {
        ...metaExtra,
        action: Action.accountKeypairPutConnect,
        request: request,
        retry: (headerExtraOverride?:{[key:string]:string}) => this.accountKeypairPutConnect(request, metaExtra, headerExtraOverride || headerExtra),
      },
      payload: this.apiDelegate.getSniConnectApi().accountKeypairPutConnect(request, headerExtra),
    });
  }

  certChallengeDeleteConnect(request: SniConnectApi.CertChallengeDeleteConnectRequest, metaExtra?:any, headerExtra?:{[key:string]:string}): Promise<void> {
    return this.dispatcherDelegate({
      type: Action.certChallengeDeleteConnect,
      meta: {
        ...metaExtra,
        action: Action.certChallengeDeleteConnect,
        request: request,
        retry: (headerExtraOverride?:{[key:string]:string}) => this.certChallengeDeleteConnect(request, metaExtra, headerExtraOverride || headerExtra),
      },
      payload: this.apiDelegate.getSniConnectApi().certChallengeDeleteConnect(request, headerExtra),
    });
  }

  certChallengeGetConnect(request: SniConnectApi.CertChallengeGetConnectRequest, metaExtra?:any, headerExtra?:{[key:string]:string}): Promise<Model.Challenge> {
    return this.dispatcherDelegate({
      type: Action.certChallengeGetConnect,
      meta: {
        ...metaExtra,
        action: Action.certChallengeGetConnect,
        request: request,
        retry: (headerExtraOverride?:{[key:string]:string}) => this.certChallengeGetConnect(request, metaExtra, headerExtraOverride || headerExtra),
      },
      payload: this.apiDelegate.getSniConnectApi().certChallengeGetConnect(request, headerExtra),
    });
  }

  certChallengePutConnect(request: SniConnectApi.CertChallengePutConnectRequest, metaExtra?:any, headerExtra?:{[key:string]:string}): Promise<void> {
    return this.dispatcherDelegate({
      type: Action.certChallengePutConnect,
      meta: {
        ...metaExtra,
        action: Action.certChallengePutConnect,
        request: request,
        retry: (headerExtraOverride?:{[key:string]:string}) => this.certChallengePutConnect(request, metaExtra, headerExtraOverride || headerExtra),
      },
      payload: this.apiDelegate.getSniConnectApi().certChallengePutConnect(request, headerExtra),
    });
  }

  certDeleteConnect(request: SniConnectApi.CertDeleteConnectRequest, metaExtra?:any, headerExtra?:{[key:string]:string}): Promise<void> {
    return this.dispatcherDelegate({
      type: Action.certDeleteConnect,
      meta: {
        ...metaExtra,
        action: Action.certDeleteConnect,
        request: request,
        retry: (headerExtraOverride?:{[key:string]:string}) => this.certDeleteConnect(request, metaExtra, headerExtraOverride || headerExtra),
      },
      payload: this.apiDelegate.getSniConnectApi().certDeleteConnect(request, headerExtra),
    });
  }

  certGetConnect(request: SniConnectApi.CertGetConnectRequest, metaExtra?:any, headerExtra?:{[key:string]:string}): Promise<Model.Cert> {
    return this.dispatcherDelegate({
      type: Action.certGetConnect,
      meta: {
        ...metaExtra,
        action: Action.certGetConnect,
        request: request,
        retry: (headerExtraOverride?:{[key:string]:string}) => this.certGetConnect(request, metaExtra, headerExtraOverride || headerExtra),
      },
      payload: this.apiDelegate.getSniConnectApi().certGetConnect(request, headerExtra),
    });
  }

  certKeypairDeleteConnect(request: SniConnectApi.CertKeypairDeleteConnectRequest, metaExtra?:any, headerExtra?:{[key:string]:string}): Promise<void> {
    return this.dispatcherDelegate({
      type: Action.certKeypairDeleteConnect,
      meta: {
        ...metaExtra,
        action: Action.certKeypairDeleteConnect,
        request: request,
        retry: (headerExtraOverride?:{[key:string]:string}) => this.certKeypairDeleteConnect(request, metaExtra, headerExtraOverride || headerExtra),
      },
      payload: this.apiDelegate.getSniConnectApi().certKeypairDeleteConnect(request, headerExtra),
    });
  }

  certKeypairGetConnect(request: SniConnectApi.CertKeypairGetConnectRequest, metaExtra?:any, headerExtra?:{[key:string]:string}): Promise<Model.Keypair> {
    return this.dispatcherDelegate({
      type: Action.certKeypairGetConnect,
      meta: {
        ...metaExtra,
        action: Action.certKeypairGetConnect,
        request: request,
        retry: (headerExtraOverride?:{[key:string]:string}) => this.certKeypairGetConnect(request, metaExtra, headerExtraOverride || headerExtra),
      },
      payload: this.apiDelegate.getSniConnectApi().certKeypairGetConnect(request, headerExtra),
    });
  }

  certKeypairPutConnect(request: SniConnectApi.CertKeypairPutConnectRequest, metaExtra?:any, headerExtra?:{[key:string]:string}): Promise<void> {
    return this.dispatcherDelegate({
      type: Action.certKeypairPutConnect,
      meta: {
        ...metaExtra,
        action: Action.certKeypairPutConnect,
        request: request,
        retry: (headerExtraOverride?:{[key:string]:string}) => this.certKeypairPutConnect(request, metaExtra, headerExtraOverride || headerExtra),
      },
      payload: this.apiDelegate.getSniConnectApi().certKeypairPutConnect(request, headerExtra),
    });
  }

  certPutConnect(request: SniConnectApi.CertPutConnectRequest, metaExtra?:any, headerExtra?:{[key:string]:string}): Promise<void> {
    return this.dispatcherDelegate({
      type: Action.certPutConnect,
      meta: {
        ...metaExtra,
        action: Action.certPutConnect,
        request: request,
        retry: (headerExtraOverride?:{[key:string]:string}) => this.certPutConnect(request, metaExtra, headerExtraOverride || headerExtra),
      },
      payload: this.apiDelegate.getSniConnectApi().certPutConnect(request, headerExtra),
    });
  }
}
