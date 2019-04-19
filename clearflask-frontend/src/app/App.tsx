import React, { Component } from 'react';
import * as Client from '../api/client';
import { Server, ReduxState, Status, StateConf } from '../api/server';
import { match } from 'react-router';
import Header from './Header';
import { History, Location } from 'history';
import Page from './Page';
import { Provider } from 'react-redux';
import { connect } from 'react-redux';
import { CssBaseline, MuiThemeProvider, createMuiTheme } from '@material-ui/core';
import { detectEnv, Environment } from '../common/util/detectEnv';
import ServerMock from '../api/serverMock';
import DataMock from '../api/dataMock';
import Templater from '../common/config/configTemplater';
import * as ConfigEditor from '../common/config/configEditor';

interface Props extends StateConf {
  serverOverride?:Server;
  supressConfigGet?:boolean;
  supressCssBaseline?:boolean;
  // Router matching
  match:match;
  history:History;
  location:Location;
}

export default class App extends Component<Props> {
  readonly server:Server;

  constructor(props) {
    super(props);

    var supressConfigGet = this.props.supressConfigGet;
    const projectId = this.props.match.params['projectId'];
    if(this.props.serverOverride) { 
      this.server = this.props.serverOverride;
    } else if(detectEnv() === Environment.DEVELOPMENT_FRONTEND) {
      supressConfigGet = true;
      this.server = new Server(projectId, ServerMock.get());
      this.server.dispatchAdmin()
        .then(d => d.projectCreateAdmin({projectId: projectId})
        .then(project => {
          const editor = new ConfigEditor.EditorImpl(project.config.config);
          Templater.get(editor).demo();
          DataMock.get(project.projectId).mockItems()
            .then(() => this.server.dispatch().configGet({projectId: this.server.getProjectId()})
            .then(c => this.forceUpdate()));
        }));
    } else {
      this.server = new Server(projectId);
    }

    if(!supressConfigGet && this.server.getStore().getState().conf.status === undefined) {
      this.server.dispatch().configGet({projectId: this.server.getProjectId()})
        .then(c => this.forceUpdate());
    }
  }

  render() {
    return (
      <Provider store={this.server.getStore()}>
        <AppContent {...this.props} server={this.server} pageChanged={this.pageChanged.bind(this)} />
      </Provider>
    );
  }

  pageChanged(pageUrlName:string):void {
    pageUrlName = pageUrlName === '' ? pageUrlName : '/' + pageUrlName
    this.props.history.push(`/${this.props.match.params['projectId']}${pageUrlName}`);
  }
}

interface PropsContent extends Props,StateConf {
  server: Server;
  pageChanged: (pageUrlName:string)=>void;
}

const AppContent = connect<any,any,any,any>((state:ReduxState, ownProps:PropsContent) => state.conf)((props:PropsContent) => {
  var page:Client.Page|undefined;
  var theme;
  if(props.conf && props.status === Status.FULFILLED) {
    const conf = props.conf;
    const pageSlug:string|undefined = props.match.params['pageUrlName'];
    if(pageSlug === undefined) {
      page = conf.layout.pages[0];
    } else {
      page = conf.layout.pages.find(p => p.slug === pageSlug);
    }
    theme = createMuiTheme({
      palette: {
        type: conf.style.palette.darkMode ? 'dark' : 'light',
        ...(conf.style.palette.primary ? { primary: {
          main: conf.style.palette.primary,
        }} : {}),
        ...(conf.style.palette.secondary ? { secondary: {
          main: conf.style.palette.secondary,
        }} : {}),
        ...((conf.style.palette.background || conf.style.palette.backgroundPaper) ? { background: {
          default: conf.style.palette.background ? conf.style.palette.background : undefined,
          paper: conf.style.palette.backgroundPaper ? conf.style.palette.backgroundPaper : undefined,
        }} : {}),
      },
      typography: {
        fontFamily: conf.style.typography.fontFamily || undefined,
        fontSize: conf.style.typography.fontSize || undefined,
      }
    })
  } else {
    theme = createMuiTheme();
  }

  return (
    <MuiThemeProvider theme={theme}>
      {!props.supressCssBaseline && (<CssBaseline />)}
      <div style={{
        background: theme.palette.background.default,
        height: '100%',
        width: '100%',
      }}>
        <Header
          server={props.server}
          conf={props.conf}
          page={page}
          pageChanged={props.pageChanged}
        />
        <Page
          server={props.server}
          conf={props.conf}
          pageConf={page}
          pageChanged={props.pageChanged}
        />
      </div>
    </MuiThemeProvider>
  );
});
