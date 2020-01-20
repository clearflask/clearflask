import React, { Component } from 'react';
import * as Client from '../api/client';
import { Badge } from '@material-ui/core';
import { Server, ReduxState, Status } from '../api/server';
import { connect } from 'react-redux';

interface Props {
  server:Server;
}
interface ConnectProps {
  isLoggedIn:boolean;
  notifications?:Client.Notification[];
  hasMore:boolean;
}

class NotificationBadge extends Component<Props&ConnectProps> {
  render() {
    if(!this.props.isLoggedIn) return null;

    return (
      <Badge
        badgeContent={this.props.notifications ? this.props.notifications.length : 0}
        color='secondary'
        max={999}
      >
        {this.props.children}
      </Badge>
    );
  }
}

export default connect<ConnectProps,{},Props,ReduxState>((state, ownProps) => {
  const userId = state.users.loggedIn.status === Status.FULFILLED && state.users.loggedIn.user && state.users.loggedIn.user.userId || undefined;
  if(userId && state.notifications.notificationSearch.status === undefined) {
    ownProps.server.dispatch().notificationSearch({
      projectId: ownProps.server.getProjectId(),
    });
  }
  return {
    isLoggedIn: !!userId,
    notifications: state.notifications.notificationSearch.notifications,
    hasMore: !!state.notifications.notificationSearch.cursor,
  };
})(NotificationBadge);
