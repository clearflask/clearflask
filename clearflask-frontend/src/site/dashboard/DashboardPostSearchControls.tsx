import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import { Component } from 'react';
import { connect } from 'react-redux';
import * as Client from '../../api/client';
import { ReduxState, Server } from '../../api/server';
import PostSearchControls from '../../common/search/PostSearchControls';

const styles = (theme: Theme) => createStyles({
});

interface Props {
  server: Server;
  search?: Partial<Client.IdeaSearch>;
  onSearchChanged: (search: Partial<Client.IdeaSearch>) => void;
}
interface ConnectProps {
  config?: Client.Config;
}
interface State {
}
class DashboardPostSearchControls extends Component<Props & ConnectProps & WithStyles<typeof styles, true>, State> {
  state: State = {};

  render() {
    return (
      <PostSearchControls
        config={this.props.config}
        explorer={{
          allowSearch: {
            enableSort: true,
            enableSearchText: true,
            enableSearchByCategory: true,
            enableSearchByStatus: true,
            enableSearchByTag: true,
          },
          display: {},
          search: {},
        }}
        search={this.props.search}
        onSearchChanged={this.props.onSearchChanged}
      />
    );
  }
}

export default connect<ConnectProps, {}, Props, ReduxState>((state, ownProps) => {
  const newProps: ConnectProps = {
    config: state.conf.conf,
  };
  return newProps;
}, null, null, { forwardRef: true })(withStyles(styles, { withTheme: true })(DashboardPostSearchControls));
