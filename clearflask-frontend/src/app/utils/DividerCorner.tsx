import React, { Component } from 'react';
import { withStyles, Theme, createStyles, WithStyles } from '@material-ui/core/styles';
import { Divider, Typography } from '@material-ui/core';
import DividerVertical from './DividerVertical';
import { ThemeStyle } from '@material-ui/core/styles/createTypography';

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
  titleVariant?:ThemeStyle;
  header?:React.ReactNode;
  width?:string;
  height?:string;
  rtl?:boolean;
}

class DividerCorner extends Component<Props&WithStyles<typeof styles, true>> {

  render() {
    return (
      <div className={this.props.className} style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: this.props.rtl ? 'flex-end' : 'flex-start',
      }}>
        <div style={{
          minWidth: this.props.width || '24px',
          display: 'inline-block',
        }}>
          {this.props.title !== undefined ? (
            <Typography variant={this.props.titleVariant || 'overline'} className={this.props.classes.title}>
              {this.props.title}
            </Typography>
          ) : null}
          {this.props.header}
          <Divider />
        </div>
        <div style={{
          display: 'flex',
          width: '100%',
          flexDirection: this.props.rtl ? 'row-reverse' : 'row',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'stretch',
          }}>
            <DividerVertical style={{ height: this.props.height || '24px' }} />
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
