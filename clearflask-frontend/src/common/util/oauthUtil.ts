// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import windowIso from '../windowIso';
import { isProd } from './detectEnv';
import randomUuid from './uuid';

const SUCCESS_LOCALSTORAGE_EVENT_KEY_PREFIX = 'login-success';
export const OAUTH_CODE_PARAM_NAME = 'code';
export const OAUTH_STATE_PARAM_NAME = 'state';
const OAUTH_CSRF_SESSIONSTORAGE_KEY_PREFIX = 'oauth-state';

// OAuth config injected by server at runtime
interface OAuthConfig {
  gitlabClientId?: string;
  jiraClientId?: string;
  slackClientId?: string;
}

declare global {
  interface Window {
    __OAUTH_CONFIG__?: OAuthConfig;
  }
}

const getOAuthConfig = (): OAuthConfig => {
  if (windowIso.isSsr) return {};
  return windowIso.__OAUTH_CONFIG__ || {};
};

const GitHubAppProvider = {
  clientId: isProd() ? 'Iv1.4c1c98e9e6c71cae' : 'github-client-id',
  authorizeUrl: 'https://github.com/login/oauth/authorize',
};

// GitLab OAuth provider for gitlab.com
// For self-hosted GitLab, the authorizeUrl needs to be constructed dynamically
// NOTE: This client ID must match the backend GitLab OAuth configuration
const GitLabProvider: OAuthProvider = {
  clientId: isProd()
    ? (getOAuthConfig().gitlabClientId || 'gitlab-client-id')
    : 'gitlab-client-id',
  authorizeUrl: 'https://gitlab.com/oauth/authorize',
  scope: 'api read_user',
};

// Jira OAuth provider for Atlassian
// NOTE: This client ID must match the backend Jira OAuth configuration
const JiraProvider: OAuthProvider = {
  clientId: isProd()
    ? (getOAuthConfig().jiraClientId || 'jira-client-id')
    : 'jira-client-id',
  authorizeUrl: 'https://auth.atlassian.com/authorize',
  scope: 'read:jira-work write:jira-work',
};

// Slack OAuth provider
// NOTE: This client ID must match the backend Slack OAuth configuration
const SlackProvider: OAuthProvider = {
  clientId: isProd()
    ? (getOAuthConfig().slackClientId || 'slack-client-id')
    : 'slack-client-id',
  authorizeUrl: 'https://slack.com/oauth/v2/authorize',
  // incoming-webhook scope triggers channel picker during OAuth
  // History scopes (channels:history, groups:history) required to receive message events via Events API
  scope: 'incoming-webhook channels:read channels:history channels:write.invites chat:write chat:write.public groups:read groups:history im:history mpim:history',
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

  /**
   * Open GitLab OAuth authorization for gitlab.com
   */
  openForGitLab() {
    this.open(GitLabProvider, 'self');
  }

  /**
   * Open GitLab OAuth authorization for a self-hosted GitLab instance
   * @param gitlabInstanceUrl The base URL of the GitLab instance (e.g., https://gitlab.mycompany.com)
   * @param clientId The OAuth application client ID configured on the GitLab instance
   */
  openForSelfHostedGitLab(gitlabInstanceUrl: string, clientId: string) {
    const provider: OAuthProvider = {
      clientId,
      authorizeUrl: `${gitlabInstanceUrl.replace(/\/$/, '')}/oauth/authorize`,
      scope: 'api read_user',
    };
    this.open(provider, 'self', gitlabInstanceUrl);
  }

  /**
   * Open Jira OAuth authorization for Atlassian Cloud
   */
  openForJira() {
    this.open(JiraProvider, 'self');
  }

  /**
   * Open Slack OAuth authorization
   */
  openForSlack() {
    this.open(SlackProvider, 'self');
  }

  open(provider: OAuthProvider, openTarget: 'window' | 'self', extraData?: string) {
    if (windowIso.isSsr) return;

    const oauthStateStr = this.setState(provider, extraData);

    const link = `${provider.authorizeUrl}?`
      + `response_type=code`
      + `&client_id=${provider.clientId}`
      + `&redirect_uri=${windowIso.location.protocol}//${windowIso.location.host}${this.props.redirectPath}`
      + (provider.scope ? `&scope=${encodeURIComponent(provider.scope)}` : '')
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

