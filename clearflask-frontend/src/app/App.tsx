import React, { Component } from 'react';
import * as Client from '../api/client';
import { Server, reducers } from '../api/server';
import { match } from 'react-router';
import Header from './Header';
import { History, Location } from 'history';
import Page from './Page';
import { Store, createStore, compose, applyMiddleware } from 'redux';
import { Provider } from 'react-redux';
import { isProd } from '../common/util/detectEnv';
import thunk from 'redux-thunk';
import reduxPromiseMiddleware from 'redux-promise-middleware';
import { MuiThemeProvider, createMuiTheme } from '@material-ui/core';

interface Props {
  configOverride?:Client.Config;
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
  readonly store:Store;
  readonly projectId;

  constructor(props) {
    super(props);
    this.state = {};

    this.projectId = this.props.match.params['projectId'];

    this.store = createStore(
      reducers,
      Server.initialState(this.projectId),(
        // Use Redux dev tools in development
        (isProd()
          ? compose
          : (window as any).__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || compose)
      )(applyMiddleware(thunk, reduxPromiseMiddleware)
    ));

    this.server = new Server(this.store, this.projectId);
    this.server.dispatch().configGet({projectId: this.projectId}).then(conf => {
      this.setState({config: conf});
    });
  }

  render() {
    const config = this.props.configOverride || this.state.config;

    const page:Client.Page|undefined = config
      && config.pages.find(p => p.slug === (this.props.match.params['pageUrlName'] || ''));

    return (
      <Provider store={this.store}>
      <MuiThemeProvider theme={createMuiTheme(/** TODO this.state.conf && this.state.conf.theme */)}>
        <Header
          server={this.server}
          conf={config}
          page={page}
          pageChanged={this.pageChanged.bind(this)}
        />
        <Page
          server={this.server}
          conf={config}
          pageConf={page}
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
