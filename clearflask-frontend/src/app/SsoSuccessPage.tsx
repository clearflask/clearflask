import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import * as Client from '../api/client';
import { ReduxState } from '../api/server';
import windowIso from '../common/windowIso';
import ErrorPage from './ErrorPage';

const styles = (theme: Theme) => createStyles({
});
interface Props {
  type: 'sso' | 'oauth';
}
interface ConnectProps {
  userMe?: Client.UserMe;
}
class SsoSuccessPage extends Component<Props & ConnectProps & WithStyles<typeof styles, true>> {
  render() {
    if (windowIso.isSsr) {
      return null; // prevent a flash of "Failed to log in"
    } else if (!this.props.userMe) {
      return (<ErrorPage msg='Failed to log in' variant='error' />);
    } else {
      !windowIso.isSsr && setTimeout(() => !windowIso.isSsr && windowIso.self.close(), 500);
      return (<ErrorPage msg='Successfully logged in' variant='success' />);
    }
  }
}

export default connect<ConnectProps, {}, Props, ReduxState>((state, ownProps) => {
  const connectProps: ConnectProps = {
    userMe: state.users.loggedIn.user,
  };
  return connectProps;
}, null, null, { forwardRef: true })(withStyles(styles, { withTheme: true })(SsoSuccessPage));
