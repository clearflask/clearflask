import React, { Component } from 'react';
import { Api, Conf, ConfViewPage, ApiInterface } from '../api/client';
import { Server, reducers } from '../api/server';
import { match } from 'react-router';
import Header from './Header';
import { History } from 'react-router-dom';
import Page from './Page';
import { Store, createStore, compose, applyMiddleware } from 'redux';
import { Provider } from 'react-redux';
import { isProd } from '../util/detectEnv';
import thunk from 'redux-thunk';
import reduxPromiseMiddleware from 'redux-promise-middleware';

interface Props {
  // Router matching
  match:match;
  history:History;
}

interface State {
  conf?:Conf;
}

class App extends Component<Props, State> {
  readonly api:ApiInterface;
  readonly store:Store;

  constructor(props) {
    super(props);
    this.state = {};

    this.store = createStore(
      reducers,
      Server.initialState(),(
        // Use Redux dev tools in development
        (isProd()
          ? compose
          : (window as any).__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || compose)
      )(applyMiddleware(thunk, reduxPromiseMiddleware)
    ));

    this.api = new Server(this.store, this.props.match.params.projectName);
    this.api.getConfig().then(conf => {
      this.setState({conf: conf});
    });
  }

  render() {
    const page:ConfViewPage|undefined = this.state.conf
      && this.state.conf.pages.find(p => p.urlName === (this.props.match.params.pageUrlName || ''));

    return (
      <div>
        <Provider store={this.store}>
          <Header
            api={this.api}
            conf={this.state.conf}
            pageConf={page}
            pageChanged={this.pageChanged.bind(this)}
          />
          <Page
            api={this.api}
            conf={this.state.conf}
            pageConf={page}
          />
        </Provider>
      </div>
    );
  }

  pageChanged(pageUrlName:string) {
    pageUrlName = pageUrlName === '' ? pageUrlName : '/' + pageUrlName
    this.props.history.push(`/${this.props.match.params.projectName}${pageUrlName}`);
  }
}

export default App;
