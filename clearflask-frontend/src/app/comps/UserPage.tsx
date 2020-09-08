import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import { ReduxState, Server } from '../../api/server';
import UserContributions from '../../common/UserContributions';
import ModStar from '../../common/ModStar';
import ErrorPage from '../ErrorPage';
import * as Client from '../../api/client';
import UserEdit from './UserEdit';
import { Table, TableHead, TableRow, TableBody, TableCell } from '@material-ui/core';
import TimeAgo from 'react-timeago';
import DividerCorner from '../utils/DividerCorner';

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
}
class UserPage extends Component<Props & ConnectProps & WithStyles<typeof styles, true>> {
  render() {
    if (!this.props.user) {
      return (<ErrorPage msg='Person not found' variant='error' />);
    }
    // TODO set page title
    // TODO finish
    return (
      <div className={this.props.classes.page}>
        {this.props.server.isModLoggedIn() ? this.renderUserEdit() : this.renderUserView()}
        <UserContributions
          server={this.props.server}
          userId={this.props.userId}
        />
      </div>
    );
  }

  renderUserEdit() {
    return (
      <UserEdit
        server={this.props.server}
        user={this.props.user}
      />
    );
  }

  renderUserView() {
    return (
      <DividerCorner title='User info'>
        <Table className={this.props.classes.userViewTable}>
          <TableBody>
            <TableRow>
              <TableCell className={this.props.classes.userViewTableCell}>Name</TableCell>
              <TableCell className={this.props.classes.userViewTableCell}>
                <ModStar name={this.props.user?.name} isMod={this.props.user?.isMod} />
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell className={this.props.classes.userViewTableCell}>Registered</TableCell>
              <TableCell className={this.props.classes.userViewTableCell}>
                {this.props.user?.created ? (
                  <TimeAgo date={this.props.user.created} />
                ) : null}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </DividerCorner>
    );
  }
}

export default connect<ConnectProps, {}, Props, ReduxState>((state, ownProps) => {
  if(ownProps.server.isModLoggedIn()) {

  }
  return {
    user: state.users.byId[ownProps.userId]?.user,
  };
})(withStyles(styles, { withTheme: true })(UserPage));
