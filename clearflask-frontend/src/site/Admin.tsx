import React, { Component } from 'react';
import Settings from '../common/config/settings/Settings';
import Editor, * as ConfigEditor from '../common/config/configEditor';
import App from '../app/App';
import {
  MemoryRouter,
  Route,
} from 'react-router-dom'
import { match } from 'react-router';
import { History, Location } from 'history';

interface Props {
  // Router matching
  match:match;
  history:History;
  location:Location;
}

export default class Admin extends Component<Props> {
  readonly editor:Editor = new ConfigEditor.EditorImpl();

  componentDidMount() {
    this.editor.subscribe('settings', this.forceUpdate.bind(this));
  }

  componentWillUnmount() {
    this.editor.unsubscribe('settings');
  }

  render() {
    return (
      <div>
        <div style={{display: 'flex'}}>
          <div style={{flexGrow: 1}}>
            <Route path="/admin/:path*" render={props => (
              <Settings {...props} editor={this.editor} />
            )} />
          </div>
          {/* // TODO */}
          <pre>
            {JSON.stringify(this.editor.getConfig(), undefined, 2)}
          </pre>
          </div>
        <MemoryRouter initialEntries={['/demo']}>
        <Route path="/:projectId/:pageUrlName?" render={props => (
          <App {...props} configOverride={this.editor.getConfig()} />
        )} />
      </MemoryRouter>
    </div>
    );
  }
}
