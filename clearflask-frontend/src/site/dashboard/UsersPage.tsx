import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import { Server } from '../../api/server';
import UserExplorer from './UserExplorer';

const styles = (theme: Theme) => createStyles({
  page: {
    maxWidth: 1024,
  },
});

interface Props {
  server: Server;
  isDashboard?: boolean;
  onUserClick: (userId: string) => void;
}
class UsersPage extends Component<Props & WithStyles<typeof styles, true>> {
  render() {
    return (
      <div className={this.props.classes.page}>
        <UserExplorer
          server={this.props.server}
          isDashboard={this.props.isDashboard}
          showCreate
          showFilter
          onUserClick={this.props.onUserClick}
        />
      </div>
    );
  }
}

export default withStyles(styles, { withTheme: true })(UsersPage);
