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

    if(this.props.serverOverride) { 
      this.server = this.props.serverOverride;
    } else {
      const projectId = this.props.match.params['projectId'];
      this.server = new Server(projectId);
    }

    if(!this.props.supressConfigGet && this.server.getStore().getState().conf.status === undefined) {
      this.server.dispatch().configGet({projectId: this.server.getProjectId()});
    }
  }

  render() {
    const confState = this.server.getStore().getState().conf;
    var page:Client.Page|undefined;
    var theme;
    if(confState.conf && confState.status === Status.FULFILLED) {
      const conf = confState.conf;
      const pageSlug:string|undefined = this.props.match.params['pageUrlName'];
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
      confState.conf.style
    } else {
      theme = createMuiTheme();
    }

    return (
      <Provider store={this.server.getStore()}>
      <MuiThemeProvider theme={theme}>
        {!this.props.supressCssBaseline && (<CssBaseline />)}
        <div style={{
          background: theme.palette.background.default,
          height: '100%',
          width: '100%',
        }}>
          <Header
            server={this.server}
            conf={confState.conf}
            page={page}
            pageChanged={this.pageChanged.bind(this)}
          />
          <Page
            server={this.server}
            conf={confState.conf}
            pageConf={page}
            pageChanged={this.pageChanged.bind(this)}
          />
        </div>
      </MuiThemeProvider>
      </Provider>
    );
  }

  pageChanged(pageUrlName:string) {
    pageUrlName = pageUrlName === '' ? pageUrlName : '/' + pageUrlName
    this.props.history.push(`/${this.props.match.params['projectName']}${pageUrlName}`);
  }
}
