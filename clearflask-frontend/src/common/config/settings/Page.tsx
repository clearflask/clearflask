import React, { Component } from 'react';
import * as ConfigEditor from '../configEditor';
import { Typography, TableHead, TableRow, TableCell, Checkbox } from '@material-ui/core';
import Property from './Property';
import TableProp from './TableProp';

interface Props {
  page:ConfigEditor.Page;
  pageClicked:(path:ConfigEditor.Path)=>void;
}

class Page extends Component<Props> {
  unsubscribe?:()=>void;

  componentDidMount() {
    this.unsubscribe = this.props.page.subscribe(this.forceUpdate.bind(this));
  }

  componentWillUnmount() {
    this.unsubscribe && this.unsubscribe();
  }

  render() {
    return (
      <div>
        <Typography variant='h4'>{this.props.page.getDynamicName()}</Typography>
        <Typography variant='body1'>{this.props.page.description}</Typography>
        {this.props.page.getChildren().props
          .filter(childProp => childProp.subType !== ConfigEditor.PropSubType.Id)
          .map(childProp => (
            <Property key={childProp.pathStr} prop={childProp} pageClicked={this.props.pageClicked} />
          ))}
        {this.props.page.getChildren().groups
          .map(childPageGroup => (
            <Property key={childPageGroup.pathStr} prop={childPageGroup} pageClicked={this.props.pageClicked} />
          ))}
      </div>
    );
  }
}

export default Page;
