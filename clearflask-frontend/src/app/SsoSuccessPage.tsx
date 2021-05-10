import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import * as Client from '../api/client';
import { ReduxState, Status } from '../api/server';
import windowIso from '../common/windowIso';
import ErrorPage from './ErrorPage';
import LoadingPage from './LoadingPage';

const styles = (theme: Theme) => createStyles({
});
interface Props {
  type: 'sso' | 'oauth';
}
interface ConnectProps {
  userMe?: Client.UserMe;
  userMeStatus?: Status;
}
class SsoSuccessPage extends Component<Props & ConnectProps & WithStyles<typeof styles, true>> {
  render() {
    if (windowIso.isSsr
      || this.props.userMeStatus === Status.PENDING
      || this.props.userMeStatus === undefined) {
      return <LoadingPage />;
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
    userMeStatus: state.users.loggedIn.status,
  };
  return connectProps;
}, null, null, { forwardRef: true })(withStyles(styles, { withTheme: true })(SsoSuccessPage));
