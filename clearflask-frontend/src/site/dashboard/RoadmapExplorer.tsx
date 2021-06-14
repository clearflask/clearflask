import { Typography } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import { Component } from 'react';
import { connect } from 'react-redux';
import * as Client from '../../api/client';
import { ReduxState, Server } from '../../api/server';
import { RoadmapInstance } from '../../common/config/template/roadmap';
import { contentScrollApplyStyles, Orientation } from '../../common/ContentScroll';
import { BoxLayoutBoxApplyStyles, BOX_MARGIN } from '../../common/Layout';
import DragndropPostList from './DragndropPostList';

const styles = (theme: Theme) => createStyles({
  container: {
    display: 'flex',
  },
  roadmap: {
    display: 'flex',
    minWidth: 0,
    ...BoxLayoutBoxApplyStyles,
  },
  dropbox: {
    marginLeft: BOX_MARGIN,
    ...BoxLayoutBoxApplyStyles,
    ...contentScrollApplyStyles({ theme, orientation: Orientation.Vertical }),
  },
  panel: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
  },
  panelTitle: {
    margin: theme.spacing(2, 4, 0),
  },
  completedClosedList: {
    flexGrow: 1,
  },
});
interface Props {
  server: Server;
  roadmap: RoadmapInstance;
  onClickPost: (postId: string) => void;
  onUserClick: (userId: string) => void;
  selectedPostId?: string;
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
      <div className={this.props.classes.container}>
        <div className={this.props.classes.roadmap}>
          {this.props.roadmap.pageAndIndex?.page.board.panels.map((panel, panelIndex) => (
            <div className={this.props.classes.panel}>
              <Typography variant='h4' className={this.props.classes.panelTitle} style={{
                color: panel.search.filterStatusIds?.length !== 1 ? undefined : this.props.roadmap.categoryAndIndex.category.workflow.statuses.find(s => s.statusId === panel.search.filterStatusIds?.[0])?.color,
              }}>
                {panel.title}
              </Typography>
              <DragndropPostList
                droppable
                scroll
                key={panelIndex}
                server={this.props.server}
                search={panel.search as any}
                onClickPost={this.props.onClickPost}
                onUserClick={this.props.onUserClick}
                selectedPostId={this.props.selectedPostId}
                displayOverride={{
                  showCategoryName: false,
                  showStatus: false,
                }}
              />
            </div>
          ))}
        </div>
        {(this.props.roadmap.statusIdClosed || this.props.roadmap.statusIdCompleted) && (
          <div className={this.props.classes.dropbox}>
            {this.props.roadmap.statusIdCompleted && (
              <>
                <Typography variant='h4' className={this.props.classes.panelTitle} style={{
                  color: this.props.roadmap.categoryAndIndex.category.workflow.statuses.find(s => s.statusId === this.props.roadmap.statusIdCompleted)?.color,
                }}>Completed</Typography>
                <DragndropPostList
                  className={this.props.classes.completedClosedList}
                  droppable
                  scroll
                  key='completed'
                  server={this.props.server}
                  search={{
                    filterCategoryIds: [this.props.roadmap.categoryAndIndex.category.categoryId],
                    filterStatusIds: [this.props.roadmap.statusIdCompleted],
                  }}
                  onClickPost={this.props.onClickPost}
                  onUserClick={this.props.onUserClick}
                  selectedPostId={this.props.selectedPostId}
                  displayOverride={{
                    showCategoryName: false,
                    showStatus: false,
                  }}
                />
              </>
            )}
            {this.props.roadmap.statusIdClosed && (
              <>
                <Typography variant='h4' className={this.props.classes.panelTitle} style={{
                  color: this.props.roadmap.categoryAndIndex.category.workflow.statuses.find(s => s.statusId === this.props.roadmap.statusIdClosed)?.color,
                }}>Closed</Typography>
                <DragndropPostList
                  className={this.props.classes.completedClosedList}
                  droppable
                  scroll
                  key='closed'
                  server={this.props.server}
                  search={{
                    filterCategoryIds: [this.props.roadmap.categoryAndIndex.category.categoryId],
                    filterStatusIds: [this.props.roadmap.statusIdClosed],
                  }}
                  onClickPost={this.props.onClickPost}
                  onUserClick={this.props.onUserClick}
                  selectedPostId={this.props.selectedPostId}
                />
              </>
            )}
          </div>
        )}
      </div>
    );
    // return (
    //   <BoardContainer
    //     server={this.props.server}
    //     board={this.props.roadmap.pageAndIndex?.page.board}
    //     panels={this.props.roadmap.pageAndIndex?.page.board.panels.map((panel, panelIndex) => (
    //       <BoardPanel server={this.props.server} panel={panel} />
    //     ))}
    //   />
    // );
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
