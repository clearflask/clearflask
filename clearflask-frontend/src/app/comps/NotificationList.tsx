import React, { Component } from 'react';
import Message from './Message';
import { connect } from 'react-redux';
import { ReduxState, Server, Status, getTransactionSearchKey } from '../../api/server';
import * as Client from '../../api/client';
import { withStyles, Theme, createStyles, WithStyles } from '@material-ui/core/styles';
import { withRouter, RouteComponentProps } from 'react-router';
import ErrorPage from '../ErrorPage';
import { Table, TableBody, TableRow, TableCell, TableHead, Button, Typography, CardActionArea } from '@material-ui/core';
import CreditView from '../../common/config/CreditView';
import TimeAgo from 'react-timeago'
import { contentScrollApplyStyles } from '../../common/ContentScroll';
import DividerCorner from '../utils/DividerCorner';

const styles = (theme:Theme) => createStyles({
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
  className?:string;
  server:Server;
}

interface ConnectProps {
  userId?:string;
  notifications?:Client.Notification[];
  getNextNotifications?:()=>void;
}

class NotificationList extends Component<Props&ConnectProps&WithStyles<typeof styles, true>&RouteComponentProps> {
  render() {
    if(!this.props.userId) {
      return (<ErrorPage msg='You need to log in to see your notifications' variant='info' />);
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
                    <TableCell key='title'><Typography>{notification.title}</Typography></TableCell>
                    <TableCell key='description'><Typography>{notification.description}</Typography></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DividerCorner>
        {hasNotifications && (
          <Button style={{margin: 'auto', display: 'block'}} onClick={() => this.clearAll()}>
            Clear all
          </Button>
        )}
        {this.props.getNextNotifications && (
          <Button style={{margin: 'auto', display: 'block'}} onClick={() => this.props.getNextNotifications && this.props.getNextNotifications()}>
            Show more
          </Button>
        )}
      </div>
    );
  }

  clickNotification(notification:Client.Notification) {
    this.props.server.dispatch().notificationClear({
      projectId: this.props.server.getProjectId(),
      notificationClear: { userId: this.props.userId! },
      notificationId: notification.notificationId,
    });
    this.props.history.push(notification.url);
  }

  clearAll() {
    this.props.server.dispatch().notificationClearAll({
      projectId: this.props.server.getProjectId(),
      userId: this.props.userId!,
    });
  }
}

export default connect<ConnectProps,{},Props,ReduxState>((state, ownProps) => {
  const userId = state.users.loggedIn.user ? state.users.loggedIn.user.userId : undefined;
  var getNextNotifications;
  if(userId && state.notifications.notificationSearch.status === undefined) {
    ownProps.server.dispatch().notificationSearch({
      projectId: ownProps.server.getProjectId(),
      userId: userId,
    });
  } else if(userId && state.notifications.notificationSearch.cursor) {
    getNextNotifications = () => ownProps.server.dispatch().notificationSearch({
      projectId: ownProps.server.getProjectId(),
      userId: userId,
      cursor: state.notifications.notificationSearch.cursor,
    });
  }
  const connectProps:ConnectProps = {
    userId: userId,
    notifications: state.notifications.notificationSearch.notifications,
    getNextNotifications: getNextNotifications,
  };
  return connectProps;
}, null, null, { forwardRef: true })(withStyles(styles, { withTheme: true })(withRouter(NotificationList)));
