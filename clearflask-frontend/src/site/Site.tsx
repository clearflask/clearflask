import React, { Component } from 'react';
import Settings from '../common/config/settings/Settings';
import Editor, * as ConfigEditor from '../common/config/configEditor';
import { ConfigFromJSON } from '../api/admin';

export default class Site extends Component {

  render() {
    const editor:Editor = new ConfigEditor.EditorImpl(ConfigFromJSON({
      name: 'MyApp',
      pages: [],
    }));

    const rootPage = editor.getPage([]);

    return (
      <div>
        <h1>
          This is a landing page
        </h1>
        <Settings editor={editor} />
      </div>
    );
  }
}
