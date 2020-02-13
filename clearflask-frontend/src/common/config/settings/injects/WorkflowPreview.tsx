import React, { Component } from 'react';
import { createStyles, withStyles, WithStyles, Theme } from '@material-ui/core';
import * as ConfigEditor from '../../configEditor';
import CytoscapeComponent from 'react-cytoscapejs';
import Cytoscape from 'cytoscape';
import dagre from 'cytoscape-dagre';
import DividerCorner from '../../../../app/utils/DividerCorner';
import ErrorMsg from '../../../../app/ErrorMsg';

const styles = (theme:Theme) => createStyles({
  graph: {
    border: '1px solid ' + theme.palette.grey[300],
  },
});

interface Props extends WithStyles<typeof styles, true> {
  page:ConfigEditor.Page;
  editor:ConfigEditor.Editor;
}

interface State {
  error?:string;
}

class WorkflowPreview extends Component<Props, State> {
  state:State = {};
  unsubscribe?:()=>void;

  constructor(props) {
    super(props);
    Cytoscape.use(dagre);
  }

  static getDerivedStateFromError(error) {
    return {error: 'Failed to render visualization'};
  }

  componentDidMount() {
    this.unsubscribe = this.props.editor.subscribe(() => {
      if(!!this.state.error) {
        this.setState({error: undefined});
      } else {
        this.forceUpdate.bind(this)
      }
    });
  }

  componentWillUnmount() {
    this.unsubscribe && this.unsubscribe();
  }

  render() {
    if(!!this.state.error) {
      return (
        <ErrorMsg msg={this.state.error} />
      );
    }

    const seenStatusIds:Set<string> = new Set();
    var nodes:any[] = [];
    var edges:any[] = [];
    const entryStatusId = (this.props.editor.get([...this.props.page.path, 'entryStatus']) as ConfigEditor.StringProperty).value;
    const statusCount = (this.props.editor.get([...this.props.page.path, 'statuses']) as ConfigEditor.PageGroup).getChildPages().length;
    for(var i = 0; i < statusCount; i++) {
      const name = (this.props.editor.get([...this.props.page.path, 'statuses', i, 'name']) as ConfigEditor.StringProperty).value;
      const statusId = (this.props.editor.get([...this.props.page.path, 'statuses', i, 'statusId']) as ConfigEditor.StringProperty).value!;
      const color = (this.props.editor.get([...this.props.page.path, 'statuses', i, 'color']) as ConfigEditor.StringProperty).value;
      const nextStatusIds = (this.props.editor.get([...this.props.page.path, 'statuses', i, 'nextStatusIds']) as ConfigEditor.LinkMultiProperty).value;
      const isStart = statusId === entryStatusId;
      seenStatusIds.add(statusId);
      nodes.push({data:{
        id: statusId,
        label: name,
        color: color,
        type: isStart ? 'circle' : 'round-rectangle',
      }});
      nextStatusIds && nextStatusIds.forEach(nextStatusId => edges.push({data:{
        source: statusId,
        target: nextStatusId,
      }}))
    }
    return (
      <DividerCorner title='Visualization' height='100%'>
        <CytoscapeComponent
          elements={[
            ...nodes,
            ...edges.filter(e => seenStatusIds.has(e.data.source) && seenStatusIds.has(e.data.target))
          ]}
          style={{
            width: '100%',
            'min-width': '250px',
            height: '250px',
          }}
          layout={{
            name: 'dagre',
            spacingFactor: 1,
            rankDir: 'LR',
            ranker: 'longest-path',
          }}
          stylesheet={[{
            selector: 'node',
            style: {
              'label': 'data(label)',
              'font-size': 12,
              'background-color': 'white',
              'color': 'data(color)',
              'shape': 'data(type)',
              'border-width': 2,
              'border-color': '#eee',
              'content': 'data(label)',
              'width': '100',
              'height': '30',
              'text-valign': 'center',
              'text-halign': 'center',
            }
          },{
            selector: 'edge',
            style: {
              'width': 2,
              'line-color': '#eee',
              'target-arrow-color': '#eee',
              'target-arrow-shape': 'triangle',
              'curve-style': 'unbundled-bezier',
            }
          }]}
        />
      </DividerCorner>
    );
  }
}

export default withStyles(styles, { withTheme: true })(WorkflowPreview);
