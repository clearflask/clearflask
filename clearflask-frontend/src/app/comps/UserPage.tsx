import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import { ReduxState, Server } from '../../api/server';
import UserContributions from '../../common/UserContributions';
import ErrorPage from '../ErrorPage';
import * as Client from './client';
import UserEdit from './UserEdit';

const styles = (theme: Theme) => createStyles({
  page: {
    margin: theme.spacing(1),
    display: 'flex',
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
        TODO
      />
    );
  }

  renderUserView() {
    TODO
  }
}

export default connect<ConnectProps, {}, Props, ReduxState>((state, ownProps) => {

  return {
    user: 
  };
})(withStyles(styles, { withTheme: true })(UserPage));
