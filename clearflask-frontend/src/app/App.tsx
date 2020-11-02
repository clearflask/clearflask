import { History, Location } from 'history';
import React, { Component } from 'react';
import { Provider } from 'react-redux';
import { match } from 'react-router';
import { Route } from 'react-router-dom';
import { Server, StateSettings } from '../api/server';
import ServerMock from '../api/serverMock';
import WebNotification, { Status } from '../common/notification/webNotification';
import { detectEnv, Environment } from '../common/util/detectEnv';
import randomUuid from '../common/util/uuid';
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
  // Router matching
  match: match;
  history: History;
  location: Location;
}
interface State {
  notFound?: boolean;
  server?: Server;
}
class App extends Component<Props, State> {
  state: State = {};
  readonly uniqId = randomUuid();

  constructor(props) {
    super(props);

    this.init();
  }

  async init() {
    // Used for links within emails
    const authToken = new URL(window.location.href).searchParams.get(AUTH_TOKEN_PARAM_NAME);
    // Used for SSO
    const token = new URL(window.location.href).searchParams.get(SSO_TOKEN_PARAM_NAME);
    if (token || authToken) {
      // Clear token from URL for safety
      this.props.history.replace(this.props.location.pathname);
    }

    var server: Server | undefined;
    if (this.props.serverOverride) {
      server = this.props.serverOverride;
    } else if (detectEnv() === Environment.DEVELOPMENT_FRONTEND) {
      server = new Server(undefined, this.props.settings, ServerMock.get());
    } else {
      server = new Server(undefined, this.props.settings);
    }

    var subscriptionResult;
    if (WebNotification.getInstance().getStatus() === Status.Granted) {
      subscriptionResult = await WebNotification.getInstance().getPermission();
    }

    var configAndBindResult;
    try {
      configAndBindResult = await server.dispatch().configGetAndUserBind({
        slug: this.props.slug,
        configGetAndUserBind: {
          ssoToken: token || undefined,
          authToken: authToken || undefined,
          browserPushToken: (subscriptionResult !== undefined && subscriptionResult.type === 'success')
            ? subscriptionResult.token : undefined,
        },
      });
    } catch (err) {
      if (err?.status === 404) {
        this.setState({ notFound: true });
        return;
      }
      throw err;
    }

    // Start render since we received our configuration
    this.setState({ server });

    if (configAndBindResult.user !== undefined) {
      // Broadcast to other tabs of successful bind
      localStorage.setItem(BIND_SUCCESS_LOCALSTORAGE_EVENT_KEY, '1');
      localStorage.removeItem(BIND_SUCCESS_LOCALSTORAGE_EVENT_KEY);
    }
  }

  render() {
    if (this.state.notFound) {
      return (
        <ErrorPage msg='Project does not exist or was deleted by owner' />
      );
    } else if (!this.state.server) {
      return null;
    }
    const server = this.state.server;

    const appRootId = `appRoot-${this.state.server.getProjectId()}-${this.uniqId}`;
    return (
      <Provider store={server.getStore()}>
        <AppThemeProvider
          appRootId={appRootId}
          isInsideContainer={this.props.isInsideContainer}
          supressCssBaseline={this.props.supressCssBaseline}
          containerStyle={{
            flexGrow: 1,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <PushNotificationListener server={server} />
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
            <PrivateProjectLogin server={server}>
              <Route key='header' path='/:page?' render={props => (props.match.params['page'] === 'embed' || props.match.params['page'] === 'sso') ? null : (
                <Header
                  pageSlug={props.match.params['page'] || ''}
                  server={server}
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
                        server={server}
                      />
                    </BasePage>
                  )} />
                )} >
                <Route key='user' path='/:embed(embed)?/user/:userId?' render={props => (
                  <BasePage showFooter={!props.match.params['embed']}>
                    <UserPage server={server} userId={props.match.params.userId} />
                  </BasePage>
                )} />
                <Route key='transaction' path='/:embed(embed)?/transaction' render={props => (
                  <BasePage showFooter={!props.match.params['embed']}>
                    <BankPage server={server} />
                  </BasePage>
                )} />
                <Route key='account' path='/:embed(embed)?/account' render={props => (
                  <BasePage showFooter={!props.match.params['embed']}>
                    <AccountPage server={server} />
                  </BasePage>
                )} />
                <Route key='sso' path='/sso' render={props => (
                  <BasePage showFooter={!props.match.params['embed']}>
                    <SsoSuccessPage />
                  </BasePage>
                )} />
                <Route key='post' path='/:embed(embed)?/post/:postId' render={props => (
                  <BasePage showFooter={!props.match.params['embed']}>
                    <PostPage
                      key={'postpage=' + props.match.params['postId']}
                      postId={props.match.params['postId'] || ''}
                      server={server}
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
