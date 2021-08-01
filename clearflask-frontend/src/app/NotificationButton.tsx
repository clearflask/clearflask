// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
import { Badge, Collapse, IconButton } from '@material-ui/core';
import NotificationsIcon from '@material-ui/icons/Notifications';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import * as Client from '../api/client';
import { ReduxState, Server, Status } from '../api/server';
import NotificationPopup from './NotificationPopup';

interface Props {
  className?: string;
  server: Server;
  showCount?: boolean;
}
interface ConnectProps {
  isLoggedIn: boolean;
  notifications?: Client.Notification[];
  hasMore: boolean;
  callOnMount?: () => void,
}
interface State {
  notificationAnchorEl?: HTMLElement;
}
class NotificationButton extends Component<Props & ConnectProps, State> {
  state: State = {};

  constructor(props) {
    super(props);

    props.callOnMount?.();
  }

  render() {
    if (!this.props.isLoggedIn) return null;

    return (
      <Collapse
        in={!!this.props.notifications?.length}
        className={this.props.className}
      >
        <IconButton
          aria-label='Notifications'
          onClick={e => this.setState({ notificationAnchorEl: !!this.state.notificationAnchorEl ? undefined : e.currentTarget })}
        >
          <Badge
            badgeContent={this.props.notifications ? this.props.notifications.length : 0}
            color='secondary'
            variant={this.props.showCount ? 'standard' : 'dot'}
            max={999}
          >
            <NotificationsIcon fontSize='inherit' />
            <NotificationPopup
              server={this.props.server}
              anchorEl={this.state.notificationAnchorEl}
              onClose={() => this.setState({ notificationAnchorEl: undefined })}
            />
          </Badge>
        </IconButton>
      </Collapse>
    );
  }
}

export default connect<ConnectProps, {}, Props, ReduxState>((state, ownProps) => {
  const userId = state.users.loggedIn.status === Status.FULFILLED && state.users.loggedIn.user && state.users.loggedIn.user.userId || undefined;
  return {
    isLoggedIn: !!userId,
    notifications: state.notifications.notificationSearch.notifications,
    hasMore: !!state.notifications.notificationSearch.cursor,
    callOnMount: (userId && state.notifications.notificationSearch.status === undefined) ? () => {
      ownProps.server.dispatch().then(d => d.notificationSearch({
        projectId: ownProps.server.getProjectId(),
      }));
    } : undefined,
  };
})(NotificationButton);
