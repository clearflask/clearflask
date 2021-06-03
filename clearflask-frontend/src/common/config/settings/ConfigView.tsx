import React, { Component } from 'react';
import ReactDiffViewer from 'react-diff-viewer';
import { Server } from '../../../api/server';
import ServerAdmin from '../../../api/serverAdmin';
import * as ConfigEditor from '../configEditor';

interface Props {
  server: Server;
  editor: ConfigEditor.Editor;
}

export default class ConfigView extends Component<Props> {
  unsubscribe?: () => void;

  componentDidMount() {
    this.unsubscribe = this.props.editor && this.props.editor.subscribe(this.forceUpdate.bind(this));
  }

  componentWillUnmount() {
    this.unsubscribe && this.unsubscribe();
  }

  render() {
    if (this.unsubscribe === undefined && this.props.editor !== undefined) {
      this.unsubscribe = this.props.editor.subscribe(this.forceUpdate.bind(this));
    }
    return (
      <ReactDiffViewer
        oldValue={JSON.stringify(ServerAdmin.get().getStore().getState().configs.configs.byProjectId?.[this.props.server.getProjectId()]?.config.config, null, 2)}
        newValue={JSON.stringify(this.props.editor?.getConfig(), null, 2)}
        splitView={false}
        hideLineNumbers
        styles={{
          diffContainer: {
            'font-size': '0.8em',
          },
          contentText: {
            'line-height': '22px',
          },
        }}
      />
    )
  }
}
