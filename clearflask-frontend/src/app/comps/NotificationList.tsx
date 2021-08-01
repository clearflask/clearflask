// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
import { Button, Table, TableBody, TableCell, TableRow, Typography } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import { RouteComponentProps, withRouter } from 'react-router';
import { Link } from 'react-router-dom';
import TimeAgo from 'react-timeago';
import * as Client from '../../api/client';
import { ReduxState, Server } from '../../api/server';
import { contentScrollApplyStyles, Orientation } from '../../common/ContentScroll';
import ErrorMsg from '../ErrorMsg';

const styles = (theme: Theme) => createStyles({
  table: (props: Props) => ({
    whiteSpace: 'nowrap',
    ...contentScrollApplyStyles({
      theme,
      orientation: Orientation.Horizontal,
      backgroundColor: props.isInsidePaper ? theme.palette.background.paper : undefined,
    }),
  }),
  noNotificationsLabel: {
    margin: theme.spacing(3),
    color: theme.palette.text.secondary,
  },
  button: {
    margin: 'auto',
    display: 'block',
  },
});

interface Props {
  className?: string;
  server: Server;
  isInsidePaper?: boolean;
}

interface ConnectProps {
  callOnMount?: () => void,
  userId?: string;
  notifications?: Client.Notification[];
  getNextNotifications?: () => void;
}

class NotificationList extends Component<Props & ConnectProps & WithStyles<typeof styles, true> & RouteComponentProps> {

  constructor(props) {
    super(props);

    props.callOnMount?.();
  }

  render() {
    if (!this.props.userId) {
      return (<ErrorMsg msg='You need to log in to see your notifications' variant='info' />);
    }
    const hasNotifications = this.props.notifications && this.props.notifications.length > 0;
    return (
      <div className={this.props.className}>
        <div className={this.props.classes.table}>
          <Table size='medium'>
            <TableBody>
              {!hasNotifications ? (
                <Typography
                  className={this.props.classes.noNotificationsLabel}
                  variant='overline'
                >No notifications</Typography>
              ) : this.props.notifications!.map(notification => (
                <TableRow
                  key={notification.notificationId}
                  hover
                >
                  <Link
                    to={this.getNotificationTo(notification)}
                    onClick={() => this.clearNotification(notification)}
                  >
                    <TableCell key='date'><Typography><TimeAgo date={notification.created} /></Typography></TableCell>
                    <TableCell key='description'><Typography>{notification.description}</Typography></TableCell>
                  </Link>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {hasNotifications && (
          <Button fullWidth className={this.props.classes.button} onClick={() => this.clearAll()}>
            Clear all
          </Button>
        )}
        {this.props.getNextNotifications && (
          <Button fullWidth className={this.props.classes.button} onClick={() => this.props.getNextNotifications && this.props.getNextNotifications()}>
            Show more
          </Button>
        )}
      </div>
    );
  }

  getNotificationTo(notification: Client.Notification): string {
    if (notification.relatedIdeaId) {
      if (notification.relatedCommentId) {
        return `/post/${notification.relatedIdeaId}/comment/${notification.relatedCommentId}`;
      } else {
        return `/post/${notification.relatedIdeaId}`;
      }
    } else {
      return `/transaction`;
    }
  }

  clearNotification(notification: Client.Notification) {
    this.props.server.dispatch().then(d => d.notificationClear({
      projectId: this.props.server.getProjectId(),
      notificationId: notification.notificationId,
    }));
  }

  clearAll() {
    this.props.server.dispatch().then(d => d.notificationClearAll({
      projectId: this.props.server.getProjectId(),
    }));
  }
}

export default connect<ConnectProps, {}, Props, ReduxState>((state, ownProps) => {
  const userId = state.users.loggedIn.user ? state.users.loggedIn.user.userId : undefined;
  var getNextNotifications;
  var callOnMount;
  if (userId && state.notifications.notificationSearch.status === undefined) {
    callOnMount = () => {
      ownProps.server.dispatch().then(d => d.notificationSearch({
        projectId: ownProps.server.getProjectId(),
      }));
    };
  } else if (userId && state.notifications.notificationSearch.cursor) {
    getNextNotifications = () => ownProps.server.dispatch().then(d => d.notificationSearch({
      projectId: ownProps.server.getProjectId(),
      cursor: state.notifications.notificationSearch.cursor,
    }));
  }
  const connectProps: ConnectProps = {
    callOnMount,
    userId: userId,
    notifications: state.notifications.notificationSearch.notifications,
    getNextNotifications: getNextNotifications,
  };
  return connectProps;
}, null, null, { forwardRef: true })(withStyles(styles, { withTheme: true })(withRouter(NotificationList)));
