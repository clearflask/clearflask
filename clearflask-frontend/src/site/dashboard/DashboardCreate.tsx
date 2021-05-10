import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import { Component } from 'react';
import { connect } from 'react-redux';
import * as Client from '../../api/client';
import { ReduxState, Server } from '../../api/server';

const styles = (theme: Theme) => createStyles({
});

interface Props {
  server: Server;
}
interface ConnectProps {
  configver?: string;
  config?: Client.Config;
  loggedInUserId?: string;
}
interface State {
}
class DashboardCreate extends Component<Props & ConnectProps & WithStyles<typeof styles, true>, State> {
  state: State = {};

  render() {
    return 'create';
  }
}

export default connect<ConnectProps, {}, Props, ReduxState>((state, ownProps) => {
  const newProps: ConnectProps = {
    configver: state.conf.ver, // force rerender on config change
    config: state.conf.conf,
    loggedInUserId: state.users.loggedIn.user ? state.users.loggedIn.user.userId : undefined,
  };
  return newProps;
}, null, null, { forwardRef: true })(withStyles(styles, { withTheme: true })(DashboardCreate));
