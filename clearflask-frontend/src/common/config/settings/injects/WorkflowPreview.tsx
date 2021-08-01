// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
import loadable from '@loadable/component';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core';
import classNames from 'classnames';
import React, { Component } from 'react';
import DividerCorner from '../../../../app/utils/DividerCorner';
import Loading from '../../../../app/utils/Loading';
import { importFailed, importSuccess } from '../../../../Main';
import { contentScrollApplyStyles, Orientation } from '../../../ContentScroll';
import windowIso from '../../../windowIso';
import { WorkflowPreviewInternalProps } from './WorkflowPreviewInternal.d';

const WorkflowPreviewInternal = loadable<WorkflowPreviewInternalProps>(() => import(/* webpackChunkName: "WorkflowPreviewInternal", webpackPrefetch: true */'./WorkflowPreviewInternal').then(importSuccess).catch(importFailed), { fallback: (<Loading />), ssr: false });

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
interface Props {
  hideCorner?: boolean;
  width?: number | string;
  height?: number | string;
  scroll?: boolean;
  border?: boolean;
}
class WorkflowPreview extends Component<Props & Omit<WorkflowPreviewInternalProps, 'fontFamily' | 'style'> & WithStyles<typeof styles, true>> {
  render() {
    const { classes, theme, scroll, border, className, ...WorkflowPreviewInternalProps } = this.props;

    const style = {
      'min-width': '250px',
      width: this.props.width || '100%',
      height: this.props.height || '250px',
    };
    const myClassNames = classNames(
      className,
      this.props.border && this.props.classes.border,
      this.props.scroll && this.props.classes.scroll,
    );

    const fallback = (
      <div
        className={myClassNames}
        style={style}
      >
        <Loading />
      </div>
    );
    if (windowIso.isSsr) {
      return fallback;
    }

    var content = (
      <WorkflowPreviewInternal
        {...WorkflowPreviewInternalProps}
        fontFamily={this.props.theme.typography.fontFamily}
        className={myClassNames}
        style={style}
        fallback={fallback}
      />
    );
    if (!this.props.hideCorner) {
      content = (
        <DividerCorner title='Visualize states' height='100%'>
          {content}
        </DividerCorner>
      );
    }
    return content;
  }
}

export default withStyles(styles, { withTheme: true })(WorkflowPreview);
