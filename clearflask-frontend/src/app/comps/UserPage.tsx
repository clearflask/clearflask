import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import { Component } from 'react';
import { connect } from 'react-redux';
import { ReduxState, Server } from '../../api/server';

const styles = (theme: Theme) => createStyles({
});
interface Props {
  server: Server;
  userId: string;
}
interface ConnectProps {
}
class UserPage extends Component<Props & ConnectProps & WithStyles<typeof styles, true>> {
  render() {
    // TODO set page title
    // TODO finish
    return null;
  }
}

export default connect<ConnectProps, {}, Props, ReduxState>((state, ownProps) => {
  return {
  };
})(withStyles(styles, { withTheme: true })(UserPage));
