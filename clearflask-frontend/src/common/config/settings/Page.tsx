import React, { Component } from 'react';
import * as ConfigEditor from '../configEditor';
import { Typography, TableHead, TableRow, TableCell, Checkbox } from '@material-ui/core';
import Property from './Property';
import TableProp from './TableProp';

interface Props {
  page:ConfigEditor.Page|ConfigEditor.PageGroup;
}

class Page extends Component<Props> {

  render() {
    var content;
    if(this.props.page.type === 'page') {
      const childProps = this.props.page.getChildren().props;
      content = childProps.map(childProp => (<Property key={childProp.pathStr} prop={childProp} />));
    } else {
      content = (
        <TableProp data={this.props.page} />
      );
    }

    const name = this.props.page.type === 'page'
      ? this.props.page.getDynamicName()
      : this.props.page.name;

    return (
      <div>
        <Typography variant='h4'>{name}</Typography>
        <Typography variant='body1'>{this.props.page.description}</Typography>
        {content}
      </div>
    );
  }
}

export default Page;
