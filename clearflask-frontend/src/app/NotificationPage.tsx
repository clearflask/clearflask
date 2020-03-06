import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import { ReduxState, Server } from '../api/server';
import NotificationList from './comps/NotificationList';
import ErrorPage from './ErrorPage';

const styles = (theme: Theme) => createStyles({
  page: {
    margin: theme.spacing(1),
  },
  spacing: {
    margin: theme.spacing(2),
  },
});

interface Props {
  server: Server;
}

interface ConnectProps {
  isLoggedIn: boolean;
}

class NotificationPage extends Component<Props & ConnectProps & WithStyles<typeof styles, true>> {

  render() {
    if (!this.props.isLoggedIn) {
      return (<ErrorPage msg='You need to log in to see your balance' variant='info' />);
    }
    return (
      <div className={this.props.classes.page}>
        <NotificationList server={this.props.server} />
      </div>
    );
  }
}

export default connect<ConnectProps, {}, Props, ReduxState>((state, ownProps) => {
  const userId = state.users.loggedIn.user ? state.users.loggedIn.user.userId : undefined;
  const connectProps: ConnectProps = {
    isLoggedIn: !!userId,
  };
  return connectProps;
}, null, null, { forwardRef: true })(withStyles(styles, { withTheme: true })(NotificationPage));
