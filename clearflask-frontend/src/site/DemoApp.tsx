import React, { Component } from 'react';
import Admin from './Admin';
import * as ConfigEditor from '../common/config/configEditor';
import App from '../app/App';
import {
  MemoryRouter,
  Route,
} from 'react-router-dom'
import { Server } from '../api/server';

interface Props {
  server:Server;
  intialSubPath?:string;
}

export default class DemoApp extends Component<Props> {
  render() {
    return (
      <MemoryRouter initialEntries={[`/${this.props.server.getProjectId()}${this.props.intialSubPath || ''}`]}>
        <Route path="/:projectId" render={props => (
          <App
            {...props}
            supressCssBaseline
            isInsideContainer
            serverOverride={this.props.server} />
        )} />
      </MemoryRouter>
    );
  }
}
