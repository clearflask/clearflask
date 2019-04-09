import React, { Component } from 'react';
import * as Client from '../api/client';
import { Server, ReduxState, Status, StateConf } from '../api/server';
import { match } from 'react-router';
import Header from './Header';
import { History, Location } from 'history';
import Page from './Page';
import { Provider } from 'react-redux';
import { connect } from 'react-redux';

interface Props extends StateConf {
  serverOverride?:Server;
  supressConfigGet?:boolean;
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
    if(confState.conf && confState.status === Status.FULFILLED) {
      const pageSlug:string|undefined = this.props.match.params['pageUrlName'];
      if(pageSlug === undefined) {
        page = confState.conf.layout.pages[0];
      } else {
        page = confState.conf.layout.pages.find(p => p.slug === pageSlug);
      }
    }

    return (
      <Provider store={this.server.getStore()}>
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
      </Provider>
    );
  }

  pageChanged(pageUrlName:string) {
    pageUrlName = pageUrlName === '' ? pageUrlName : '/' + pageUrlName
    this.props.history.push(`/${this.props.match.params['projectName']}${pageUrlName}`);
  }
}
