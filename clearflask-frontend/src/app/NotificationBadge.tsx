import { Badge } from '@material-ui/core';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import * as Client from '../api/client';
import { ReduxState, Server, Status } from '../api/server';

interface Props {
  server: Server;
  showCount?: boolean;
  children?: React.ReactNode;
}
interface ConnectProps {
  isLoggedIn: boolean;
  notifications?: Client.Notification[];
  hasMore: boolean;
  callOnMount?: () => void,
}

class NotificationBadge extends Component<Props & ConnectProps> {

  componentDidMount() {
    this.props.callOnMount && this.props.callOnMount();
  }

  render() {
    if (!this.props.isLoggedIn) return null;

    return (
      <Badge
        badgeContent={this.props.notifications ? this.props.notifications.length : 0}
        color='secondary'
        variant={this.props.showCount ? 'standard' : 'dot'}
        max={999}
      >
        {this.props.children}
      </Badge>
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
})(NotificationBadge);
