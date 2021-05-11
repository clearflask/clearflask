import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import { Component } from 'react';
import { connect } from 'react-redux';
import * as Client from '../../api/client';
import { ReduxState, Server } from '../../api/server';
import PanelPost, { Direction } from '../../app/comps/PanelPost';

const styles = (theme: Theme) => createStyles({
});

interface Props {
  server: Server;
  search?: Partial<Client.IdeaSearch>;
  onClickPost: (postId: string) => void;
  onUserClick: (userId: string) => void;
}
interface ConnectProps {
  configver?: string;
  config?: Client.Config;
  loggedInUserId?: string;
}
class PostList extends Component<Props & ConnectProps & WithStyles<typeof styles, true>> {

  render() {
    return (
      <PanelPost
        direction={Direction.Vertical}
        panel={{
          display: {},
          search: {},
          hideIfEmpty: false,
        }}
        searchOverride={this.props.search}
        server={this.props.server}
        // displayDefaults={displayDefaults}
        onClickPost={this.props.onClickPost}
        onUserClick={this.props.onUserClick}
      />
    );
  }
}

export default connect<ConnectProps, {}, Props, ReduxState>((state, ownProps) => {
  const newProps: ConnectProps = {
    configver: state.conf.ver, // force rerender on config change
    config: state.conf.conf,
    loggedInUserId: state.users.loggedIn.user ? state.users.loggedIn.user.userId : undefined,
  };
  return newProps;
}, null, null, { forwardRef: true })(withStyles(styles, { withTheme: true })(PostList));
