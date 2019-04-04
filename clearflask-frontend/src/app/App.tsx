import React, { Component } from 'react';
import * as Client from '../api/client';
import { Server, reducers } from '../api/server';
import { match } from 'react-router';
import Header from './Header';
import { History, Location } from 'history';
import Page from './Page';
import { Provider } from 'react-redux';
import { MuiThemeProvider, createMuiTheme } from '@material-ui/core';

interface Props {
  serverOverride?:Server;
  // Router matching
  match:match;
  history:History;
  location:Location;
}

interface State {
  config?:Client.Config;
}

class App extends Component<Props, State> {
  readonly server:Server;

  constructor(props) {
    super(props);
    this.state = {};

    if(this.props.serverOverride) { 
      this.server = this.props.serverOverride;
    } else {
      const projectId = this.props.match.params['projectId'];
      this.server = new Server(projectId);
    }

    this.server.dispatch().configGet({projectId: this.server.getProjectId()}).then(conf => {
      this.setState({config: conf});
    });
  }

  render() {
    const page:Client.Page|undefined = this.state.config
      && this.state.config.pages.find(p => p.slug === (this.props.match.params['pageUrlName'] || ''));

    return (
      <Provider store={this.server.getStore()}>
      <MuiThemeProvider theme={createMuiTheme(/** TODO this.state.conf && this.state.conf.theme */)}>
        <Header
          server={this.server}
          conf={this.state.config}
          page={page}
          pageChanged={this.pageChanged.bind(this)}
        />
        <Page
          server={this.server}
          conf={this.state.config}
          pageConf={page}
          pageChanged={this.pageChanged.bind(this)}
        />
      </MuiThemeProvider>
      </Provider>
    );
  }

  pageChanged(pageUrlName:string) {
    pageUrlName = pageUrlName === '' ? pageUrlName : '/' + pageUrlName
    this.props.history.push(`/${this.props.match.params['projectName']}${pageUrlName}`);
  }
}

export default App;
