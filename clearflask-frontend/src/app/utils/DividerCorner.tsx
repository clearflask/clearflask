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
    display: 'inline-block',
    transition: (props: Props) => theme.transitions.create('min-width', props.isExplorer ? { duration: theme.explorerExpandTimeout } : undefined),
  },
  titles: {
    display: 'flex',
    width: '100%',
  },
  flexGrow: {
    flexGrow: 1,
  },
  contentContainer: {
    display: 'flex',
    width: '100%',
    flexDirection: 'row',
  },
});

interface Props {
  className?: string;
  innerClassName?: string;
  title?: string | React.ReactNode;
  header?: React.ReactNode;
  width?: string | number;
  height?: string | number;
  maxHeight?: string | number;
  titleRight?: string | React.ReactNode;
  headerRight?: React.ReactNode;
  widthRight?: string | number;
  heightRight?: string | number;
  maxHeightRight?: string | number;
  isExplorer?: boolean
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
              minWidth: this.props.width !== undefined ? this.props.width : '24px',
            }}>
              {this.props.title !== undefined ? (
                <Typography variant='body1' className={this.props.classes.title}>
                  {this.props.title}
                </Typography>
              ) : null}
              {this.props.header}
              <Divider />
            </div>
          )}
          <div className={this.props.classes.flexGrow} />
          {rightPresent && (
            <div className={this.props.classes.titleContainer} style={{
              minWidth: this.props.widthRight !== undefined ? this.props.widthRight : '24px',
            }}>
              {this.props.titleRight !== undefined ? (
                <Typography variant='body1' className={this.props.classes.title}>
                  {this.props.titleRight}
                </Typography>
              ) : null}
              {this.props.headerRight}
              <Divider />
            </div>
          )}
        </div>
        <div className={this.props.classes.contentContainer}>
          {leftPresent && (
            <div style={{ display: 'flex' }}>
              <DividerVertical
                className={this.props.classes.heightTransition}
                style={{
                  height: this.props.height !== undefined ? this.props.height : '24px',
                  maxHeight: this.props.maxHeight,
                }}
              />
            </div>
          )}
          <div className={classNames(this.props.innerClassName, this.props.classes.flexGrow)}>
            {this.props.children}
          </div>
          {rightPresent && (
            <div style={{ display: 'flex' }}>
              <DividerVertical
                className={this.props.classes.heightTransition}
                style={{
                  height: this.props.heightRight !== undefined ? this.props.heightRight : '24px',
                  maxHeight: this.props.maxHeightRight,
                }}
              />
            </div>
          )}
        </div>
      </div>
    );
  }
}

export default withStyles(styles, { withTheme: true })(DividerCorner);
