import { Button, Table, TableBody, TableCell, TableRow, Typography } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import { RouteComponentProps, withRouter } from 'react-router';
import TimeAgo from 'react-timeago';
import * as Client from '../../api/client';
import { ReduxState, Server } from '../../api/server';
import { contentScrollApplyStyles } from '../../common/ContentScroll';
import ErrorMsg from '../ErrorMsg';
import DividerCorner from '../utils/DividerCorner';

const styles = (theme: Theme) => createStyles({
  table: {
    whiteSpace: 'nowrap',
    ...(contentScrollApplyStyles(theme)),
  },
  noNotificationsLabel: {
    margin: theme.spacing(3),
    color: theme.palette.text.hint,
  },
});

interface Props {
  className?: string;
  server: Server;
}

interface ConnectProps {
  userId?: string;
  notifications?: Client.Notification[];
  getNextNotifications?: () => void;
}

class NotificationList extends Component<Props & ConnectProps & WithStyles<typeof styles, true> & RouteComponentProps> {
  render() {
    if (!this.props.userId) {
      return (<ErrorMsg msg='You need to log in to see your notifications' variant='info' />);
    }
    const hasNotifications = this.props.notifications && this.props.notifications.length > 0;
    return (
      <div className={this.props.className}>
        <DividerCorner title='Notifications' height={hasNotifications ? '100%' : undefined}>
          <div className={this.props.classes.table}>
            <Table size='small'>
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
                    onClick={() => this.clickNotification(notification)}
                  >
                    <TableCell key='date'><Typography><TimeAgo date={notification.created} /></Typography></TableCell>
                    <TableCell key='description'><Typography>{notification.description}</Typography></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DividerCorner>
        {hasNotifications && (
          <Button style={{ margin: 'auto', display: 'block' }} onClick={() => this.clearAll()}>
            Clear all
          </Button>
        )}
        {this.props.getNextNotifications && (
          <Button style={{ margin: 'auto', display: 'block' }} onClick={() => this.props.getNextNotifications && this.props.getNextNotifications()}>
            Show more
          </Button>
        )}
      </div>
    );
  }

  clickNotification(notification: Client.Notification) {
    this.props.server.dispatch().notificationClear({
      projectId: this.props.server.getProjectId(),
      notificationId: notification.notificationId,
    });
    if (notification.relatedIdeaId) {
      if (notification.relatedCommentId) {
        this.props.history.push(`/post/${notification.relatedIdeaId}/comment/${notification.relatedCommentId}`);
      } else {
        this.props.history.push(`/post/${notification.relatedIdeaId}`);
      }
    }
  }

  clearAll() {
    this.props.server.dispatch().notificationClearAll({
      projectId: this.props.server.getProjectId(),
    });
  }
}

export default connect<ConnectProps, {}, Props, ReduxState>((state, ownProps) => {
  const userId = state.users.loggedIn.user ? state.users.loggedIn.user.userId : undefined;
  var getNextNotifications;
  if (userId && state.notifications.notificationSearch.status === undefined) {
    ownProps.server.dispatch().notificationSearch({
      projectId: ownProps.server.getProjectId(),
    });
  } else if (userId && state.notifications.notificationSearch.cursor) {
    getNextNotifications = () => ownProps.server.dispatch().notificationSearch({
      projectId: ownProps.server.getProjectId(),
      cursor: state.notifications.notificationSearch.cursor,
    });
  }
  const connectProps: ConnectProps = {
    userId: userId,
    notifications: state.notifications.notificationSearch.notifications,
    getNextNotifications: getNextNotifications,
  };
  return connectProps;
}, null, null, { forwardRef: true })(withStyles(styles, { withTheme: true })(withRouter(NotificationList)));
