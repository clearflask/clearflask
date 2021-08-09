// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import { withSnackbar, WithSnackbarProps } from 'notistack';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import * as Client from '../api/client';
import { ReduxState, Server } from '../api/server';
import UserContributions from '../common/UserContributions';
import UserEdit from './comps/UserEdit';
import ErrorPage from './ErrorPage';

const styles = (theme: Theme) => createStyles({
  page: {
    margin: 'auto',
    width: 'max-content',
    maxWidth: 1024,
  },
  userContributions: {
    marginTop: theme.spacing(4),
  },
});
interface Props {
  server: Server;
}
interface ConnectProps {
  userMe?: Client.UserMe;
}
class AccountPage extends Component<Props & ConnectProps & WithStyles<typeof styles, true> & WithSnackbarProps> {
  render() {
    if (!this.props.userMe) {
      return (<ErrorPage msg='You need to log in to see your account details' variant='info' />);
    }

    return (
      <div className={this.props.classes.page}>
        <UserEdit server={this.props.server} userId={this.props.userMe.userId} />
        <div className={this.props.classes.userContributions}>
          <UserContributions server={this.props.server} userId={this.props.userMe.userId} />
        </div>
      </div>
    );
  }
}

export default connect<ConnectProps, {}, Props, ReduxState>((state, ownProps) => {
  const connectProps: ConnectProps = {
    userMe: state.users.loggedIn.user,
  };
  return connectProps;
}, null, null, { forwardRef: true })(withStyles(styles, { withTheme: true })(withSnackbar(AccountPage)));
