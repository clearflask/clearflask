import React, { Component } from 'react';
import { withStyles, Theme, createStyles, WithStyles } from '@material-ui/core/styles';
import { Divider, Typography } from '@material-ui/core';
import DividerVertical from './DividerVertical';

const styles = (theme:Theme) => createStyles({
  title: {
    margin: theme.spacing.unit,
  },
  dividerHorizontal: {
    gridArea: 'divider-horizontal',
  },
  dividerVertical: {
    gridArea: 'divider-vertical',
  },
});

interface Props {
  className?:string
  title?:string;
  header?:React.ReactNode;
  width?:string;
  height?:string;
}

class DividerCorner extends Component<Props&WithStyles<typeof styles, true>> {

  render() {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        flexDirection: 'column',
      }}>
        <div style={{
          minWidth: this.props.width || '50%',
          display: 'inline-block',
        }}>
          {this.props.title ? (
            <Typography variant='overline' className={this.props.classes.title}>
              {this.props.title}
            </Typography>
          ) : null}
          {this.props.header}
          <Divider />
        </div>
        <div style={{
          display: 'flex',
          width: '100%',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'stretch',
          }}>
            <DividerVertical style={{ height: this.props.height || '50%' }} />
          </div>
          <div style={{width: '100%'}}>
            {this.props.children}
          </div>
        </div>
      </div>
    );
  }
}

export default withStyles(styles, { withTheme: true })(DividerCorner);
