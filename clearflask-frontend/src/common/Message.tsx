import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import { Alert, Color } from '@material-ui/lab';
import classNames from 'classnames';
import React, { Component } from 'react';

const styles = (theme: Theme) => createStyles({
  alert: {
    margin: 'auto',
  },
});
interface Props {
  className?: string;
  innerStyle?: React.CSSProperties;
  message: React.ReactNode | string,
  action?: React.ReactNode,
  severity?: Color,
  variant?: Color, // Deprecated
}
class Message extends Component<Props & WithStyles<typeof styles, true>> {
  render() {
    return (
      <Alert
        className={classNames(this.props.className, this.props.classes.alert)}
        variant='outlined'
        style={this.props.innerStyle}
        severity={this.props.severity || this.props.variant}
        action={this.props.action}
      >
        {this.props.message}
      </Alert>
    );
  }
}

export default withStyles(styles, { withTheme: true })(Message);
