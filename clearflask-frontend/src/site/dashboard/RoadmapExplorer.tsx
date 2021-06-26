import { Button, Link as MuiLink, Typography } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import VisibilityIcon from '@material-ui/icons/Visibility';
import classNames from 'classnames';
import { Component } from 'react';
import { connect } from 'react-redux';
import * as Client from '../../api/client';
import { getSearchKey, ReduxState, Server } from '../../api/server';
import { ChangelogInstance } from '../../common/config/template/changelog';
import { RoadmapInstance } from '../../common/config/template/roadmap';
import { contentScrollApplyStyles, Orientation } from '../../common/ContentScroll';
import HelpPopper from '../../common/HelpPopper';
import ExpandIcon from '../../common/icon/ExpandIcon';
import { BoxLayoutBoxApplyStyles, BOX_MARGIN } from '../../common/Layout';
import { notEmpty } from '../../common/util/arrayUtil';
import { getProjectLink } from '../Dashboard';
import { droppableDataSerialize } from './dashboardDndActionHandler';
import DragndropPostList from './DragndropPostList';
import PostList from './PostList';

const styles = (theme: Theme) => createStyles({
  container: {
    height: '100%',
    display: 'flex',
  },
  roadmapContainer: {
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  roadmap: {
    height: '100%',
    display: 'flex',
    minWidth: 0,
  },
  roadmapContainerNoBoxLayout: {
    borderLeft: '1px solid ' + theme.palette.grey[300],
    borderRight: '1px solid ' + theme.palette.grey[300],
    '& > *:last-child': {
      borderTop: '1px solid ' + theme.palette.grey[300],
    },
  },
  actionColumn: {
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  actionColumnBoxLayoutLeft: {
    marginRight: BOX_MARGIN,
  },
  actionColumnBoxLayoutRight: {
    marginLeft: BOX_MARGIN,
  },
  actionColumnBoxLayout: {
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
    flex: '1 1 100%',
    ...contentScrollApplyStyles({ theme, orientation: Orientation.Vertical }),
  },
  dropboxExpandable: {
    transition: theme.transitions.create(['flex-basis', 'margin-top']),
  },
  dropboxExpanded: {
    marginTop: '0px !important',
  },
  dropboxHidden: {
    marginTop: '0px !important',
    flexBasis: '0px',
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
  title: {
    margin: theme.spacing(2, 4),
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  roadmapTitleBoxLayout: {
    margin: theme.spacing(-1, 8, 2),
  },
  dropboxList: {
    flexGrow: 1,
  },
});
interface Props {
  className?: string;
  server: Server;
  roadmap: RoadmapInstance;
  changelog?: ChangelogInstance;
  onClickPost: (postId: string) => void;
  onUserClick: (userId: string) => void;
  selectedPostId?: string;
  isBoxLayout?: boolean;
  publicViewOnly?: boolean;
}
interface ConnectProps {
  configver?: string;
  config?: Client.Config;
  loggedInUserId?: string;
}
interface State {
  expandedDropboxRight?: string;
}
class RoadmapExplorer extends Component<Props & ConnectProps & WithStyles<typeof styles, true>, State> {
  state: State = {};

  render() {
    var roadmapLink: string | undefined;
    if (!this.props.publicViewOnly) {
      const conf = this.props.server.getStore().getState().conf.conf;
      const projectLink = !!conf && getProjectLink(conf);
      roadmapLink = !projectLink ? undefined : `${projectLink}/${this.props.roadmap.pageAndIndex?.page.slug}`;
    }

    var statusIdBacklog = this.props.roadmap.statusIdBacklog;
    var statusIdClosed = this.props.roadmap.statusIdClosed;
    var statusIdCompleted = this.props.roadmap.statusIdCompleted;
    const coveredStatusIds = new Set<string>([statusIdBacklog, statusIdClosed, statusIdCompleted].filter(notEmpty));
    const boardPanels = this.props.roadmap.pageAndIndex?.page.board.panels.map((panel, panelIndex) => {
      // If roadmap is configured correctly (Not through advanced settings),
      // then each panel should be filtering a single status so a transition
      // between panels can simply change the status of the Task. 
      const isTaskCategory = panel.search.filterCategoryIds?.length === 1 && panel.search.filterCategoryIds[0] === this.props.roadmap.categoryAndIndex.category.categoryId;
      const onlyStatus = !isTaskCategory || panel.search.filterStatusIds?.length !== 1 ? undefined : this.props.roadmap.categoryAndIndex.category.workflow.statuses.find(s => s.statusId === panel.search.filterStatusIds?.[0]);

      // If a status is already present in the public roadmap, don't show it again
      if (onlyStatus) {
        if (onlyStatus.statusId === statusIdBacklog) statusIdBacklog = undefined;
        if (onlyStatus.statusId === statusIdClosed) statusIdClosed = undefined;
        if (onlyStatus.statusId === statusIdCompleted) statusIdCompleted = undefined;
      }

      if (isTaskCategory) panel.search.filterStatusIds?.forEach(statusId => coveredStatusIds.add(statusId));

      const PostListProps: React.ComponentProps<typeof PostList> = {
        server: this.props.server,
        search: panel.search as any,
        onClickPost: this.props.onClickPost,
        onUserClick: this.props.onUserClick,
        selectedPostId: this.props.selectedPostId,
        displayOverride: {
          showCategoryName: false,
          showStatus: false,
        },
      };
      var list;
      if (this.props.publicViewOnly || !isTaskCategory) {
        list = (
          <PostList
            key={panelIndex}
            {...PostListProps}
          />
        );
      } else {
        list = (
          <DragndropPostList
            key={panelIndex}
            droppable={!!onlyStatus}
            droppableId={droppableDataSerialize({
              type: 'roadmap-panel',
              searchKey: getSearchKey(panel.search),
              statusId: onlyStatus?.statusId,
            })}
            {...PostListProps}
          />
        );
      }

      return (
        <div className={this.props.classes.panel}>
          <Typography variant='h4' className={this.props.classes.title} style={{ color: onlyStatus?.color }}>
            {panel.title || onlyStatus?.name}
          </Typography>
          {list}
        </div>
      );
    });
    const rightActionColumnCount = (statusIdClosed ? 1 : 0) + (statusIdCompleted ? 1 : 0);

    const extraDropboxes = this.props.roadmap.categoryAndIndex.category.workflow.statuses
      .filter(status => !coveredStatusIds.has(status.statusId))
      .map((status, index, arr) => this.renderActionColumn(
        (!boardPanels?.length && arr.length === (index + 1)) ? 'main' : 'left',
        [this.renderDropboxForStatus(status.statusId)],
      ));

    return (
      <div className={classNames(
        this.props.classes.container,
        this.props.className,
      )}>
        {!this.props.publicViewOnly && statusIdBacklog && this.renderActionColumn('left', [
          this.renderDropboxForStatus(statusIdBacklog),
        ])}
        {extraDropboxes}
        {boardPanels?.length && (
          <div className={classNames(
            this.props.classes.roadmapContainer,
            !this.props.isBoxLayout && this.props.classes.roadmapContainerNoBoxLayout,
          )}>
            <Typography variant='h4' className={classNames(
              this.props.classes.title,
              this.props.isBoxLayout && this.props.classes.roadmapTitleBoxLayout,
            )}>
              <span>
                {this.props.roadmap.pageAndIndex?.page.board.title || 'Roadmap'}
                {!this.props.publicViewOnly && (
                  <>
                    &nbsp;
                  <HelpPopper description={
                      'View your public roadmap. Drag and drop tasks between columns to prioritize your roadmap.'
                      + (this.props.changelog?.pageAndIndex ? ' Completed tasks can be added to a Changelog entry on the next page.' : '')
                    } />
                  </>
                )}
              </span>
              {roadmapLink && (
                <Button
                  component={MuiLink}
                  href={roadmapLink}
                  target='_blank'
                  underline='none'
                  rel='noopener nofollow'
                >
                  Public view
                  &nbsp;
                  <VisibilityIcon fontSize='inherit' />
                </Button>
              )}
            </Typography>
            <div className={classNames(
              this.props.classes.roadmap,
              this.props.isBoxLayout && this.props.classes.boxLayout,
            )}>
              {boardPanels}
            </div>
          </div>
        )}
        {!this.props.publicViewOnly && rightActionColumnCount && this.renderActionColumn('right', [
          statusIdCompleted && this.renderDropboxForStatus(statusIdCompleted, rightActionColumnCount > 1 ? 'expandedDropboxRight' : undefined),
          statusIdClosed && this.renderDropboxForStatus(statusIdClosed, rightActionColumnCount > 1 ? 'expandedDropboxRight' : undefined),
        ])}
      </div>
    );
  }

  renderActionColumn(position: 'left' | 'right' | 'main', children?: React.ReactNode) {
    return (
      <div className={classNames(
        this.props.classes.actionColumn,
        this.props.isBoxLayout ? this.props.classes.actionColumnBoxLayout : this.props.classes.actionColumnBoxLayoutNot,
        this.props.isBoxLayout && position === 'left' && this.props.classes.actionColumnBoxLayoutLeft,
        this.props.isBoxLayout && position === 'right' && this.props.classes.actionColumnBoxLayoutRight,
      )}>
        {children}
      </div>
    );
  }

  renderDropboxForChangelog(changelog: ChangelogInstance, expandableStateKey?: string) {
    // TODO, just remember that:
    // - Add an action container for creating new draft entry
    // - Show Draft entries, on drop, add as linked entry
    // - Show published entries, on drop, add as linked entry
    // Caveats:
    // - Drafts must support adding linkedPostIds in IdeaCreateAdmin
    // - When you drop into the changelog list, the status changes to Completed and will show up
    //   in the Completed dropbox. It's the logical thing, but it looks weird. Figure it out.
    // - Also, the Completed search column must be also updated when dropped into changelog.
    //
    // const search = {
    //   filterCategoryIds: [changelog.categoryAndIndex.category.categoryId],
    // };
    // return this.renderDropbox('changelog', (
    //   <>
    //     <DragndropPostList
    //       className={this.props.classes.dropboxList}
    //       droppable
    //       droppableId={droppableDataSerialize({
    //         type: 'changelog-panel',
    //         searchKey: getSearchKey(search),
    //       })}
    //       key={statusId}
    //       server={this.props.server}
    //       search={search}
    //       onClickPost={this.props.onClickPost}
    //       onUserClick={this.props.onUserClick}
    //       selectedPostId={this.props.selectedPostId}
    //       displayOverride={{
    //         showCategoryName: false,
    //         showStatus: false,
    //       }}
    //     />
    //   </>
    // ), 'Changelog', undefined, expandableStateKey);
  }

  renderDropboxForStatus(statusId: string, expandableStateKey?: string) {
    const status = this.props.roadmap.categoryAndIndex.category.workflow.statuses.find(s => s.statusId === statusId);
    if (!status) return null;
    const search = {
      filterCategoryIds: [this.props.roadmap.categoryAndIndex.category.categoryId],
      filterStatusIds: [statusId],
    };
    const PostListProps: React.ComponentProps<typeof PostList> = {
      className: this.props.classes.dropboxList,
      server: this.props.server,
      search: search,
      onClickPost: this.props.onClickPost,
      onUserClick: this.props.onUserClick,
      selectedPostId: this.props.selectedPostId,
      displayOverride: {
        showCategoryName: false,
        showStatus: false,
      },
    };
    var content;
    if (this.props.publicViewOnly) {
      content = (
        <PostList
          key={statusId}
          {...PostListProps}
        />
      );
    } else {
      content = (
        <DragndropPostList
          key={statusId}
          droppable
          droppableId={droppableDataSerialize({
            type: 'roadmap-panel',
            searchKey: getSearchKey(search),
            statusId,
          })}
          {...PostListProps}
        />
      );
    }
    return this.renderDropbox(statusId, content, status.name, status.color, expandableStateKey);
  }

  renderDropbox(key: string, children: React.ReactNode, name: string, color?: string, expandableStateKey?: string) {
    return (
      <div
        key={key}
        className={classNames(
          this.props.classes.dropbox,
          expandableStateKey && this.props.classes.dropboxExpandable,
          expandableStateKey && this.state[expandableStateKey] && (this.state[expandableStateKey] === key
            ? this.props.classes.dropboxExpanded
            : this.props.classes.dropboxHidden)
        )}
      >
        <Typography variant='h4' className={this.props.classes.title} style={{
          color: color,
        }}>
          {name}
          {expandableStateKey && (
            <ExpandIcon expanded={this.state[expandableStateKey] === key} onExpandChanged={exp => this.setState({ [expandableStateKey]: exp ? key : undefined })} />
          )}
        </Typography>
        {children}
      </div>
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
