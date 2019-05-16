import React, { Component } from 'react';
import { withStyles, Theme, createStyles, WithStyles } from '@material-ui/core/styles';
import { Divider, Typography } from '@material-ui/core';
import { DividerProps } from '@material-ui/core/Divider';
import DividerVertical from './DividerVertical';

const styles = (theme:Theme) => createStyles({
  title: {
    margin: theme.spacing.unit,
  },
  grid: {
    display: 'grid',
    gridTemplateAreas:
      '"divider-horizontal divider-horizontal ."'
      + ' "divider-vertical content content"'
      + ' ". content content"',
  },
  dividerHorizontal: {
    gridArea: 'divider-horizontal',
  },
  dividerVertical: {
    gridArea: 'divider-vertical',
  },
  content: {
    gridArea: 'content',
    marginTop: theme.spacing.unit,
    marginLeft: theme.spacing.unit,
    minWidth: 0,
    minHeight: 0,
  },
});

interface Props {
  title?:string;
  width?:string;
  height?:string;
}

class DividerCorner extends Component<Props&WithStyles<typeof styles, true>> {

  render() {
    return [
      this.props.title ? (
        <Typography variant='overline' className={this.props.classes.title}>
          {this.props.title}
        </Typography>
      ) : null,
      <div className={this.props.classes.grid} style={{
        gridTemplateColumns: `1px ${this.props.width || '50%'} auto`,
        gridTemplateRows: `1px ${this.props.height || '50%'} auto`,
      }}>
        <div className={this.props.classes.dividerHorizontal}><Divider /></div>
        <div className={this.props.classes.dividerVertical}><DividerVertical /></div>
        <div className={this.props.classes.content}>{this.props.children}</div>
      </div>
    ];
  }
}

export default withStyles(styles, { withTheme: true })(DividerCorner);
