import React, { Component } from 'react';
import * as ConfigEditor from '../configEditor';
import { Typography, TableHead, TableRow, TableCell, Checkbox, withStyles, Link } from '@material-ui/core';
import Property from './Property';
import PresetWidget from './PresetWidget';
import CreditPreview from './injects/CreditPreview';
import Crumbs from './Crumbs';

interface Props {
  page:ConfigEditor.Page;
  editor:ConfigEditor.Editor;
  pageClicked:(path:ConfigEditor.Path)=>void;
}

export default class Page extends Component<Props> {
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
        <Typography variant='h4' component='h1'>{this.props.page.getDynamicName()}</Typography>
        <Typography variant='body1' component='p'>{this.props.page.description}</Typography>
        <PresetWidget page={this.props.page} editor={this.props.editor} />
        {this.props.page.pathStr === 'credits'
          && (<CreditPreview editor={this.props.editor} />)}
        {this.props.page.getChildren().all
          .filter(child => (child as ConfigEditor.Property).subType !== ConfigEditor.PropSubType.Id)
          .map(child => (
            <Property key={child.pathStr} prop={child} pageClicked={this.props.pageClicked} />
          ))}
      </div>
    );
  }
}
