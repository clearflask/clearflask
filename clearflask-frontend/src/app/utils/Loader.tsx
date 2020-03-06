import { Fade } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import { Status } from '../../api/server';
import Message from '../comps/Message';
import Loading from './Loading';

const styles = (theme: Theme) => createStyles({
  container: {
    margin: theme.spacing(1),
    display: 'flex',
  },
});

interface Props extends WithStyles<typeof styles, true> {
  loaded?: boolean;
  error?: string;
  status?: Status;
  inline?: boolean;
}

class Loader extends Component<Props> {
  render() {
    if (this.props.status === Status.REJECTED || this.props.error) {
      return (<Message message={this.props.error || 'Failed to load'} variant='error' />);
    }
    if (this.props.status !== Status.FULFILLED && !this.props.loaded) {
      return (<Loading />);
    }
    return this.props.inline ? this.props.children : (
      <Fade in={this.props.status === Status.FULFILLED || this.props.loaded}>
        <div>
          {this.props.children}
        </div>
      </Fade>
    );
  }
}

export default withStyles(styles, { withTheme: true })(Loader);
