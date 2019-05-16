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
});

interface Props {
  title?:string;
  width?:string;
  height?:string;
}

class DividerCorner extends Component<Props&WithStyles<typeof styles, true>> {

  render() {
    return (
      <div>
        <div style={{
          minWidth: this.props.width || '50%',
        }}>
          {this.props.title ? (
            <Typography variant='overline' className={this.props.classes.title}>
              {this.props.title}
            </Typography>
          ) : null}
          <Divider />
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
        }}>
          <div style={{
            height: this.props.height || '50%',
          }}><DividerVertical /></div>
          <div>{this.props.children}</div>
        </div>
      </div>
    );
  }
}

export default withStyles(styles, { withTheme: true })(DividerCorner);
