// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import windowIso from '../windowIso';
import { isProd } from './detectEnv';
import randomUuid from './uuid';

const SUCCESS_LOCALSTORAGE_EVENT_KEY_PREFIX = 'login-success';
export const OAUTH_CODE_PARAM_NAME = 'code';
export const OAUTH_STATE_PARAM_NAME = 'state';
const OAUTH_CSRF_SESSIONSTORAGE_KEY_PREFIX = 'oauth-state';

const GitHubAppProvider = {
  clientId: isProd() ? 'Iv1.4c1c98e9e6c71cae' : 'github-client-id',
  authorizeUrl: 'https://github.com/login/oauth/authorize',
};

// Jira Cloud OAuth 2.0 (3LO)
// Requires configuring Jira OAuth app at https://developer.atlassian.com/console/myapps/
const JiraAppProvider: OAuthProvider = {
  clientId: isProd() ? '' : 'jira-client-id', // TODO: Replace with actual Jira OAuth client ID
  authorizeUrl: 'https://auth.atlassian.com/authorize',
  scope: 'read:jira-user read:jira-work manage:jira-configuration write:jira-work manage:jira-webhook offline_access',
};

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
  scope?: string;
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

  openForAccount(providerType: 'google' | 'github' | 'bathtub', openTarget: 'window' | 'self', extraData?: string) {
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
    this.open(provider, openTarget, extraData);
  }

  openForGitHubApp() {
    this.open(GitHubAppProvider, 'self');
  }

  openForGitHubAppInstall() {
    if (windowIso.isSsr) return;

    const oauthStateStr = this.setState(GitHubAppProvider);

    windowIso.location.href = `https://github.com/apps/clearflask?`
      + `${OAUTH_STATE_PARAM_NAME}=${oauthStateStr}`;
  }

  openForJiraApp() {
    if (windowIso.isSsr) return;

    const oauthStateStr = this.setState(JiraAppProvider);

    // Jira OAuth 2.0 (3LO) requires audience parameter
    windowIso.location.href = `${JiraAppProvider.authorizeUrl}?`
      + `audience=api.atlassian.com`
      + `&client_id=${JiraAppProvider.clientId}`
      + `&scope=${encodeURIComponent(JiraAppProvider.scope || '')}`
      + `&redirect_uri=${encodeURIComponent(`${windowIso.location.protocol}//${windowIso.location.host}${this.props.redirectPath}`)}`
      + `&${OAUTH_STATE_PARAM_NAME}=${oauthStateStr}`
      + `&response_type=code`
      + `&prompt=consent`;
  }

  open(provider: OAuthProvider, openTarget: 'window' | 'self', extraData?: string) {
    if (windowIso.isSsr) return;

    const oauthStateStr = this.setState(provider, extraData);

    const link = `${provider.authorizeUrl}?`
      + `response_type=code`
      + `&client_id=${provider.clientId}`
      + `&redirect_uri=${windowIso.location.protocol}//${windowIso.location.host}${this.props.redirectPath}`
      + (provider.scope ? `&scope=${provider.scope}` : '')
      + `&${OAUTH_STATE_PARAM_NAME}=${oauthStateStr}`;

    if (openTarget === 'window') {
      windowIso.open(link,
        `width=${windowIso.document.documentElement.clientWidth * 0.9}`
        + `,height=${windowIso.document.documentElement.clientHeight * 0.9}`);
    } else {
      windowIso.location.href = link;
    }
  }

  setState(provider: OAuthProvider, extraData?: string): string {
    const oauthCsrfToken = randomUuid();
    const oauthState: OAuthState = {
      csrf: oauthCsrfToken,
      cid: provider.clientId,
      accountType: this.props.accountType,
      extraData,
    };
    const oauthStateStr = encodeURIComponent(JSON.stringify(oauthState));
    // Use sessionStorage for CSRF tokens (more secure, per-tab isolation)
    sessionStorage.setItem(`${OAUTH_CSRF_SESSIONSTORAGE_KEY_PREFIX}-${provider.clientId}`, oauthCsrfToken);
    return oauthStateStr;
  }

  checkResult(): OAuthToken | undefined {
    if (windowIso.isSsr) return undefined;
    const params = new URL(windowIso.location.href).searchParams;
    const oauthCode = params.get(OAUTH_CODE_PARAM_NAME);
    const oauthStateStr = params.get(OAUTH_STATE_PARAM_NAME);
    if (!oauthStateStr || !oauthCode) {
      return undefined;
    }

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
      } else {
        console.log("Invalid oauth state format", oauthStateCandidate);
      }
    } catch (e) {
      oauthState = undefined;
      console.log("Failed to parse oauth state", oauthStateStr, e);
    }
    if (!oauthState) return undefined;
    if (oauthState.accountType !== this.props.accountType) {
      console.log("Account type mismatch", oauthState.accountType, this.props.accountType)
      return undefined;
    }

    const storageKey = `${OAUTH_CSRF_SESSIONSTORAGE_KEY_PREFIX}-${oauthState.cid}`;
    const oauthCsrfExpected = sessionStorage.getItem(storageKey);
    if (oauthCsrfExpected !== oauthState?.csrf) {
      console.log("CSRF mismatch", oauthCsrfExpected, oauthState?.csrf);
      return undefined;
    }
    // Clean up CSRF token after successful validation
    sessionStorage.removeItem(storageKey);

    const oAuthToken: OAuthToken = {
      id: oauthState.cid,
      code: oauthCode,
      extraData: oauthState.extraData,
    }
    console.log("OAuth success", oAuthToken);

    return oAuthToken;
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

