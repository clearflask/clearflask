// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import { withSnackbar, WithSnackbarProps } from 'notistack';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import * as Client from '../api/client';
import { ReduxState, Server } from '../api/server';
import UserContributions from '../common/UserContributions';
import FundingControl from './comps/FundingControl';
import TransactionList from './comps/TransactionList';
import UserEdit from './comps/UserEdit';
import ErrorPage from './ErrorPage';

const styles = (theme: Theme) => createStyles({
  page: {
    margin: 'auto',
    width: 'max-content',
    maxWidth: 1024,
  },
  section: {
    padding: theme.spacing(4, 0),
  },
});
interface Props {
  server: Server;
}
interface ConnectProps {
  userMe?: Client.UserMe;
  credits?: Client.Credits;
}
class AccountPage extends Component<Props & ConnectProps & WithStyles<typeof styles, true> & WithSnackbarProps> {
  render() {
    if (!this.props.userMe) {
      return (<ErrorPage msg='You need to log in to see your account details' variant='info' />);
    }

    return (
      <div className={this.props.classes.page}>
        <UserEdit server={this.props.server} userId={this.props.userMe.userId} />
        {this.props.credits && (
          <FundingControl
            server={this.props.server}
            className={this.props.classes.section}
            title='Funded'
            hideIfEmpty
          />
        )}
        {this.props.credits && (
          <TransactionList server={this.props.server} className={this.props.classes.section} />
        )}
        <UserContributions
          sectionClassName={this.props.classes.section}
          server={this.props.server}
          userId={this.props.userMe.userId}
        />
      </div>
    );
  }
}

export default connect<ConnectProps, {}, Props, ReduxState>((state, ownProps) => {
  const connectProps: ConnectProps = {
    userMe: state.users.loggedIn.user,
    credits: state.conf.conf?.users.credits,
  };
  return connectProps;
}, null, null, { forwardRef: true })(withStyles(styles, { withTheme: true })(withSnackbar(AccountPage)));
