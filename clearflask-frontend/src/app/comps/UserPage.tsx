import { Table, TableBody, TableCell, TableRow, Typography } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import TimeAgo from 'react-timeago';
import * as Admin from "../../api/admin";
import * as Client from '../../api/client';
import { ReduxState, Server, Status } from '../../api/server';
import ModStar from '../../common/ModStar';
import UserContributions from '../../common/UserContributions';
import UserDisplay from '../../common/UserDisplay';
import { truncateWithElipsis } from '../../common/util/stringUtil';
import { setAppTitle } from '../../common/util/titleUtil';
import DividerCorner from '../utils/DividerCorner';
import Loader from '../utils/Loader';
import UserEdit from './UserEdit';

const styles = (theme: Theme) => createStyles({
  page: {
    margin: theme.spacing(1),
    display: 'flex',
    flexDirection: 'column',
  },
  pageContainer: {
    display: 'flex',
    flexWrap: 'wrap',
  },
  title: {
    margin: theme.spacing(0, 5),
  },
  userViewTable: {
    margin: theme.spacing(1),
    width: 'auto',
    maxWidth: '100%',
  },
  userViewTableCell: {
    borderBottom: 'none',
  },
  overview: {
    marginTop: theme.spacing(3),
    minWidth: 300,
    maxWidth: '100%',
    flex: '1 1 0px',
  },
  userContributions: {
    minWidth: 300,
    maxWidth: '100%',
    flex: '1 1 0px',
  },
});
interface Props {
  server: Server;
  userId: string;
}
interface ConnectProps {
  user?: Client.User;
  userStatus?: Status;
  credits?: Client.Credits;
  loggedInUser?: Client.UserMe;
  projectName?: string,
  suppressSetTitle?: boolean,
}
interface State {
  userAdmin?: Admin.UserAdmin;
  userAdminStatus?: Status;
}
class UserPage extends Component<Props & ConnectProps & WithStyles<typeof styles, true>, State> {
  state: State = {};
  userAdminFetchedForUserId?: string;

  render() {
    var user: Client.User | Admin.UserAdmin | undefined;
    var userStatus: Status | undefined;
    var overview: React.ReactNode | undefined;
    if (this.props.server.isModOrAdminLoggedIn()) {
      if (this.userAdminFetchedForUserId !== this.props.userId) {
        this.props.server.dispatchAdmin().then(d => d.userGetAdmin({
          projectId: this.props.server.getProjectId(),
          userId: this.props.userId,
        }))
          .then(userAdmin => this.setState({
            userAdmin,
            userAdminStatus: Status.FULFILLED,
          }))
          .catch(e => this.setState({
            userAdminStatus: Status.REJECTED,
          }))
        this.userAdminFetchedForUserId = this.props.userId;
      }
      user = this.state.userAdmin;
      userStatus = this.state.userAdminStatus;
      if (this.state.userAdmin) {
        overview = (
          <UserEdit
            className={this.props.classes.overview}
            server={this.props.server}
            user={this.state.userAdmin}
            credits={this.props.credits}
            isMe={this.props.loggedInUser?.userId === this.state.userAdmin.userId}
            onUpdated={userAdminUpdated => this.setState({ userAdmin: userAdminUpdated })}
          />
        );
      }
    } else {
      if (!this.props.userStatus) {
        this.props.server.dispatch().then(d => d.userGet({
          projectId: this.props.server.getProjectId(),
          userId: this.props.userId,
        }));
      }
      user = this.props.user;
      userStatus = this.props.userStatus;
      if (this.props.user) {
        overview = (
          <DividerCorner title='Info' className={this.props.classes.overview}>
            <Table className={this.props.classes.userViewTable}>
              <TableBody>
                <TableRow>
                  <TableCell className={this.props.classes.userViewTableCell}>Name</TableCell>
                  <TableCell className={this.props.classes.userViewTableCell}>
                    <ModStar name={this.props.user.name} isMod={this.props.user.isMod} />
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className={this.props.classes.userViewTableCell}>Registered</TableCell>
                  <TableCell className={this.props.classes.userViewTableCell}>
                    <TimeAgo date={this.props.user.created} />
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </DividerCorner>
        );
      }
    }

    if (this.props.projectName && !this.props.suppressSetTitle) {
      setAppTitle(this.props.projectName, user?.name ? truncateWithElipsis(25, user?.name) : 'User');
    }

    return (
      <div className={this.props.classes.page}>
        <Loader
          status={userStatus}
          error={userStatus === Status.REJECTED ? 'Person not found' : undefined}
        >
          {!!user && (
            <Typography component="h1" variant="h5" color="textPrimary" className={this.props.classes.title}>
              <UserDisplay
                user={user}
                variant='text'
                suppressTypography
              />
            </Typography>
          )}
          <div className={this.props.classes.pageContainer}>
            {overview}
            {user?.userId && (
              <div className={this.props.classes.userContributions}>
                <UserContributions
                  server={this.props.server}
                  userId={user.userId}
                />
              </div>
            )}
          </div>
        </Loader>
      </div>
    );
  }
}

export default connect<ConnectProps, {}, Props, ReduxState>((state, ownProps) => {
  return {
    credits: state.conf.conf?.users.credits,
    user: state.users.byId[ownProps.userId]?.user,
    userStatus: state.users.byId[ownProps.userId]?.status,
    loggedInUser: state.users.loggedIn.user,
    projectName: state.conf.conf?.layout.pageTitleSuffix || state.conf.conf?.name,
    suppressSetTitle: state.settings.suppressSetTitle,
  };
})(withStyles(styles, { withTheme: true })(UserPage));
