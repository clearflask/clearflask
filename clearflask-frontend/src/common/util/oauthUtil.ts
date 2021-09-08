// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
import windowIso from "../windowIso";
import { isProd } from "./detectEnv";
import randomUuid from "./uuid";

const SUCCESS_LOCALSTORAGE_EVENT_KEY_PREFIX = 'login-success';
export const OAUTH_CODE_PARAM_NAME = 'code';
export const OAUTH_STATE_PARAM_NAME = 'state';
const OAUTH_CSRF_SESSIONSTORAGE_KEY_PREFIX = 'oauth-state';

export type Unsubscribe = () => void;
export interface OAuthToken {
  id: string;
  code: string;
  extraData?: string;
}
export interface OAuthState {
  csrf: string;
  cid: string;
  accountType: string;
  extraData?: string;
}
export interface OAuthProvider {
  clientId: string;
  authorizeUrl: string;
  scope: string;
}

export interface OAuthFlowProps {
  // Set unique if you have multiple account types (ie portal, dashboard)
  accountType: string;
  redirectPath: string;
}
export class OAuthFlow {
  props: OAuthFlowProps;

  constructor(props: OAuthFlowProps) {
    this.props = props;
  }

  openForAccount(providerType: 'google' | 'github' | 'bathtub', extraData?: string) {
    var provider: OAuthProvider;
    switch (providerType) {
      case 'google':
        provider = {
          clientId: isProd() ? '789180657123-biqq6mkgvrkirava961ujkacni5qebuf.apps.googleusercontent.com' : 'google-client-id',
          authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
          scope: 'profile email',
        };
        break;
      case 'github':
        provider = {
          clientId: isProd() ? '2c6e8437eaa489e69c38' : 'github-client-id',
          authorizeUrl: 'https://github.com/login/oauth/authorize',
          scope: 'user:email',
        };
        break;
      case 'bathtub':
        provider = {
          clientId: 'bathtub',
          authorizeUrl: `${windowIso.location.protocol}//${windowIso.location.host}/bathtub/authorize`,
          scope: 'name email',
        };
        break;
      default:
        return;
    }
    this.open(provider, extraData);
  }

  open(provider: OAuthProvider, extraData?: string) {
    if (windowIso.isSsr) return;

    const oauthCsrfToken = randomUuid();
    const oauthState: OAuthState = {
      csrf: oauthCsrfToken,
      cid: provider.clientId,
      accountType: this.props.accountType,
      extraData,
    };
    const oauthStateStr = encodeURIComponent(JSON.stringify(oauthState));
    sessionStorage.setItem(`${OAUTH_CSRF_SESSIONSTORAGE_KEY_PREFIX}-${provider.clientId}`, oauthCsrfToken);

    windowIso.open(`${provider.authorizeUrl}?`
      + `response_type=code`
      + `&client_id=${provider.clientId}`
      + `&redirect_uri=${windowIso.location.protocol}//${windowIso.location.host}${this.props.redirectPath}`
      + `&scope=${provider.scope}`
      + `&${OAUTH_STATE_PARAM_NAME}=${oauthStateStr}`,
      `width=${windowIso.document.documentElement.clientWidth * 0.9},height=${windowIso.document.documentElement.clientHeight * 0.9}`);
  }

  checkResult(): OAuthToken | undefined {
    if (windowIso.isSsr) return undefined;
    const params = new URL(windowIso.location.href).searchParams;
    const oauthCode = params.get(OAUTH_CODE_PARAM_NAME);
    const oauthStateStr = params.get(OAUTH_STATE_PARAM_NAME);
    if (!oauthStateStr || !oauthCode) return undefined;

    var oauthState: OAuthState | undefined;
    try {
      const oauthStateCandidate = JSON.parse(oauthStateStr);
      if (oauthStateCandidate
        && typeof oauthStateCandidate === 'object'
        && oauthStateCandidate.accountType
        && typeof oauthStateCandidate.accountType === 'string'
        && oauthStateCandidate.csrf
        && typeof oauthStateCandidate.csrf === 'string'
        && oauthStateCandidate.cid
        && typeof oauthStateCandidate.cid === 'string') {
        oauthState = oauthStateCandidate;
      }
    } catch (e) {
      oauthState = undefined;
    }
    if (!oauthState) return undefined;
    if (oauthState.accountType !== this.props.accountType) return undefined;

    const oauthCsrfExpected = windowIso.sessionStorage.getItem(`${OAUTH_CSRF_SESSIONSTORAGE_KEY_PREFIX}-${oauthState.cid}`);
    if (oauthCsrfExpected !== oauthState?.csrf) return undefined;
    windowIso.sessionStorage.removeItem(`${OAUTH_CSRF_SESSIONSTORAGE_KEY_PREFIX}-${oauthState.cid}`)

    return {
      id: oauthState.cid,
      code: oauthCode,
      extraData: oauthState.extraData,
    };
  }

  listenForSuccess(onSuccess: () => void): Unsubscribe {
    if (windowIso.isSsr) return () => { };

    // This is one of those funny JS cases where you can have a circular reference of variables (listener and unsubscribe)
    const listener = (ev: StorageEvent) => {
      if (ev.key !== (`${SUCCESS_LOCALSTORAGE_EVENT_KEY_PREFIX}-${this.props.accountType}-${windowIso.location.host}`)) return;
      onSuccess();
      unsubscribe?.();
    }
    const unsubscribe = () => !windowIso.isSsr && windowIso.removeEventListener('storage', listener);

    windowIso.addEventListener('storage', listener);

    return unsubscribe;
  }

  broadcastSuccess() {
    // Broadcast success to all windows in the browser
    localStorage.setItem(`${SUCCESS_LOCALSTORAGE_EVENT_KEY_PREFIX}-${this.props.accountType}-${windowIso.location.host}`, '1');
    localStorage.removeItem(`${SUCCESS_LOCALSTORAGE_EVENT_KEY_PREFIX}-${this.props.accountType}-${windowIso.location.host}`);
  }
}

