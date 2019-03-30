import React, { Component } from 'react';
import Settings from '../common/config/settings/Settings';
import Editor, * as ConfigEditor from '../common/config/configEditor';
import { ConfigFromJSON } from '../api/admin';
import App from '../app/App';
import {
  MemoryRouter,
  Route,
} from 'react-router-dom'

export default class Site extends Component {
  readonly editor:Editor = new ConfigEditor.EditorImpl();

  componentDidMount() {
    this.editor.subscribe('settings', this.forceUpdate.bind(this));
  }

  componentWillUnmount() {
    this.editor.unsubscribe('settings');
  }

  render() {
    const rootPage = this.editor.getPage([]);

    return (
      <div>
        <h1>
          This is a landing page
        </h1>
        <Settings editor={this.editor} />
        {/* // TODO */}
        <MemoryRouter initialEntries={['/demo']}>

          <Route path="/:projectId/:pageUrlName?" render={props => (
            <App configOverride={this.editor.getConfig()} />
          )} />
        </MemoryRouter>
      </div>
    );
  }
}
