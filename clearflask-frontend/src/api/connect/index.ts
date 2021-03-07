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
  certChallengeDnsDeleteConnect = 'certChallengeDnsDeleteConnect',
  certChallengeDnsGetConnect = 'certChallengeDnsGetConnect',
  certChallengeDnsPutConnect = 'certChallengeDnsPutConnect',
  certChallengeHttpDeleteConnect = 'certChallengeHttpDeleteConnect',
  certChallengeHttpGetConnect = 'certChallengeHttpGetConnect',
  certChallengeHttpPutConnect = 'certChallengeHttpPutConnect',
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
  | certChallengeDnsDeleteConnectActionFulfilled
  | certChallengeDnsDeleteConnectActionPending
  | certChallengeDnsDeleteConnectActionRejected
  | certChallengeDnsGetConnectActionFulfilled
  | certChallengeDnsGetConnectActionPending
  | certChallengeDnsGetConnectActionRejected
  | certChallengeDnsPutConnectActionFulfilled
  | certChallengeDnsPutConnectActionPending
  | certChallengeDnsPutConnectActionRejected
  | certChallengeHttpDeleteConnectActionFulfilled
  | certChallengeHttpDeleteConnectActionPending
  | certChallengeHttpDeleteConnectActionRejected
  | certChallengeHttpGetConnectActionFulfilled
  | certChallengeHttpGetConnectActionPending
  | certChallengeHttpGetConnectActionRejected
  | certChallengeHttpPutConnectActionFulfilled
  | certChallengeHttpPutConnectActionPending
  | certChallengeHttpPutConnectActionRejected
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

export enum certChallengeDnsDeleteConnectActionStatus {
  Pending = 'certChallengeDnsDeleteConnect_PENDING',
  Fulfilled = 'certChallengeDnsDeleteConnect_FULFILLED',
  Rejected = 'certChallengeDnsDeleteConnect_REJECTED',
}
export interface certChallengeDnsDeleteConnectActionFulfilled {
  type: certChallengeDnsDeleteConnectActionStatus.Fulfilled;
  meta: { action: Action.certChallengeDnsDeleteConnect; request: SniConnectApi.CertChallengeDnsDeleteConnectRequest; };
  payload: void;
}
export interface certChallengeDnsDeleteConnectActionPending {
  type: certChallengeDnsDeleteConnectActionStatus.Pending;
  meta: { action: Action.certChallengeDnsDeleteConnect; request: SniConnectApi.CertChallengeDnsDeleteConnectRequest; };
}
export interface certChallengeDnsDeleteConnectActionRejected {
  type: certChallengeDnsDeleteConnectActionStatus.Rejected;
  meta: { action: Action.certChallengeDnsDeleteConnect; request: SniConnectApi.CertChallengeDnsDeleteConnectRequest; };
  error: true;
  payload: {
    userFacingMessage?:string
  };
}

export enum certChallengeDnsGetConnectActionStatus {
  Pending = 'certChallengeDnsGetConnect_PENDING',
  Fulfilled = 'certChallengeDnsGetConnect_FULFILLED',
  Rejected = 'certChallengeDnsGetConnect_REJECTED',
}
export interface certChallengeDnsGetConnectActionFulfilled {
  type: certChallengeDnsGetConnectActionStatus.Fulfilled;
  meta: { action: Action.certChallengeDnsGetConnect; request: SniConnectApi.CertChallengeDnsGetConnectRequest; };
  payload: Model.Challenge;
}
export interface certChallengeDnsGetConnectActionPending {
  type: certChallengeDnsGetConnectActionStatus.Pending;
  meta: { action: Action.certChallengeDnsGetConnect; request: SniConnectApi.CertChallengeDnsGetConnectRequest; };
}
export interface certChallengeDnsGetConnectActionRejected {
  type: certChallengeDnsGetConnectActionStatus.Rejected;
  meta: { action: Action.certChallengeDnsGetConnect; request: SniConnectApi.CertChallengeDnsGetConnectRequest; };
  error: true;
  payload: {
    userFacingMessage?:string
  };
}

