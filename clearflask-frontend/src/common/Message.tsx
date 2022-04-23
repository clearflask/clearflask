// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
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
  children?: any;
  className?: string;
  innerStyle?: React.CSSProperties;
  message: React.ReactNode | string,
  action?: React.ReactNode,
  severity?: Color,
  variant?: 'standard' | 'filled' | 'outlined',
}
class Message extends Component<Props & WithStyles<typeof styles, true>> {
  render() {
    return (
      <Alert
        className={classNames(this.props.className, this.props.classes.alert)}
        variant={this.props.variant || 'outlined'}
        style={this.props.innerStyle}
        severity={this.props.severity}
        action={this.props.action}
      >
        {this.props.message}
      </Alert>
    );
  }
}

export default withStyles(styles, { withTheme: true })(Message);
