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
  projectId?:string;
  editor:ConfigEditor.Editor;
}

export default class DemoApp extends Component<Props> {
  readonly server:Server;
  unsubscribe?:()=>void;

  constructor(props) {
    super(props);
    this.state = {};

    this.server = new Server(props.projectId || 'demo', props.editor);
  }

  componentDidMount() {
    this.unsubscribe = this.props.editor.subscribe(this.forceUpdate.bind(this));
  }

  componentWillUnmount() {
    this.unsubscribe && this.unsubscribe();
  }

  render() {
    return (
      <MemoryRouter initialEntries={[`/${this.server.getProjectId()}`]}>
        <Route path="/:projectId/:pageUrlName?" render={props => (
          <App {...props} serverOverride={this.server} />
        )} />
      </MemoryRouter>
    );
  }
}
