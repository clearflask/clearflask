import { History, Location } from 'history';
import React, { Component } from 'react';
import { Provider } from 'react-redux';
import { match } from 'react-router';
import { Redirect, Route } from 'react-router-dom';
import { Server } from '../api/server';
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
import CustomPage from './CustomPage';
import Header from './Header';
import NotificationPage from './NotificationPage';
import AnimatedPageSwitch from './utils/AnimatedRoutes';
import CaptchaChallenger from './utils/CaptchaChallenger';
import PushNotificationListener from './utils/PushNotificationListener';
import ServerErrorNotifier from './utils/ServerErrorNotifier';

/** Broadcast successful bind to other tabs */
export const BIND_SUCCESS_LOCALSTORAGE_EVENT_KEY = 'bind-success';

interface Props {
  projectId: string;
  serverOverride?: Server;
  supressCssBaseline?: boolean;
  isInsideContainer?: boolean;
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
      this.server = new Server(projectId, ServerMock.get());
    } else {
      this.server = new Server(projectId);
    }

    this.configGetAndUserBind();
  }

  async configGetAndUserBind() {
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
            authToken: new URL(window.location.href).searchParams.get('authToken') || undefined,
            browserPushToken: (subscriptionResult !== undefined && subscriptionResult.type === 'success')
              ? subscriptionResult.token : undefined,
          },
        });
      } catch (err) {
        if (err.status === 404) {
          // If project is not found, redirect to homepage
          window.location.replace(window.location.origin.replace(`${this.server.getProjectId()}\.`, ''));
        }
        throw err;
      }

      if (configAndBindResult.user !== undefined) {
        localStorage.setItem(BIND_SUCCESS_LOCALSTORAGE_EVENT_KEY, '1');
        localStorage.removeItem(BIND_SUCCESS_LOCALSTORAGE_EVENT_KEY);
      }
    }
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
          {/* SSO not yet suppported <SsoLogin server={this.server} /> */}
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
            <Route path='/:page?' render={props => props.match.params['page'] === 'embed' ? null : (
              <Header
                pageSlug={props.match.params['page'] || ''}
                server={this.server}
                pageChanged={this.pageChanged.bind(this)}
              />
            )} />
            <AnimatedPageSwitch
              render={(pageSlug: string) => (
                <Route key={pageSlug} path={`/:embed(embed)?/${pageSlug}`} render={props => (
                  <BasePage showFooter={!props.match.params['embed']}>
                    <CustomPage
                      pageSlug={pageSlug}
                      server={this.server}
                    />
                  </BasePage>
                )} />
              )} >
              <Route key='transaction' path='/transaction' render={props => (
                <BasePage showFooter>
                  <BankPage server={this.server} />
                </BasePage>
              )} />
              <Route key='notification' path='/notification' render={props => (
                <BasePage showFooter>
                  <NotificationPage server={this.server} />
                </BasePage>
              )} />
              <Route key='account' path='/account' render={props => (
                <BasePage showFooter>
                  <AccountPage server={this.server} />
                </BasePage>
              )} />
              {!isExpanded() && (
                <Route key='post' path='/post/:postId' render={props => (
                  <BasePage showFooter>
                    <PostPage
                      postId={props.match.params['postId'] || ''}
                      server={this.server}
                    />
                  </BasePage>
                )} />
              )}
              {!isExpanded() && (
                <Route key='postWildcard' path='/*/post/:postId' render={props => (
                  <Redirect exact to={{ pathname: `/post/${props.match.params.postId}` }} />
                )} />
              )}
            </AnimatedPageSwitch>
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
