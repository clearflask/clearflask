import { Table, TableBody, TableCell, TableRow } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import TimeAgo from 'react-timeago';
import * as Admin from "../../api/admin";
import * as Client from '../../api/client';
import { ReduxState, Server, Status } from '../../api/server';
import ServerAdmin from '../../api/serverAdmin';
import ModStar from '../../common/ModStar';
import Promised from '../../common/Promised';
import UserContributions from '../../common/UserContributions';
import ErrorPage from '../ErrorPage';
import DividerCorner from '../utils/DividerCorner';
import UserEdit from './UserEdit';

const styles = (theme: Theme) => createStyles({
  page: {
    margin: theme.spacing(1),
    display: 'flex',
    flexDirection: 'column',
  },
  userViewTable: {
    margin: theme.spacing(1),
    width: 'auto',
  },
  userViewTableCell: {
    borderBottom: 'none',
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
}
class UserPage extends Component<Props & ConnectProps & WithStyles<typeof styles, true>> {
  userAdminPromise?: Promise<Admin.UserAdmin>;

  render() {
    const isModLoggedIn = this.props.server.isModLoggedIn();

    if(isModLoggedIn) {
      if (!this.userAdminPromise) {
        this.userAdminPromise = ServerAdmin.get().dispatchAdmin().then(d => d.userGetAdmin({
          projectId: this.props.server.getProjectId(),
          userId: this.props.userId,
        }));
      }
  

    } else {
      if (!this.props.userStatus) {
        this.props.server.dispatch().userGet({
          projectId: this.props.server.getProjectId(),
          userId: this.props.userId,
        });
      }
      
    }

    if (!this.props.user) {
      return (<ErrorPage msg='Person not found' variant='error' />);
    }
    // TODO set page title
    // TODO finish
    return (
      <div className={this.props.classes.page}>
        {isModLoggedIn ? this.renderUserEdit() : this.renderUserView()}
        <UserContributions
          server={this.props.server}
          userId={this.props.userId}
        />
      </div>
    );
  }

  renderUserEdit(userAdmin: Admin.UserAdmin) {
    return (
      <Promised
        promise={this.userAdminPromise}
        render={userAdmin => (
          <UserEdit
            server={this.props.server}
            user={userAdmin}
            credits={this.props.credits}
            isMe={this.props.loggedInUser?.userId === userAdmin.userId}
            onUpdated={userAdmin => this.userAdminPromise = Promise.resolve(userAdmin)}
          />
        )}
      />
    );
  }

  renderUserView(user: Client.User) {
    return (
      <DividerCorner title='User info'>
        <Table className={this.props.classes.userViewTable}>
          <TableBody>
            <TableRow>
              <TableCell className={this.props.classes.userViewTableCell}>Name</TableCell>
              <TableCell className={this.props.classes.userViewTableCell}>
                <ModStar name={user.name} isMod={user.isMod} />
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

export default connect<ConnectProps, {}, Props, ReduxState>((state, ownProps) => {
  return {
    credits: state.conf.conf?.users.credits,
    user: state.users.byId[ownProps.userId]?.user,
    userStatus: state.users.byId[ownProps.userId]?.status,
    loggedInUser: state.users.loggedIn.user,
  };
})(withStyles(styles, { withTheme: true })(UserPage));
