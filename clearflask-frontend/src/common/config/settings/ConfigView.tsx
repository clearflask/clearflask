// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
import React, { Component } from 'react';
import ReactDiffViewer from 'react-diff-viewer';
import { Light as SyntaxHighlighter } from 'react-syntax-highlighter';
import highlightLanguageYaml from 'react-syntax-highlighter/dist/esm/languages/hljs/yaml';
import highlightStyleLight from 'react-syntax-highlighter/dist/esm/styles/hljs/stackoverflow-light';
import { Server } from '../../../api/server';
import ServerAdmin from '../../../api/serverAdmin';
import debounce from '../../util/debounce';
import * as ConfigEditor from '../configEditor';

SyntaxHighlighter.registerLanguage('yaml', highlightLanguageYaml);

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

  componentDidMount() {
    this.unsubscribe = this.props.editor && this.props.editor.subscribe(() => this.forceUpdateDebounced());
  }

  componentWillUnmount() {
    this.unsubscribe && this.unsubscribe();
  }

  render() {
    return (
      <ReactDiffViewer
        oldValue={JSON.stringify(ServerAdmin.get().getStore().getState().configs.configs.byProjectId?.[this.props.server.getProjectId()]?.config.config, null, 2)}
        newValue={JSON.stringify(this.props.editor?.getConfig(), null, 2)}
        splitView={false}
        hideLineNumbers
        renderContent={str => (
          <SyntaxHighlighter
            // Yaml is better for highlighting line-by-line than actual JSON parser
            language='yaml'
            customStyle={{
              backgroundColor: 'inherit',
              padding: 0,
            }}
            style={highlightStyleLight}
          >
            {str}
          </SyntaxHighlighter>
        )}
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
