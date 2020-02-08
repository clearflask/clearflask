import React, { Component, Suspense } from 'react';
import * as ConfigEditor from '../configEditor';
import { Typography } from '@material-ui/core';
import Property from './Property';
import PresetWidget from './PresetWidget';
import CreditPreview from './injects/CreditPreview';
import Loading from '../../../app/utils/Loading';

interface Props {
  key:string;
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
    var creditPreview = this.props.page.pathStr === 'credits'
      && (<CreditPreview editor={this.props.editor} />);
    var workflowPreview;
    if(this.props.page.path.length > 0 && this.props.page.path[this.props.page.path.length - 1] === 'workflow') {
      const WorkflowPreviewLazyCmpt = React.lazy(() => import('./injects/WorkflowPreview'));
      workflowPreview = (
        <Suspense fallback={<Loading />}>
          <WorkflowPreviewLazyCmpt editor={this.props.editor} page={this.props.page} />
        </Suspense>
      );
    }
    return (
      <div>
        <Typography variant='h4' component='h1'>{this.props.page.getDynamicName()}</Typography>
        <Typography variant='body1' component='p'>{this.props.page.description}</Typography>
        <PresetWidget page={this.props.page} editor={this.props.editor} />
        {creditPreview}
        {workflowPreview}
        {this.props.page.getChildren().all
          .filter(child => (child as ConfigEditor.Property).subType !== ConfigEditor.PropSubType.Id)
          .map(child => (
            <Property key={child.key} prop={child} pageClicked={this.props.pageClicked} />
          ))}
      </div>
    );
  }
}
