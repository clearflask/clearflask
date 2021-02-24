import { History, Location } from 'history';
import React, { Component } from 'react';
import { Provider } from 'react-redux';
import { match } from 'react-router';
import { Route } from 'react-router-dom';
import * as Client from '../api/client';
import { Server, StateSettings, Status } from '../api/server';
import ServerMock from '../api/serverMock';
import WebNotification, { Status as WebNotificationStatus } from '../common/notification/webNotification';
import { detectEnv, Environment, isTracking } from '../common/util/detectEnv';
import randomUuid from '../common/util/uuid';
import windowIso from '../common/windowIso';
import IntercomWrapperCustomer from '../site/IntercomWrapperCustomer';
import AccountPage from './AccountPage';
import AppThemeProvider from './AppThemeProvider';
import BankPage from './BankPage';
import BasePage from './BasePage';
import { OAuthState, OAUTH_CODE_PARAM_NAME, OAUTH_CSRF_SESSIONSTORAGE_KEY_PREFIX, OAUTH_STATE_PARAM_NAME } from './comps/LogIn';
import PostPage from './comps/PostPage';
import UserPage from './comps/UserPage';
import CustomPage from './CustomPage';
import ErrorPage from './ErrorPage';
import Header from './Header';
import SsoSuccessPage from './SsoSuccessPage';
import AnimatedPageSwitch from './utils/AnimatedRoutes';
import CaptchaChallenger from './utils/CaptchaChallenger';
import CustomerExternalTrackers from './utils/CustomerExternalTrackers';
import Loading from './utils/Loading';
import PrivateProjectLogin from './utils/PrivateProjectLogin';
import PushNotificationListener from './utils/PushNotificationListener';
import ServerErrorNotifier from './utils/ServerErrorNotifier';

/** Broadcast successful bind to other tabs */
export const BIND_SUCCESS_LOCALSTORAGE_EVENT_KEY = 'bind-success';

/** If changed, also change in NotificationServiceImpl.java */
export const AUTH_TOKEN_PARAM_NAME = 'authToken';
/** If changed, also change in NotificationServiceImpl.java */
export const SSO_TOKEN_PARAM_NAME = 'token';
/** If changed, also change it wherever it is in Java */
export const EMAIL_VERIFY_TOKEN_PARAM_NAME = 'token';

interface Props {
  slug: string;
  serverOverride?: Server;
  supressCssBaseline?: boolean;
  isInsideContainer?: boolean;
  settings?: StateSettings;
  onAddGaCode?: (gaCode: string) => void;
  // Router matching
  match: match;
  history: History;
  location: Location;
}
class App extends Component<Props> {
  readonly uniqId = randomUuid();
  readonly server;

  constructor(props) {
    super(props);

    this.server = this.getOrCreateServer();

    const storeState = this.server.getStore().getState();
    const hasConfig = storeState.conf.status !== undefined;
    if (windowIso.isSsr && !hasConfig) {
      this.initSsr();
    } else {
      this.init().finally(() => {
        // Start render since we received our configuration
        this.forceUpdate();
      });
    }
  }

  getOrCreateServer(): Server {
    var server: Server | undefined;
    if (this.props.serverOverride) {
      server = this.props.serverOverride;
    } else if (detectEnv() === Environment.DEVELOPMENT_FRONTEND) {
      server = new Server(undefined, this.props.settings, ServerMock.get());
    } else {
      server = new Server(undefined, this.props.settings);
    }
    return server;
  }

  async initSsr() {
    await (await this.server.dispatch({ ssr: true, ssrStatusPassthrough: true })).configGetAndUserBind({
      slug: this.props.slug,
      userBind: {
        skipBind: windowIso.isSsr,
      },
    });
  }

  async init() {
    const params = new URL(windowIso.location.href).searchParams;
    // Used for links within emails
    const authToken = params.get(AUTH_TOKEN_PARAM_NAME);
    // Used for SSO
    const token = params.get(SSO_TOKEN_PARAM_NAME);
    if (token || authToken) {
      // Clear token from URL for safety
      this.props.history.replace(this.props.location.pathname);
    }
    // Used for OAuth
    var oauthToken: Client.UserBindOauthToken | undefined;
    const oauthCode = params.get(OAUTH_CODE_PARAM_NAME);
    const oauthStateStr = params.get(OAUTH_STATE_PARAM_NAME);
    if (oauthStateStr && oauthCode) {
      var oauthState: OAuthState | undefined;
      try {
        const oauthStateCandidate = JSON.parse(oauthStateStr);
        if (oauthStateCandidate
          && typeof oauthStateCandidate === 'object'
          && oauthStateCandidate.csrf
          && typeof oauthStateCandidate.csrf === 'string'
          && oauthStateCandidate.oid
          && typeof oauthStateCandidate.oid === 'string') {
          oauthState = oauthStateCandidate;
        }
      } catch (e) {
        oauthState = undefined;
      }
      if (oauthState) {
        const oauthCsrfExpected = sessionStorage.getItem(`${OAUTH_CSRF_SESSIONSTORAGE_KEY_PREFIX}-${oauthState.oid}`);
        if (oauthCsrfExpected === oauthState?.csrf) {
          sessionStorage.removeItem(`${OAUTH_CSRF_SESSIONSTORAGE_KEY_PREFIX}-${oauthState.oid}`)
          oauthToken = {
            id: oauthState.oid,
            code: oauthCode,
          };
        }
      }
    }

    var configResult = await (await this.server.dispatch()).configGetAndUserBind({
      slug: this.props.slug,
      userBind: {
        ssoToken: token || undefined,
        authToken: authToken || undefined,
        oauthToken: oauthToken || undefined,
      },
    });
    var user = configResult.user;

    // If no user is logged in, check if Web Push is enabled
    // It's possible user cleared cookies and we can log in using the Web Push result
    // We didn't try it in the first call since getting permission may take time
    // and this is a corner case
    const projectId = configResult.config?.config.projectId;
    const loggedIn = !!configResult?.user;
    if (!loggedIn) {
      var subscriptionResult;
      if (WebNotification.getInstance().getStatus() === WebNotificationStatus.Granted) {
        subscriptionResult = await WebNotification.getInstance().getPermission();
      }

      if (subscriptionResult?.type === 'success' && !!subscriptionResult.token) {
        if (!projectId) {
          // projectId missing, meaning project is private and requires login
          try {
            configResult = await (await this.server.dispatch()).configGetAndUserBind({
              slug: this.props.slug,
              userBind: {
                browserPushToken: subscriptionResult.token,
              },
            });
            user = configResult.user;
          } catch (err) {
            if (err?.status === 404) {
              // Continue
            } else {
              throw err;
            }
          }
        } else {
          user = (await (await this.server.dispatch()).userBind({
            projectId: projectId,
            userBind: {
              browserPushToken: subscriptionResult.token,
            },
          })).user;
        }
      }
    }

    if (!!user) {
      // Broadcast to other tabs of successful bind
      localStorage.setItem(BIND_SUCCESS_LOCALSTORAGE_EVENT_KEY, '1');
      localStorage.removeItem(BIND_SUCCESS_LOCALSTORAGE_EVENT_KEY);
    }
  }