export enum certChallengeDnsPutConnectActionStatus {
  Pending = 'certChallengeDnsPutConnect_PENDING',
  Fulfilled = 'certChallengeDnsPutConnect_FULFILLED',
  Rejected = 'certChallengeDnsPutConnect_REJECTED',
}
export interface certChallengeDnsPutConnectActionFulfilled {
  type: certChallengeDnsPutConnectActionStatus.Fulfilled;
  meta: { action: Action.certChallengeDnsPutConnect; request: SniConnectApi.CertChallengeDnsPutConnectRequest; };
  payload: void;
}
export interface certChallengeDnsPutConnectActionPending {
  type: certChallengeDnsPutConnectActionStatus.Pending;
  meta: { action: Action.certChallengeDnsPutConnect; request: SniConnectApi.CertChallengeDnsPutConnectRequest; };
}
export interface certChallengeDnsPutConnectActionRejected {
  type: certChallengeDnsPutConnectActionStatus.Rejected;
  meta: { action: Action.certChallengeDnsPutConnect; request: SniConnectApi.CertChallengeDnsPutConnectRequest; };
  error: true;
  payload: {
    userFacingMessage?:string
  };
}

export enum certChallengeHttpDeleteConnectActionStatus {
  Pending = 'certChallengeHttpDeleteConnect_PENDING',
  Fulfilled = 'certChallengeHttpDeleteConnect_FULFILLED',
  Rejected = 'certChallengeHttpDeleteConnect_REJECTED',
}
export interface certChallengeHttpDeleteConnectActionFulfilled {
  type: certChallengeHttpDeleteConnectActionStatus.Fulfilled;
  meta: { action: Action.certChallengeHttpDeleteConnect; request: SniConnectApi.CertChallengeHttpDeleteConnectRequest; };
  payload: void;
}
export interface certChallengeHttpDeleteConnectActionPending {
  type: certChallengeHttpDeleteConnectActionStatus.Pending;
  meta: { action: Action.certChallengeHttpDeleteConnect; request: SniConnectApi.CertChallengeHttpDeleteConnectRequest; };
}
export interface certChallengeHttpDeleteConnectActionRejected {
  type: certChallengeHttpDeleteConnectActionStatus.Rejected;
  meta: { action: Action.certChallengeHttpDeleteConnect; request: SniConnectApi.CertChallengeHttpDeleteConnectRequest; };
  error: true;
  payload: {
    userFacingMessage?:string
  };
}

export enum certChallengeHttpGetConnectActionStatus {
  Pending = 'certChallengeHttpGetConnect_PENDING',
  Fulfilled = 'certChallengeHttpGetConnect_FULFILLED',
  Rejected = 'certChallengeHttpGetConnect_REJECTED',
}
export interface certChallengeHttpGetConnectActionFulfilled {
  type: certChallengeHttpGetConnectActionStatus.Fulfilled;
  meta: { action: Action.certChallengeHttpGetConnect; request: SniConnectApi.CertChallengeHttpGetConnectRequest; };
  payload: Model.Challenge;
}
export interface certChallengeHttpGetConnectActionPending {
  type: certChallengeHttpGetConnectActionStatus.Pending;
  meta: { action: Action.certChallengeHttpGetConnect; request: SniConnectApi.CertChallengeHttpGetConnectRequest; };
}
export interface certChallengeHttpGetConnectActionRejected {
  type: certChallengeHttpGetConnectActionStatus.Rejected;
  meta: { action: Action.certChallengeHttpGetConnect; request: SniConnectApi.CertChallengeHttpGetConnectRequest; };
  error: true;
  payload: {
    userFacingMessage?:string
  };
}

export enum certChallengeHttpPutConnectActionStatus {
  Pending = 'certChallengeHttpPutConnect_PENDING',
  Fulfilled = 'certChallengeHttpPutConnect_FULFILLED',
  Rejected = 'certChallengeHttpPutConnect_REJECTED',
}
export interface certChallengeHttpPutConnectActionFulfilled {
  type: certChallengeHttpPutConnectActionStatus.Fulfilled;
  meta: { action: Action.certChallengeHttpPutConnect; request: SniConnectApi.CertChallengeHttpPutConnectRequest; };
  payload: void;
}
export interface certChallengeHttpPutConnectActionPending {
  type: certChallengeHttpPutConnectActionStatus.Pending;
  meta: { action: Action.certChallengeHttpPutConnect; request: SniConnectApi.CertChallengeHttpPutConnectRequest; };
}
export interface certChallengeHttpPutConnectActionRejected {
  type: certChallengeHttpPutConnectActionStatus.Rejected;
  meta: { action: Action.certChallengeHttpPutConnect; request: SniConnectApi.CertChallengeHttpPutConnectRequest; };
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

