// SPDX-FileCopyrightText: 2019-2020 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
import { Typography } from '@material-ui/core';
import React from 'react';
import { connect } from 'react-redux';
import * as Client from '../api/client';
import { ReduxState } from '../api/server';
import ModStar from './ModStar';
import UserDisplay, { DisplayUserName } from './UserDisplay';

interface Props {
  variant: 'button' | 'text';
}
interface ConnectProps {
  loggedInUser?: Client.UserMe;
}
class UserDisplayMe extends React.Component<Props & Omit<React.ComponentProps<typeof UserDisplay>, 'user'> & ConnectProps> {
  render() {
    return this.props.variant === 'button'
      ? (
        <UserDisplay
          {...this.props}
          user={this.props.loggedInUser || {
            userId: '',
            name: 'Anonymous',
          }}
        />
      ) : (
        <Typography variant='caption'>
          <ModStar name={DisplayUserName(this.props.loggedInUser)} isMod={this.props.loggedInUser?.isMod} />
        </Typography>
      );
  }
}

export default connect<ConnectProps, {}, Props, ReduxState>((state, ownProps) => {
  const connectProps: ConnectProps = {
    loggedInUser: state.users.loggedIn.user,
  };
  return connectProps;
})(UserDisplayMe);
