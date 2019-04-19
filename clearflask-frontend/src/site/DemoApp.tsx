import React, { Component } from 'react';
import Admin from './Admin';
import * as ConfigEditor from '../common/config/configEditor';
import App from '../app/App';
import {
  MemoryRouter,
  Route,
} from 'react-router-dom'
import ConfigView from '../common/config/settings/ConfigView';
import { Server } from '../api/server';

interface Props {
  server:Server;
  editor:ConfigEditor.Editor|undefined;
}

export default class DemoApp extends Component<Props> {
  unsubscribe?:()=>void;

  componentDidMount() {
    this.unsubscribe = this.props.editor && this.props.editor.subscribe(this.forceUpdate.bind(this));
  }

  componentWillUnmount() {
    this.unsubscribe && this.unsubscribe();
  }

  render() {
    if(this.unsubscribe === undefined && this.props.editor !== undefined) {
      this.unsubscribe = this.props.editor.subscribe(this.forceUpdate.bind(this));
    }
    return (
      <MemoryRouter initialEntries={[`/${this.props.server.getProjectId()}`]}>
        <Route path="/:projectId/:pageUrlName?" render={props => (
          <App
            {...props}
            supressCssBaseline
            serverOverride={this.props.server} />
        )} />
      </MemoryRouter>
    );
  }
}
