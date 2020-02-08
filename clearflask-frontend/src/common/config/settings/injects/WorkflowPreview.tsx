import React, { Component } from 'react';
import { createStyles, withStyles, WithStyles, Theme } from '@material-ui/core';
import * as ConfigEditor from '../../configEditor';
import CytoscapeComponent from 'react-cytoscapejs';
import Cytoscape from 'cytoscape';
import dagre from 'cytoscape-dagre';
import DividerCorner from '../../../../app/utils/DividerCorner';

const styles = (theme:Theme) => createStyles({
  graph: {
    border: '1px solid ' + theme.palette.grey[300],
  },
});

interface Props extends WithStyles<typeof styles, true> {
  page:ConfigEditor.Page;
  editor:ConfigEditor.Editor;
}

class WorkflowPreview extends Component<Props> {
  unsubscribe?:()=>void;

  constructor(props) {
    super(props);
    Cytoscape.use(dagre);
  }

  componentDidMount() {
    this.unsubscribe = this.props.editor.subscribe(this.forceUpdate.bind(this));
  }

  componentWillUnmount() {
    this.unsubscribe && this.unsubscribe();
  }

  render() {
    var data:any[] = [];
    // TODO use entry status
    const entryStatusId = (this.props.editor.get([...this.props.page.path, 'entryStatus']) as ConfigEditor.StringProperty).value;
    const statusCount = (this.props.editor.get([...this.props.page.path, 'statuses']) as ConfigEditor.PageGroup).getChildPages().length;
    for(var i = 0; i < statusCount; i++) {
      const name = (this.props.editor.get([...this.props.page.path, 'statuses', i, 'name']) as ConfigEditor.StringProperty).value;
      const statusId = (this.props.editor.get([...this.props.page.path, 'statuses', i, 'statusId']) as ConfigEditor.StringProperty).value;
      // TODO use color
      const color = (this.props.editor.get([...this.props.page.path, 'statuses', i, 'color']) as ConfigEditor.StringProperty).value;
      const nextStatusIds = (this.props.editor.get([...this.props.page.path, 'statuses', i, 'nextStatusIds']) as ConfigEditor.LinkMultiProperty).value;
      data.push({data:{
        id: statusId,
        label: name,
        color: color,
      }});
      nextStatusIds && nextStatusIds.forEach(nextStatusId => data.push({data:{
        source: statusId,
        target: nextStatusId,
      }}))
    }
    return (
      <DividerCorner title='Visualization' height='100%'>
        <CytoscapeComponent
          elements={data}
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
              'background-color': 'data(color)',
            }
          },{
            selector: 'edge',
            style: {
              'width': 3,
              'line-color': '#999',
              'target-arrow-color': '#999',
              'target-arrow-shape': 'triangle',
              'curve-style': 'bezier',
            }
          }]}
        />
      </DividerCorner>
    );
  }
}

export default withStyles(styles, { withTheme: true })(WorkflowPreview);