  certChallengeDnsDeleteConnect(request: SniConnectApi.CertChallengeDnsDeleteConnectRequest, metaExtra?:any, headerExtra?:{[key:string]:string}): Promise<void> {
    return this.dispatcherDelegate({
      type: Action.certChallengeDnsDeleteConnect,
      meta: {
        ...metaExtra,
        action: Action.certChallengeDnsDeleteConnect,
        request: request,
        retry: (headerExtraOverride?:{[key:string]:string}) => this.certChallengeDnsDeleteConnect(request, metaExtra, headerExtraOverride || headerExtra),
      },
      payload: this.apiDelegate.getSniConnectApi().certChallengeDnsDeleteConnect(request, headerExtra),
    });
  }

  certChallengeDnsGetConnect(request: SniConnectApi.CertChallengeDnsGetConnectRequest, metaExtra?:any, headerExtra?:{[key:string]:string}): Promise<Model.Challenge> {
    return this.dispatcherDelegate({
      type: Action.certChallengeDnsGetConnect,
      meta: {
        ...metaExtra,
        action: Action.certChallengeDnsGetConnect,
        request: request,
        retry: (headerExtraOverride?:{[key:string]:string}) => this.certChallengeDnsGetConnect(request, metaExtra, headerExtraOverride || headerExtra),
      },
      payload: this.apiDelegate.getSniConnectApi().certChallengeDnsGetConnect(request, headerExtra),
    });
  }

  certChallengeDnsPutConnect(request: SniConnectApi.CertChallengeDnsPutConnectRequest, metaExtra?:any, headerExtra?:{[key:string]:string}): Promise<void> {
    return this.dispatcherDelegate({
      type: Action.certChallengeDnsPutConnect,
      meta: {
        ...metaExtra,
        action: Action.certChallengeDnsPutConnect,
        request: request,
        retry: (headerExtraOverride?:{[key:string]:string}) => this.certChallengeDnsPutConnect(request, metaExtra, headerExtraOverride || headerExtra),
      },
      payload: this.apiDelegate.getSniConnectApi().certChallengeDnsPutConnect(request, headerExtra),
    });
  }

  certChallengeHttpDeleteConnect(request: SniConnectApi.CertChallengeHttpDeleteConnectRequest, metaExtra?:any, headerExtra?:{[key:string]:string}): Promise<void> {
    return this.dispatcherDelegate({
      type: Action.certChallengeHttpDeleteConnect,
      meta: {
        ...metaExtra,
        action: Action.certChallengeHttpDeleteConnect,
        request: request,
        retry: (headerExtraOverride?:{[key:string]:string}) => this.certChallengeHttpDeleteConnect(request, metaExtra, headerExtraOverride || headerExtra),
      },
      payload: this.apiDelegate.getSniConnectApi().certChallengeHttpDeleteConnect(request, headerExtra),
    });
  }

  certChallengeHttpGetConnect(request: SniConnectApi.CertChallengeHttpGetConnectRequest, metaExtra?:any, headerExtra?:{[key:string]:string}): Promise<Model.Challenge> {
    return this.dispatcherDelegate({
      type: Action.certChallengeHttpGetConnect,
      meta: {
        ...metaExtra,
        action: Action.certChallengeHttpGetConnect,
        request: request,
        retry: (headerExtraOverride?:{[key:string]:string}) => this.certChallengeHttpGetConnect(request, metaExtra, headerExtraOverride || headerExtra),
      },
      payload: this.apiDelegate.getSniConnectApi().certChallengeHttpGetConnect(request, headerExtra),
    });
  }

  certChallengeHttpPutConnect(request: SniConnectApi.CertChallengeHttpPutConnectRequest, metaExtra?:any, headerExtra?:{[key:string]:string}): Promise<void> {
    return this.dispatcherDelegate({
      type: Action.certChallengeHttpPutConnect,
      meta: {
        ...metaExtra,
        action: Action.certChallengeHttpPutConnect,
        request: request,
        retry: (headerExtraOverride?:{[key:string]:string}) => this.certChallengeHttpPutConnect(request, metaExtra, headerExtraOverride || headerExtra),
      },
      payload: this.apiDelegate.getSniConnectApi().certChallengeHttpPutConnect(request, headerExtra),
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
