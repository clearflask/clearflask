import React, { Component } from 'react';
import Settings from '../common/config/settings/Settings';
import * as ConfigEditor from '../common/config/configEditor';
import App from '../app/App';
import {
  MemoryRouter,
  Route,
} from 'react-router-dom'
import ConfigView from '../common/config/settings/ConfigView';

interface Props {
  editor:ConfigEditor.Editor;
}

export default class DemoApp extends Component<Props> {
  unsubscribe?:()=>void;

  componentDidMount() {
    this.unsubscribe = this.props.editor.subscribe(this.forceUpdate.bind(this));
  }

  componentWillUnmount() {
    this.unsubscribe && this.unsubscribe();
  }

  render() {
    return (
      <MemoryRouter initialEntries={['/demo']}>
        <Route path="/:projectId/:pageUrlName?" render={props => (
          <App {...props} configOverride={this.props.editor.getConfig()} />
        )} />
      </MemoryRouter>
    );
  }
}
