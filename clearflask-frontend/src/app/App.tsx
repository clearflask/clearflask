import { History, Location } from 'history';
import React, { Component } from 'react';
import { Provider } from 'react-redux';
import { match } from 'react-router';
import { Redirect, Route } from 'react-router-dom';
import { Server, StateSettings } from '../api/server';
import ServerMock from '../api/serverMock';
import WebNotification, { Status } from '../common/notification/webNotification';
import { detectEnv, Environment } from '../common/util/detectEnv';
import randomUuid from '../common/util/uuid';
import AccountPage from './AccountPage';
import AppThemeProvider from './AppThemeProvider';
import BankPage from './BankPage';
import BasePage from './BasePage';
import { isExpanded } from './comps/Post';
import PostPage from './comps/PostPage';
import UserPage from './comps/UserPage';
import CustomPage from './CustomPage';
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
  projectId: string;
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
  readonly server: Server;
  readonly uniqId = randomUuid();

  constructor(props) {
    super(props);

    this.state = {};

    const projectId = this.props.projectId;
    if (this.props.serverOverride) {
      this.server = this.props.serverOverride;
    } else if (detectEnv() === Environment.DEVELOPMENT_FRONTEND) {
      this.server = new Server(projectId, this.props.settings, ServerMock.get());
    } else {
      this.server = new Server(projectId, this.props.settings);
    }

    this.configGetAndUserBind();
  }

  async configGetAndUserBind() {
    // Used for links within emails
    const authToken = new URL(window.location.href).searchParams.get(AUTH_TOKEN_PARAM_NAME);
    // Used for SSO
    const token = new URL(window.location.href).searchParams.get(SSO_TOKEN_PARAM_NAME);
    if (token || authToken) {
      // Clear token from URL for safety
      this.props.history.replace(this.props.location.pathname);
    }

    if (this.server.getStore().getState().conf.status === undefined) {
      var subscriptionResult;
      if (WebNotification.getInstance().getStatus() === Status.Granted) {
        subscriptionResult = await WebNotification.getInstance().getPermission();
      }

      var configAndBindResult;
      try {
        configAndBindResult = await this.server.dispatch().configGetAndUserBind({
          projectId: this.server.getProjectId(),
          configGetAndUserBind: {
            ssoToken: token || undefined,
            authToken: authToken || undefined,
            browserPushToken: (subscriptionResult !== undefined && subscriptionResult.type === 'success')
              ? subscriptionResult.token : undefined,
          },
        });
      } catch (err) {
        if (err.status === 404) {
          // If project is not found, redirect to homepage
          window.location.replace(window.location.origin.replace(`${this.server.getProjectId()}.`, ''));
        }
        throw err;
      }

      if (configAndBindResult.user !== undefined) {
        // Broadcast to other tabs of successful bind
        localStorage.setItem(BIND_SUCCESS_LOCALSTORAGE_EVENT_KEY, '1');
        localStorage.removeItem(BIND_SUCCESS_LOCALSTORAGE_EVENT_KEY);
      }
    }
  }

  isExpandedLast = isExpanded();
  shouldComponentUpdate(nextProps) {
    const shouldUpdate = isExpanded() !== this.isExpandedLast;
    this.isExpandedLast = isExpanded();
    return shouldUpdate;
  }

  render() {
    const appRootId = `appRoot-${this.server.getProjectId()}-${this.uniqId}`;
    return (
      <Provider store={this.server.getStore()}>
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
          <PushNotificationListener server={this.server} />
          <ServerErrorNotifier server={this.server} />
          <CaptchaChallenger server={this.server} />
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
              <Route key='header' path='/:page?' render={props => (props.match.params['page'] === 'embed' || props.match.params['page'] === 'sso') ? null : (
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
                  <BasePage showFooter={!props.match.params['embed']}>
                    <UserPage server={this.server} userId={props.match.params.userId} />
                  </BasePage>
                )} />
                <Route key='transaction' path='/:embed(embed)?/transaction' render={props => (
                  <BasePage showFooter={!props.match.params['embed']}>
                    <BankPage server={this.server} />
                  </BasePage>
                )} />
                <Route key='account' path='/:embed(embed)?/account' render={props => (
                  <BasePage showFooter={!props.match.params['embed']}>
                    <AccountPage server={this.server} />
                  </BasePage>
                )} />
                <Route key='sso' path='/sso' render={props => (
                  <BasePage showFooter={!props.match.params['embed']}>
                    <SsoSuccessPage />
                  </BasePage>
                )} />
                {!isExpanded() && (
                  <Route key='post' path='/:embed(embed)?/post/:postId' render={props => (
                    <BasePage showFooter={!props.match.params['embed']}>
                      <PostPage
                        postId={props.match.params['postId'] || ''}
                        server={this.server}
                      />
                    </BasePage>
                  )} />
                )}
                {!isExpanded() && (
                  <Route key='postWildcard' path='/:prefix?/post/:postId' render={props => (props.match.params['prefix'] === 'embed' || props.match.params['prefix'] === 'embed-status') ? null : (
                    <Redirect exact to={{ pathname: `/post/${props.match.params.postId}` }} />
                  )} />
                )}
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
