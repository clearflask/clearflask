// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
import React, { Component } from 'react';
import ReactDiffViewer from 'react-diff-viewer';
import { Server } from '../../../api/server';
import ServerAdmin from '../../../api/serverAdmin';
import debounce from '../../util/debounce';
import * as ConfigEditor from '../configEditor';

interface Props {
  server: Server;
  editor: ConfigEditor.Editor;
}

export default class ConfigView extends Component<Props> {
  unsubscribe?: () => void;
  forceUpdateDebounced: () => void;

  constructor(props) {
    super(props);

    this.forceUpdateDebounced = debounce(() => this.forceUpdate(), 100);
  }

  componentWillUnmount() {
    this.unsubscribe && this.unsubscribe();
  }

  render() {
    if (!this.unsubscribe) {
      this.unsubscribe = this.props.editor && this.props.editor.subscribe(() => this.forceUpdateDebounced());
    }

    const oldValue = JSON.stringify(ServerAdmin.get().getStore().getState().configs.configs.byProjectId?.[this.props.server.getProjectId()]?.config.config, null, 2);
    const newValue = JSON.stringify(this.props.editor?.getConfig(), null, 2);
    console.log('debug', oldValue === newValue, oldValue, newValue);
    return (
      <ReactDiffViewer
        oldValue={oldValue}
        newValue={newValue}
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
