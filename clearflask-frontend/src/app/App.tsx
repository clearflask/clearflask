// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
import { History, Location } from 'history';
import React, { Component } from 'react';
import { Provider } from 'react-redux';
import { match } from 'react-router';
import { Route } from 'react-router-dom';
import { Server, StateSettings, Status } from '../api/server';
import ServerMock from '../api/serverMock';
import WebNotification, { Status as WebNotificationStatus } from '../common/notification/webNotification';
import { detectEnv, Environment, isTracking } from '../common/util/detectEnv';
import { IframeBroadcastPathname } from '../common/util/iframeUrlSync';
import { OAuthFlow } from '../common/util/oauthUtil';
import { RouteWithStatus } from '../common/util/routerUtil';
import randomUuid from '../common/util/uuid';
import windowIso from '../common/windowIso';
import IntercomWrapperCustomer from '../site/IntercomWrapperCustomer';
import { SentryIdentifyUser } from '../site/SentryIdentify';
import AccountPage from './AccountPage';
import AppThemeProvider from './AppThemeProvider';
import BankPage from './BankPage';
import BasePage from './BasePage';
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
    if (windowIso.isSsr) {
      if (!hasConfig) {
        windowIso.awaitPromises.push(this.initSsr());
      }
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
    const dispatcher = await this.server.dispatch({ ssr: true, ssrStatusPassthrough: true });
    return await dispatcher.configBindSlug({
      slug: this.props.slug,
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
    const oauthFlow = new OAuthFlow({ accountType: 'user', redirectPath: '/oauth' });
    const oauthToken = oauthFlow.checkResult();
    // Used for logging in via web notification permission
    var browserPushToken;
    if (WebNotification.getInstance().getStatus() === WebNotificationStatus.Granted) {
      const subscriptionResult = await WebNotification.getInstance().getPermission();
      if (subscriptionResult?.type === 'success') {
        browserPushToken = subscriptionResult.token;
      }
    }

    var result;
    if (this.server.getStore().getState().conf.status !== Status.FULFILLED) {
      try {
        result = await (await this.server.dispatch()).configAndUserBindSlug({
          slug: this.props.slug,
          userBind: {
            ssoToken: token || undefined,
            authToken: authToken || undefined,
            oauthToken: oauthToken || undefined,
            browserPushToken,
          },
        });
      } catch (err) {
        if (err?.status !== 404) {
          throw err;
        }
      }
    } else {
      result = await (await this.server.dispatch()).userBindSlug({
        slug: this.props.slug,
        userBind: {
          ssoToken: token || undefined,
          authToken: authToken || undefined,
          oauthToken: oauthToken || undefined,
          browserPushToken,
        },
      });
    }

    if (!!result?.user) {
      oauthFlow.broadcastSuccess();
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
        <SentryIdentifyUser />
        <IframeBroadcastPathname />
        <AppThemeProvider
          appRootId={appRootId}
          seed={projectId}
          isInsideContainer={this.props.isInsideContainer}
          supressCssBaseline={this.props.supressCssBaseline}
          containerStyle={theme => ({
            flexGrow: 1,
            display: 'flex',
            flexDirection: 'column',
            overflowY: this.props.settings?.demoScrollY ? 'scroll' : undefined,
          })}
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
                  <Route exact key={pageSlug} path={`/:embed(embed)?/${pageSlug}`} render={props => (
                    <BasePage showFooter={!props.match.params['embed']} customPageSlug={pageSlug}>
                      <CustomPage
                        pageSlug={pageSlug}
                        server={this.server}
                      />
                    </BasePage>
                  )} />
                )}
                notFoundRoute={(
                  <RouteWithStatus httpCode={404} >
                    <BasePage
                      pageTitle='Page not found'
                      showFooter
                    >
                      <ErrorPage msg='Page not found' variant='error' />
                    </BasePage>
                  </RouteWithStatus>
                )}
              >
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
