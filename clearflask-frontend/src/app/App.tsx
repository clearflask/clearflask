import React, { Component, PropsWithChildren } from 'react';
import { Server, ReduxState, Status } from '../api/server';
import { match, RouteComponentProps } from 'react-router';
import Header from './Header';
import { History, Location } from 'history';
import BasePage from './BasePage';
import { Provider } from 'react-redux';
import { detectEnv, Environment } from '../common/util/detectEnv';
import ServerMock from '../api/serverMock';
import DataMock from '../api/dataMock';
import Templater from '../common/config/configTemplater';
import * as ConfigEditor from '../common/config/configEditor';
import AppThemeProvider from './AppThemeProvider';
import {
  BrowserRouter as Router,
  Route,
  Switch,
  Redirect,
} from 'react-router-dom'
import PostPage from './comps/PostPage';
import CustomPage from './CustomPage';
import { SnackbarProvider, useSnackbar } from 'notistack';
import { connect } from 'react-redux';
import MuiAnimatedSwitch from '../common/MuiAnimatedSwitch';
import Post, { isExpanded } from './comps/Post';
import randomUuid from '../common/util/uuid';
import { withStyles, Theme, createStyles, WithStyles } from '@material-ui/core/styles';

interface Props {
  serverOverride?:Server;
  supressConfigGet?:boolean;
  supressCssBaseline?:boolean;
  isInsideContainer?:boolean;
  // Router matching
  match:match;
  history:History;
  location:Location;
}

class App extends Component<Props> {
  readonly server:Server;
  readonly uniqId = randomUuid();

  constructor(props) {
    super(props);

    this.state = {};

    var supressConfigGet = this.props.supressConfigGet;
    const projectId = this.props.match.params['projectId'];
    if(this.props.serverOverride) { 
      this.server = this.props.serverOverride;
    } else if(detectEnv() === Environment.DEVELOPMENT_FRONTEND) {
      supressConfigGet = true;
      this.server = new Server(projectId, ServerMock.get());
      this.server.dispatchAdmin()
        .then(d => d.projectCreateAdmin({projectId: projectId})
          .then(project =>{
            const editor = new ConfigEditor.EditorImpl(project.config.config);
            Templater.get(editor).demo();
            return d.configSetAdmin({
              projectId: projectId,
              versionLast: project.config.version,
              config: editor.getConfig(),
            });
          })
          .then(() => DataMock.get(projectId).mockItems())
          .then(() => this.server.dispatch().configGet({projectId: projectId}))
        );
    } else {
      this.server = new Server(projectId);
    }

    if(!supressConfigGet && this.server.getStore().getState().conf.status === undefined) {
      this.server.dispatch().configGet({projectId: this.server.getProjectId()});
    }
  }

  render() {
    const prefixMatch = this.props.match.url;
    const appRootId = `appRoot-${this.server.getProjectId()}-${this.uniqId}`;
    return (
      <Provider store={this.server.getStore()}>
      <AppThemeProvider appRootId={appRootId} isInsideContainer={this.props.isInsideContainer} supressCssBaseline={this.props.supressCssBaseline}>
      <MuiSnackbarProvider>
        <ServerErrorNotifier server={this.server} />
        <SsoLogin server={this.server} />
        <div
          id={appRootId}
          style={{
            height: '100%',
            width: '100%',
            ...(this.props.isInsideContainer ? {
              position: 'relative',
            } : {}),
          }}
        >
          <Route path={`${prefixMatch}/:page?`} render={props => (
            <Header
              pageSlug={props.match.params['page'] || ''}
              server={this.server}
              pageChanged={this.pageChanged.bind(this)}
            />
          )} />
          <AnimatedRoutesApp
            render={(pageSlug:string) => (
              <Route path={`${prefixMatch}/${pageSlug}`} render={props => (
                <BasePage>
                  <CustomPage
                    pageSlug={pageSlug}
                    server={this.server}
                    pageChanged={this.pageChanged.bind(this)}
                  />
                </BasePage>
              )} />
            )} >
            {!isExpanded() && (
              <Route path={`${prefixMatch}/post/:postId`} render={props => (
                <BasePage>
                  <PostPage
                    postId={props.match.params['postId'] || ''}
                    server={this.server}
                  />
                </BasePage>
              )} />
            )}
            {!isExpanded() && (
              <Route path={`${prefixMatch}/*/post/:postId`} render={props => (
                <Redirect exact to={{pathname: `${prefixMatch}/post/${props.match.params.postId}`}} />
              )} />
            )}
          </AnimatedRoutesApp>
        </div>
      </MuiSnackbarProvider>
      </AppThemeProvider>
      </Provider>
    );
  }

  pageChanged(pageUrlName:string):void {
    pageUrlName = pageUrlName === '' ? pageUrlName : '/' + pageUrlName
    this.props.history.push(`/${this.props.match.params['projectId']}${pageUrlName}`);
  }
}

const muiSnackbarStyles = createStyles({
  snackbarRoot: {
    position: 'absolute',
  },
});
const MuiSnackbarProvider = withStyles((theme:Theme) => muiSnackbarStyles, { withTheme: true })((props:any) => (
  <SnackbarProvider maxSnack={3} classes={{
    root: props.classes.snackbarRoot,
  }}>
    {props.children}
  </SnackbarProvider>
));

const ServerErrorNotifier = (props:({server:Server})) => {
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();
  props.server.subscribeToErrors(errorMsg =>
    enqueueSnackbar(errorMsg, { variant: 'error', preventDuplicate: true }))
  return null;
};

const SsoLogin = connect<any,any,any,any>((state:ReduxState, ownProps:Props) => {return {
  ssoEnabled: state.conf.conf && !!state.conf.conf.users.onboarding.notificationMethods.singleSignOn,
}})((props:{server:Server, ssoEnabled:boolean}) => {
  if(!props.ssoEnabled) return null;

  const url = new URL(window.location.href);
  const sso = url.searchParams.get('sso');

  if(!sso) return null;

  props.server.dispatch().userSsoCreateOrLogin({
    projectId: props.server.getProjectId(),
    token: sso,
  });

  return null;
});

const AnimatedRoutesApp = connect<any,any,any,any>((state:ReduxState, ownProps:Props) => {return {
  customPageSlugs: state.conf.conf && state.conf.conf.layout.pages.map(p => p.slug),
}})((props:any) => (
  <MuiAnimatedSwitch>
    {props.children}
    {props.customPageSlugs
    ? props.customPageSlugs.map(customPageSlug => props.render(customPageSlug))
    : null}
  </MuiAnimatedSwitch>
));

export default App;
