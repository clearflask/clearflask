// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import { Fade } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import { Status } from '../../api/server';
import Message from '../../common/Message';
import Loading from './Loading';

const styles = (theme: Theme) => createStyles({
  container: {
    margin: theme.spacing(1),
    display: 'flex',
  },
});

interface Props extends WithStyles<typeof styles, true> {
  className?: string;
  loaded?: boolean;
  error?: string;
  status?: Status;
  skipFade?: boolean;
}
class Loader extends Component<Props> {
  render() {
    if (this.props.status === Status.REJECTED || this.props.error) {
      return (<Message message={this.props.error || 'Failed to load'} severity='error' />);
    }
    if (this.props.status !== Status.FULFILLED && !this.props.loaded) {
      return (<Loading />);
    }
    var result = this.props.children;
    if (this.props.className || !this.props.skipFade) result = (
      <div className={this.props.className}>
        {result}
      </div>
    );
    if (!this.props.skipFade) result = (
      <Fade in={this.props.status === Status.FULFILLED || this.props.loaded}>
        {result as any}
      </Fade>
    );
    return result;
  }
}

export default withStyles(styles, { withTheme: true })(Loader);
