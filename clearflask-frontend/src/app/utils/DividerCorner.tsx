// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import { Divider, Typography } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import classNames from 'classnames';
import React, { Component } from 'react';
import DividerVertical from './DividerVertical';

const styles = (theme: Theme) => createStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  title: {
    margin: theme.spacing(1),
    color: theme.palette.text.secondary,
  },
  dividerHorizontal: {
    gridArea: 'divider-horizontal',
  },
  dividerVertical: {
    gridArea: 'divider-vertical',
  },
  heightTransition: {
    transition: (props: Props) => theme.transitions.create('height', props.isExplorer ? { duration: theme.explorerExpandTimeout } : undefined),
  },
  titleContainer: {
    flexShrink: 0,
    display: 'inline-block',
    transition: (props: Props) => theme.transitions.create('width', props.isExplorer ? { duration: theme.explorerExpandTimeout } : undefined),
  },
  titles: {
    display: 'flex',
    width: '100%',
    alignItems: 'flex-end',
  },
  flexGrow: {
    flexGrow: 1,
    width: '100%',
  },
  contentContainer: {
    display: 'flex',
    width: '100%',
    flexDirection: 'row',
  },
  margins: {
    padding: (props: Props) => props.margins,
  },
});

interface Props {
  className?: string;
  innerClassName?: string;
  title?: string | React.ReactNode;
  header?: React.ReactNode;
  width?: string | number;
  maxWidth?: string | number;
  height?: string | number;
  maxHeight?: string | number;
  titleRight?: string | React.ReactNode;
  headerRight?: React.ReactNode;
  widthRight?: string | number;
  maxWidthRight?: string | number;
  heightRight?: string | number;
  maxHeightRight?: string | number;
  isExplorer?: boolean
  grow?: 'left' | 'center' | 'right';
  margins?: string | number;
  suppressDivider?: boolean;
}

class DividerCorner extends Component<Props & WithStyles<typeof styles, true>> {

  render() {
    const leftPresent = (this.props.height !== undefined || this.props.width !== undefined || !!this.props.header || !!this.props.title);
    const rightPresent = (this.props.heightRight !== undefined || this.props.widthRight !== undefined || !!this.props.headerRight || !!this.props.titleRight);
    return (
      <div className={classNames(this.props.className, this.props.classes.container)}>
        <div className={this.props.classes.titles}>
          {leftPresent && (
            <div className={this.props.classes.titleContainer} style={{
              width: this.props.width !== undefined
                ? this.props.width
                : (this.props.title || this.props.header) ? undefined : '24px',
              maxWidth: this.props.maxWidth,
              flexGrow: this.props.grow === 'left' ? 1 : undefined,
            }}>
              {this.props.title !== undefined ? (
                <Typography variant='body1' className={this.props.classes.title}>
                  {this.props.title}
                </Typography>
              ) : null}
              {this.props.header}
              {!this.props.suppressDivider && (<Divider />)}
            </div>
          )}
          {this.props.grow === 'center' && (
            <div className={this.props.classes.flexGrow} />
          )}
          {rightPresent && (
            <div className={this.props.classes.titleContainer} style={{
              width: this.props.widthRight !== undefined
                ? this.props.widthRight
                : (this.props.titleRight || this.props.headerRight) ? undefined : '24px',
              maxWidth: this.props.maxWidthRight,
              flexGrow: this.props.grow === 'right' ? 1 : undefined,
            }}>
              {this.props.titleRight !== undefined ? (
                <Typography variant='body1' className={this.props.classes.title}>
                  {this.props.titleRight}
                </Typography>
              ) : null}
              {this.props.headerRight}
              {!this.props.suppressDivider && (<Divider />)}
            </div>
          )}
        </div>
        <div className={this.props.classes.contentContainer}>
          {leftPresent && (
            <div style={{ display: 'flex' }}>
              {!this.props.suppressDivider && (
                <DividerVertical
                  className={this.props.classes.heightTransition}
                  style={{
                    height: this.props.height !== undefined ? this.props.height : '24px',
                    maxHeight: this.props.maxHeight,
                  }}
                />
              )}
            </div>
          )}
          <div className={classNames(this.props.innerClassName, this.props.classes.flexGrow, this.props.classes.margins)}>
            {this.props.children}
          </div>
          {rightPresent && (
            <div style={{ display: 'flex' }}>
              {!this.props.suppressDivider && (
                <DividerVertical
                  className={this.props.classes.heightTransition}
                  style={{
                    height: this.props.heightRight !== undefined ? this.props.heightRight : '24px',
                    maxHeight: this.props.maxHeightRight,
                  }}
                />
              )}
            </div>
          )}
        </div>
      </div>
    );
  }
}

export default withStyles(styles, { withTheme: true })(DividerCorner);
