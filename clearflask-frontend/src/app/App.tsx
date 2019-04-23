import React, { Component } from 'react';
import { Server } from '../api/server';
import { match } from 'react-router';
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
import { SnackbarProvider, withSnackbar, WithSnackbarProps, useSnackbar } from 'notistack';

interface Props {
  serverOverride?:Server;
  supressConfigGet?:boolean;
  supressCssBaseline?:boolean;
  // Router matching
  match:match;
  history:History;
  location:Location;
}

class App extends Component<Props> {
  readonly server:Server;

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

    // this.server.subscribeToErrors(errorMsg => this.props.enqueueSnackbar(
    //   errorMsg, { variant: 'error', preventDuplicate: true }))
  }

  render() {

    return (
      <Provider store={this.server.getStore()}>
      <AppThemeProvider supressCssBaseline={this.props.supressCssBaseline}>
      <SnackbarProvider maxSnack={3}>
        <ServerErrorNotifier server={this.server} />
        <div style={{
          height: '100%',
          width: '100%',
        }}>
          <Route path={`${this.props.match.url}/:page?`} render={props => (
            <Header
              pageSlug={props.match.params['page'] || ''}
              server={this.server}
              pageChanged={this.pageChanged.bind(this)}
            />
          )} />
          <Switch>
            <Route path={`${this.props.match.url}/post/:postId?`} exact render={props => (
              <BasePage>
                <PostPage
                  postId={props.match.params['postId'] || ''}
                  server={this.server}
                />
              </BasePage>
            )} />
            <Route path={`${this.props.match.url}/:page?`} render={props => (
              <BasePage>
                <CustomPage
                  pageSlug={props.match.params['page'] || ''}
                  server={this.server}
                  pageChanged={this.pageChanged.bind(this)}
                />
              </BasePage>
            )} />
          </Switch>
        </div>
      </SnackbarProvider>
      </AppThemeProvider>
      </Provider>
    );
  }

  pageChanged(pageUrlName:string):void {
    pageUrlName = pageUrlName === '' ? pageUrlName : '/' + pageUrlName
    this.props.history.push(`/${this.props.match.params['projectId']}${pageUrlName}`);
  }
}

const ServerErrorNotifier = (props:({server:Server})) => {
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();
  props.server.subscribeToErrors(errorMsg =>
    enqueueSnackbar(errorMsg, { variant: 'error', preventDuplicate: true }))
  return null;
};

export default App;
