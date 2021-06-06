import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import { Component } from 'react';
import { connect } from 'react-redux';
import * as Client from '../../api/client';
import { ReduxState, Server } from '../../api/server';
import { BoardContainer, BoardPanel } from '../../app/CustomPage';
import { RoadmapInstance } from '../../common/config/template/roadmap';

const styles = (theme: Theme) => createStyles({
});

interface Props {
  server: Server;
  roadmap: RoadmapInstance;
}
interface ConnectProps {
  configver?: string;
  config?: Client.Config;
  loggedInUserId?: string;
}
interface State {
}
class RoadmapExplorer extends Component<Props & ConnectProps & WithStyles<typeof styles, true>, State> {
  state: State = {};

  render() {
    return (
      <BoardContainer
        server={this.props.server}
        board={this.props.roadmap.pageAndIndex.page.board}
        panels={this.props.roadmap.pageAndIndex.page.board.panels.map((panel, panelIndex) => (
          <BoardPanel server={this.props.server} panel={panel} />
        ))}
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
}, null, null, { forwardRef: true })(withStyles(styles, { withTheme: true })(RoadmapExplorer));