  render() {
    const confStatus = this.server.getStore().getState().conf.status;
    if (!confStatus || confStatus === Status.PENDING) {
      return (<Loading />);
    } else if (confStatus === Status.REJECTED) {
      return (
        <ErrorPage msg={this.server.getStore().getState().conf.rejectionMessage || 'Failed to load'} />
      );
    }

    const projectId = this.server.getProjectId();
    const appRootId = `appRoot-${projectId}-${this.uniqId}`;

    return (
      <Provider store={this.server.getStore()}>
        <AppThemeProvider
          appRootId={appRootId}
          seed={projectId}
          isInsideContainer={this.props.isInsideContainer}
          supressCssBaseline={this.props.supressCssBaseline}
          containerStyle={{
            flexGrow: 1,
            display: 'flex',
            flexDirection: 'column',
            overflowY: this.props.settings?.demoScrollY ? 'scroll' : undefined,
          }}
        >
          <PushNotificationListener server={this.server} />
          <ServerErrorNotifier />
          <CaptchaChallenger />
          <div
            key={appRootId}
            id={appRootId}
            style={{
              flexGrow: 1,
              display: 'flex',
              flexDirection: 'column',
              height: '100%',
              width: '100%',
              ...(this.props.isInsideContainer ? {
                position: 'relative',
              } : {}),
            }}
          >
            <PrivateProjectLogin server={this.server}>
              {isTracking() && (<CustomerExternalTrackers />)}
              <IntercomWrapperCustomer />
              <Route key='header' path='/:page?' render={props => ['embed', 'sso', 'oauth'].includes(props.match.params['page']) ? null : (
                <Header
                  pageSlug={props.match.params['page'] || ''}
                  server={this.server}
                  pageChanged={this.pageChanged.bind(this)}
                />
              )} />
              <AnimatedPageSwitch
                key='app-switch'
                render={(pageSlug: string) => (
                  <Route key={pageSlug} path={`/:embed(embed)?/${pageSlug}`} render={props => (
                    <BasePage showFooter={!props.match.params['embed']} customPageSlug={pageSlug}>
                      <CustomPage
                        pageSlug={pageSlug}
                        server={this.server}
                      />
                    </BasePage>
                  )} />
                )} >
                <Route key='user' path='/:embed(embed)?/user/:userId?' render={props => (
                  <BasePage suppressPageTitle showFooter={!props.match.params['embed']}>
                    <UserPage server={this.server} userId={props.match.params.userId} />
                  </BasePage>
                )} />
                <Route key='transaction' path='/:embed(embed)?/transaction' render={props => (
                  <BasePage pageTitle='Bank' showFooter={!props.match.params['embed']}>
                    <BankPage server={this.server} />
                  </BasePage>
                )} />
                <Route key='account' path='/:embed(embed)?/account' render={props => (
                  <BasePage pageTitle='Account' showFooter={!props.match.params['embed']}>
                    <AccountPage server={this.server} />
                  </BasePage>
                )} />
                <Route key='sso' path='/:type(sso|oauth)' render={props => (
                  <BasePage
                    pageTitle={props.match.params['type'] === 'sso' ? 'Single Sign-On' : 'OAuth'}
                    showFooter={!props.match.params['embed']}>
                    <SsoSuccessPage type={props.match.params['type']} />
                  </BasePage>
                )} />
                <Route key='post' path='/:embed(embed)?/post/:postId' render={props => (
                  <BasePage suppressPageTitle showFooter={!props.match.params['embed']}>
                    <PostPage
                      key={'postpage=' + props.match.params['postId']}
                      postId={props.match.params['postId'] || ''}
                      server={this.server}
                    />
                  </BasePage>
                )} />
              </AnimatedPageSwitch>
            </PrivateProjectLogin>
          </div>
        </AppThemeProvider>
      </Provider>
    );
  }

  pageChanged(pageUrlName: string): void {
    this.props.history.push(`${this.props.match.url}${pageUrlName}`);
  }
}

export default App;
