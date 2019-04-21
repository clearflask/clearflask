import React, { Component } from 'react';
import * as Client from '../api/client';
import { Server, ReduxState, Status, StateConf } from '../api/server';
import { match } from 'react-router';
import Header from './Header';
import { History, Location } from 'history';
import Page from './Page';
import { Provider } from 'react-redux';
import { detectEnv, Environment } from '../common/util/detectEnv';
import ServerMock from '../api/serverMock';
import DataMock from '../api/dataMock';
import Templater from '../common/config/configTemplater';
import * as ConfigEditor from '../common/config/configEditor';
import AppThemeProvider from './AppThemeProvider';

interface Props {
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
    const pageSlug:string = this.props.match.params['pageUrlName'] || '';

    return (
      <Provider store={this.server.getStore()}>
        <AppThemeProvider supressCssBaseline={this.props.supressCssBaseline}>
          <div style={{
            height: '100%',
            width: '100%',
          }}>
            <Header
              server={this.server}
              pageSlug={pageSlug}
              pageChanged={this.pageChanged.bind(this)}
            />
            <Page
              server={this.server}
              pageSlug={pageSlug}
              pageChanged={this.pageChanged.bind(this)}
            />
          </div>
        </AppThemeProvider>
      </Provider>
    );
  }

  pageChanged(pageUrlName:string):void {
    pageUrlName = pageUrlName === '' ? pageUrlName : '/' + pageUrlName
    this.props.history.push(`/${this.props.match.params['projectId']}${pageUrlName}`);
  }
}
