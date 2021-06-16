import { Collapse, Typography } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import classNames from 'classnames';
import { Component } from 'react';
import { connect } from 'react-redux';
import * as Client from '../../api/client';
import { getSearchKey, ReduxState, Server } from '../../api/server';
import { RoadmapInstance } from '../../common/config/template/roadmap';
import { contentScrollApplyStyles, Orientation } from '../../common/ContentScroll';
import ExpandIcon from '../../common/icon/ExpandIcon';
import { BoxLayoutBoxApplyStyles, BOX_MARGIN } from '../../common/Layout';
import { droppableDataSerialize } from './dashboardDndActionHandler';
import DragndropPostList from './DragndropPostList';

const styles = (theme: Theme) => createStyles({
  container: {
    height: '100%',
    display: 'flex',
  },
  roadmap: {
    height: '100%',
    display: 'flex',
    minWidth: 0,
  },
  roadmapNoBoxLayout: {
    borderLeft: '1px solid ' + theme.palette.grey[300],
    borderRight: '1px solid ' + theme.palette.grey[300],
  },
  actionColumn: {
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  actionColumnBoxLayout: {
    marginLeft: BOX_MARGIN,
    '& > $dropbox': {
      ...BoxLayoutBoxApplyStyles,
    },
    '& > *:not(:first-child)': {
      marginTop: BOX_MARGIN,
    },
  },
  actionColumnBoxLayoutNot: {
    '& > *:not(:first-child)': {
      borderTop: '1px solid ' + theme.palette.grey[300],
    },
  },
  dropbox: {
    ...contentScrollApplyStyles({ theme, orientation: Orientation.Vertical }),
  },
  boxLayout: {
    ...BoxLayoutBoxApplyStyles,
  },
  panel: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    minWidth: 0,
    ...contentScrollApplyStyles({ theme, orientation: Orientation.Vertical }),
  },
  panelTitle: {
    margin: theme.spacing(2, 4),
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropboxList: {
    flexGrow: 1,
  },
});
interface Props {
  server: Server;
  roadmap: RoadmapInstance;
  onClickPost: (postId: string) => void;
  onUserClick: (userId: string) => void;
  selectedPostId?: string;
  isBoxLayout?: boolean;
}
interface ConnectProps {
  configver?: string;
  config?: Client.Config;
  loggedInUserId?: string;
}
interface State {
  expandedDropbox?: string;
}
class RoadmapExplorer extends Component<Props & ConnectProps & WithStyles<typeof styles, true>, State> {
  state: State = {};

  render() {
    const actionColumnCount = (this.props.roadmap.statusIdClosed ? 1 : 0) + (this.props.roadmap.statusIdCompleted ? 1 : 0);
    return (
      <div className={this.props.classes.container}>
        <div className={classNames(
          this.props.classes.roadmap,
          this.props.isBoxLayout ? this.props.classes.boxLayout : this.props.classes.roadmapNoBoxLayout,
        )}>
          {this.props.roadmap.pageAndIndex?.page.board.panels.map((panel, panelIndex) => {
            // If roadmap is configured correctly (Not through advanced settings),
            // then each panel should be filtering a single status so a transition
            // between panels can simply change the status of the Task. 
            const onlyStatus = panel.search.filterStatusIds?.length !== 1 ? undefined : this.props.roadmap.categoryAndIndex.category.workflow.statuses.find(s => s.statusId === panel.search.filterStatusIds?.[0]);
            return (
              <div className={this.props.classes.panel}>
                <Typography variant='h4' className={this.props.classes.panelTitle} style={{ color: onlyStatus?.color }}>
                  {panel.title || onlyStatus?.name}
                </Typography>
                <DragndropPostList
                  droppable={!!onlyStatus}
                  droppableId={droppableDataSerialize({
                    type: 'roadmap-panel',
                    searchKey: getSearchKey(panel.search),
                    statusId: onlyStatus?.statusId,
                  })}
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
            );
          })}
        </div>
        {actionColumnCount && (
          <div className={classNames(
            this.props.classes.actionColumn,
            this.props.isBoxLayout ? this.props.classes.actionColumnBoxLayout : this.props.classes.actionColumnBoxLayoutNot,
          )}>
            {this.props.roadmap.statusIdCompleted
              && this.renderDropbox(this.props.roadmap.statusIdCompleted, actionColumnCount > 1)}
            {this.props.roadmap.statusIdClosed
              && this.renderDropbox(this.props.roadmap.statusIdClosed, actionColumnCount > 1)}
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

  renderDropbox(statusId: string, showExpand: boolean) {
    const status = this.props.roadmap.categoryAndIndex.category.workflow.statuses.find(s => s.statusId === statusId);
    if (!status) return null;
    const search = {
      filterCategoryIds: [this.props.roadmap.categoryAndIndex.category.categoryId],
      filterStatusIds: [statusId],
    };
    return (
      <Collapse in={!this.state.expandedDropbox || this.state.expandedDropbox === statusId}
        className={this.props.classes.dropbox} style={{
          marginTop: this.state.expandedDropbox ? 0 : undefined,
        }}>
        <Typography variant='h4' className={this.props.classes.panelTitle} style={{
          color: status.color,
        }}>
          {status.name}
          {showExpand && (
            <ExpandIcon expanded={this.state.expandedDropbox === statusId} onExpandChanged={exp => this.setState({ expandedDropbox: exp ? statusId : undefined })} />
          )}
        </Typography>
        <DragndropPostList
          className={this.props.classes.dropboxList}
          droppable
          droppableId={droppableDataSerialize({
            type: 'roadmap-panel',
            searchKey: getSearchKey(search),
            statusId,
          })}
          key={statusId}
          server={this.props.server}
          search={search}
          onClickPost={this.props.onClickPost}
          onUserClick={this.props.onUserClick}
          selectedPostId={this.props.selectedPostId}
          displayOverride={{
            showCategoryName: false,
            showStatus: false,
          }}
        />
      </Collapse>
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
