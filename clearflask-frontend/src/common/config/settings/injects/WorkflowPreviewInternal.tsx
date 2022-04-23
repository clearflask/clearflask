// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import { createStyles, Theme, withStyles } from '@material-ui/core';
import Cytoscape from 'cytoscape';
import dagre from 'cytoscape-dagre';
import React, { Component } from 'react';
import CytoscapeComponent from 'react-cytoscapejs';
import ErrorMsg from '../../../../app/ErrorMsg';
import { contentScrollApplyStyles, Orientation } from '../../../ContentScroll';
import * as ConfigEditor from '../../configEditor';
import { WorkflowPreviewInternalProps } from './WorkflowPreviewInternal.d';

const styles = (theme: Theme) => createStyles({
  border: {
    border: '1px solid ' + theme.palette.divider,
    borderRadius: 4,
  },
  scroll: {
    width: '100%',
    height: '100%',
    ...contentScrollApplyStyles({ theme, orientation: Orientation.Both }),
  },
});
interface State {
  error?: string;
}
class WorkflowPreview extends Component<WorkflowPreviewInternalProps, State> {
  state: State = {};
  unsubscribe?: () => void;

  constructor(props) {
    super(props);
    Cytoscape.use(dagre);
  }

  static getDerivedStateFromError(error) {
    return { error: 'Failed to render visualization' };
  }

  componentDidMount() {
    this.unsubscribe = this.props.editor.subscribe(() => {
      if (!!this.state.error) {
        this.setState({ error: undefined });
      } else {
        this.forceUpdate();
      }
    });
  }

  componentWillUnmount() {
    this.unsubscribe && this.unsubscribe();
  }

  render() {
    if (!!this.state.error) {
      return (
        <ErrorMsg msg={this.state.error} />
      );
    }

    const seenStatusIds: Set<string> = new Set();
    var nodes: any[] = [];
    var edges: any[] = [];
    const entryStatusId = (this.props.editor.get(['content', 'categories', this.props.categoryIndex, 'workflow', 'entryStatus']) as ConfigEditor.StringProperty).value;
    const statusCount = (this.props.editor.get(['content', 'categories', this.props.categoryIndex, 'workflow', 'statuses']) as ConfigEditor.PageGroup).getChildPages().length;
    for (var i = 0; i < statusCount; i++) {
      const name = (this.props.editor.get(['content', 'categories', this.props.categoryIndex, 'workflow', 'statuses', i, 'name']) as ConfigEditor.StringProperty).value!;
      const statusId = (this.props.editor.get(['content', 'categories', this.props.categoryIndex, 'workflow', 'statuses', i, 'statusId']) as ConfigEditor.StringProperty).value!;
      const color = (this.props.editor.get(['content', 'categories', this.props.categoryIndex, 'workflow', 'statuses', i, 'color']) as ConfigEditor.StringProperty).value;
      const nextStatusIds = (this.props.editor.get(['content', 'categories', this.props.categoryIndex, 'workflow', 'statuses', i, 'nextStatusIds']) as ConfigEditor.LinkMultiProperty).value;
      const isStart = statusId === entryStatusId;
      seenStatusIds.add(statusId);
      nodes.push({
        data: {
          id: statusId,
          label: this.props.renderLabel ? this.props.renderLabel(statusId, name) : name,
          color: color,
          type: 'round-rectangle',
          width: 'label',
          height: 'label',
        }
      });
      nextStatusIds && nextStatusIds.forEach(nextStatusId => edges.push({
        data: {
          source: statusId,
          target: nextStatusId,
        }
      }));
      if (isStart) {
        const startId = 'start';
        seenStatusIds.add(startId);
        nodes.push({
          data: {
            id: startId,
            label: '',
            color: 'eee',
            type: 'circle',
            width: '1px',
            height: '1px',
          }
        });
        edges.push({
          data: {
            source: startId,
            target: statusId,
          }
        });
      }
    }
    if (nodes.length <= 0) {
      return null;
    }

    var content = (
      <CytoscapeComponent
        key={nodes.length + edges.length}
        minZoom={1}
        maxZoom={2}
        autounselectify={!!this.props.static}
        userZoomingEnabled={!this.props.static}
        userPanningEnabled={!this.props.static}
        autoungrabify={!!this.props.static}
        boxSelectionEnabled={!this.props.static}
        elements={[
          ...nodes,
          ...edges.filter(e => seenStatusIds.has(e.data.source) && seenStatusIds.has(e.data.target))
        ]}
        className={this.props.className}
        style={this.props.style}
        layout={{
          name: 'dagre',
          spacingFactor: 1,
          rankDir: this.props.isVertical ? 'TB' : 'LR',
          ranker: 'longest-path',
        }}
        stylesheet={[{
          selector: 'node',
          style: {
            'label': 'data(label)',
            'font-size': 12,
            // Causes a browser crash on Mac Chrome 96, crazy...
            // 'font-family': this.props.fontFamily,
            'background-color': 'white',
            'border-width': '1px',
            'border-color': 'data(color)',
            'color': 'data(color)',
            'shape': 'data(type)',
            'content': 'data(label)',
            'width': 'data(width)',
            'height': 'data(height)',
            'min-width': '10px',
            'min-height': '10px',
            'padding': '10px',
            'text-valign': 'center',
            'text-halign': 'center',
          }
        }, {
          selector: 'edge',
          style: {
            'width': 2,
            'line-color': '#e0e0e0',
            'target-arrow-color': '#bbb',
            'target-arrow-shape': 'triangle',
            'curve-style': 'unbundled-bezier',
          }
        }]}
      />
    );

    return content;
  }
}

export default withStyles(styles, { withTheme: true })(WorkflowPreview);
