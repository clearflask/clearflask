import React, { Component } from 'react';
import Settings from '../common/config/settings/Settings';
import * as ConfigEditor from '../common/config/configEditor';
import App from '../app/App';
import {
  MemoryRouter,
  Route,
} from 'react-router-dom'
import { match } from 'react-router';
import { History, Location } from 'history';
import ConfigView from '../common/config/settings/ConfigView';
import DemoApp from './DemoApp';

interface Props {
  // Router matching
  match:match;
  history:History;
  location:Location;
}

export default class Admin extends Component<Props> {
  readonly editor:ConfigEditor.Editor = new ConfigEditor.EditorImpl();

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
          <ConfigView editor={this.editor} />
        </div>
        <DemoApp editor={this.editor} />
      </div>
    );
  }
}
