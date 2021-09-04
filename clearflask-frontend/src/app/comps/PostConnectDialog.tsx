// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
import { Button, Dialog, DialogActions, DialogTitle, Divider, IconButton, isWidthDown, withWidth, WithWidthProps } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import ChangeIcon from '@material-ui/icons/AutorenewRounded';
import MergeIcon from '@material-ui/icons/MergeType';
import SwapVertIcon from '@material-ui/icons/SwapVertRounded';
import classNames from 'classnames';
import React, { Component } from 'react';
import * as Admin from '../../api/admin';
import * as Client from '../../api/client';
import { Server } from '../../api/server';
import { contentScrollApplyStyles, Orientation } from '../../common/ContentScroll';
import HelpPopper from '../../common/HelpPopper';
import LinkAltIcon from '../../common/icon/LinkAltIcon';
import SubmitButton from '../../common/SubmitButton';
import { initialWidth } from '../../common/util/screenUtil';
import DashboardPostFilterControls from '../../site/dashboard/DashboardPostFilterControls';
import DashboardSearchControls from '../../site/dashboard/DashboardSearchControls';
import PostList from '../../site/dashboard/PostList';
import DividerVertical from '../utils/DividerVertical';
import { OutlinePostContent } from './ConnectedPost';
import Post from './Post';

const display: Admin.PostDisplay = {
  titleTruncateLines: 1,
  descriptionTruncateLines: 2,
  responseTruncateLines: 0,
  showCommentCount: true,
  showCreated: false,
  showAuthor: false,
  showStatus: true,
  showTags: true,
  showVoting: false,
  showVotingCount: true,
  showFunding: false,
  showExpression: true,
  showEdit: false,
};

const styles = (theme: Theme) => createStyles({
  dialogPaper: {
    height: '100%',
  },
  content: {
    minHeight: 0,
    height: '100%',
    display: 'flex',
    flexDirection: 'row',
  },
  contentMobile: {
    flexDirection: 'column-reverse',
  },
  headerArea: {
    gridArea: 'header',
  },
  controlsArea: {
    gridArea: 'controls',
  },
  visualAndSearchDivider: {
    alignSelf: 'stretch',
    height: 'inherit'
  },
  visualArea: {
    display: 'flex',
    flexDirection: 'column',
    flexGrow: 1,
  },
  filtersExternal: {
    ...contentScrollApplyStyles({ theme, orientation: Orientation.Vertical, backgroundColor: theme.palette.background.paper }),
  },
  searchResultMobile: {
    maxWidth: '100%',
  },
  searchResultScroll: {
    width: 350,
    ...contentScrollApplyStyles({ theme, orientation: Orientation.Vertical, backgroundColor: theme.palette.background.paper }),
  },
  searchAreaOnlyLinkContainer: {
    minHeight: 0,
    flex: '1 1 0px',
  },
  searchArea: {
    display: 'flex',
    alignItems: 'stretch',
  },
  previewOutline: {
    margin: 0,
  },
  preview: {
    maxWidth: 350,
    margin: theme.spacing(0, 4),
    flex: '1 1 0px',
    display: 'flex',
    flexDirection: 'column',
  },
  link: {
    display: 'flex',
    alignItems: 'center',
  },
  action: {
    margin: theme.spacing(1, 0),
    padding: theme.spacing(1, 2),
    borderRadius: 20,
    transition: theme.transitions.create(['opacity']),
    fontSize: '1.2em',
    whiteSpace: 'nowrap',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    width: 'unset',
  },
  actionArea: {
    alignSelf: 'center',
    flexGrow: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'center',
    '& > *:first-child': {
      justifyContent: 'flex-end',
    },
    '& > *:last-child': {
      justifyContent: 'flex-start',
    },
  },
  actionSelectedContainer: {
    minWidth: 210,
    borderLeft: `1px solid ${theme.palette.divider}`,
  },
  actionSelected: {
    color: theme.palette.text.primary,
    fontSize: '2em',
    margin: theme.spacing(4, 2),
  },
  actionNotSelected: {
    color: theme.palette.text.disabled,
  },
  or: {
    opacity: 0.5,
    margin: theme.spacing(1),
  },
  mergeIcon: {
    transform: 'rotate(90deg)',
  },
  evenItem: {
    flex: '1 1 0px',
  },
  actionSwapDirection: {
    fontSize: '3em',
    margin: theme.spacing(1),
  },
  actionSwapType: {
    fontSize: '2em',
  },
  center: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    flex: '1 1 0px',
  },
  searchBar: {
    flex: '1 1 auto',
  },
  nothing: {
    margin: theme.spacing(2),
    color: theme.palette.text.secondary,
  },
  onlyLinkContainer: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  },
});
type Props = {
  server: Server;
  open: boolean;
  onClose: () => void;
  onlyAllowLinkFrom?: boolean;
  defaultSearch?: Admin.IdeaSearchAdmin;
} & ({
  post: Client.Idea,
  onSubmit?: never,
} | {
  post?: Client.Idea,
  onSubmit: (
    selectedPostId: string,
    action: State['action'],
    directionReversed: boolean,
  ) => void;
})
interface State {
  action: 'link' | 'merge';
  directionReversed: boolean;
  selectedPostId?: string;
  search?: Admin.IdeaSearchAdmin;
  isSubmitting?: boolean;
}
class PostConnectDialog extends Component<Props & WithWidthProps & WithStyles<typeof styles, true>, State> {

  constructor(props) {
    super(props);

    this.state = {
      action: 'link',
      directionReversed: !!this.props.onlyAllowLinkFrom,
      search: this.props.defaultSearch,
    };
  }

  render() {
    const isMobile = !!this.props.width && isWidthDown('sm', this.props.width);

    const searchArea = this.renderSearchArea(isMobile);
    const header = this.renderHeader();
    const controls = this.renderControls();

    var dialogContent;
    if (!this.props.onlyAllowLinkFrom) {
      dialogContent = (
        <>
          {isMobile && (
            <Divider />
          )}
          {searchArea}
          {!isMobile && (
            <DividerVertical className={this.props.classes.visualAndSearchDivider} />
          )}
          <div className={this.props.classes.visualArea}>
            {header}
            {this.renderActionArea(isMobile)}
            {controls}
          </div>
        </>
      );
    } else {
      dialogContent = (
        <div className={this.props.classes.onlyLinkContainer}>
          {header}
          <Divider />
          {searchArea}
          <Divider />
          {controls}
        </div>
      );
    }

    return (
      <Dialog
        open={this.props.open}
        fullWidth={!this.props.onlyAllowLinkFrom}
        fullScreen={isMobile && !this.props.onlyAllowLinkFrom}
        scroll={isMobile ? 'paper' : undefined}
        maxWidth={isMobile ? 'xs' : 'md'}
        onClose={() => this.props.onClose()}
        classes={{
          scrollPaper: this.props.classes.dialogPaper,
          paper: classNames(
            this.props.classes.content,
            isMobile && this.props.classes.contentMobile,
          ),
        }}
      >
        {dialogContent}
      </Dialog>
    );
  }

  renderSearchArea(isMobile: boolean): React.ReactNode {
    const search = this.state.search || {
      limit: 4,
      similarToIdeaId: this.props.post?.ideaId,
    };
    const filters = this.renderSearchFilters(search, isMobile);
    return (
      <div className={classNames(
        this.props.classes.searchArea,
        this.props.onlyAllowLinkFrom && this.props.classes.searchAreaOnlyLinkContainer,
      )}>
        {!isMobile && (
          <>
            <div className={this.props.classes.filtersExternal}>{filters}</div>
            <DividerVertical />
          </>
        )}
        <div className={classNames(
          (isMobile && !this.props.onlyAllowLinkFrom) ? this.props.classes.searchResultMobile : this.props.classes.searchResultScroll,
        )}>
          {this.renderSearchBar(search, isMobile ? filters : undefined)}
          {this.renderSearchResult(search)}
        </div>
      </div>
    );
  }

  renderSearchBarResult(isMobile: boolean): React.ReactNode {
    return (
      <>
      </>
    );
  }

  renderActionArea(isMobile: boolean): React.ReactNode {
    const our = this.renderPostPreview(isMobile, this.props.post);
    const actions = this.renderActions();
    const other = this.renderPostPreview(isMobile, this.state.selectedPostId ? this.props.server.getStore().getState().ideas.byId[this.state.selectedPostId]?.idea : undefined);

    return (
      <div className={this.props.classes.actionArea}>
        {!this.state.directionReversed
          ? [our, actions, other]
          : [other, actions, our]}
      </div>
    );
  }

  renderControls(): React.ReactNode {
    return (
      <div className={this.props.classes.controlsArea}>
        <DialogActions>
          <Button onClick={() => this.props.onClose()}>
            Cancel
          </Button>
          <SubmitButton
            disableElevation
            color='primary'
            variant='contained'
            disabled={!this.state.selectedPostId}
            isSubmitting={this.state.isSubmitting}
            onClick={async () => {
              if (!this.state.selectedPostId) return;
              if (this.props.onSubmit) {
                this.props.onSubmit(this.state.selectedPostId, this.state.action, !!this.state.directionReversed);
                return;
              }
              if (!this.props.post || !this.props.server) return;
              this.setState({ isSubmitting: true });
              try {
                const projectId = this.props.server.getProjectId();
                const ideaId = this.state.directionReversed ? this.state.selectedPostId : this.props.post.ideaId;
                const parentIdeaId = this.state.directionReversed ? this.props.post.ideaId : this.state.selectedPostId;
                const dispatcher = await this.props.server.dispatchAdmin();
                await this.state.action === 'link'
                  ? dispatcher.ideaLinkAdmin({ projectId, ideaId, parentIdeaId })
                  : dispatcher.ideaMergeAdmin({ projectId, ideaId, parentIdeaId });
                this.props.onClose();
                this.setState({ selectedPostId: undefined });
              } finally {
                this.setState({ isSubmitting: false });
              }
            }}
          >
            Apply
          </SubmitButton>
        </DialogActions>
      </div>
    );
  }

  renderHeader(): React.ReactNode {
    return (
      <div className={this.props.classes.headerArea}>
        <DialogTitle>Connect post</DialogTitle>
      </div>
    );
  }

  renderPostPreview(isMobile: boolean, post?: Client.Idea): React.ReactNode {
    return (
      <div className={classNames(
        this.props.classes.preview,
      )}>
        <OutlinePostContent key={post?.ideaId || 'unselected'} className={this.props.classes.previewOutline}>
          {post ? (
            <Post
              variant='list'
              server={this.props.server}
              idea={post}
              disableOnClick
              display={display}
            />
          ) : (
            <div className={this.props.classes.nothing}>
              {isMobile ? 'Search and select below' : 'Select a post'}
            </div>
          )}
        </OutlinePostContent>
      </div>
    );
  }

  renderActions(): React.ReactNode {
    return (
      <div key='link' className={this.props.classes.link}>
        <div className={classNames(
          this.props.classes.center,
          this.props.classes.evenItem,
        )}>
          <IconButton
            className={classNames(
              this.props.classes.actionSwapDirection,
            )}
            onClick={() => this.setState({ directionReversed: !this.state.directionReversed })}
          >
            <SwapVertIcon fontSize='inherit' color='inherit' />
          </IconButton>
        </div>
        <div className={this.props.classes.actionSelectedContainer}>
          {this.renderAction(this.state.action, true)}
        </div>
        <IconButton
          className={classNames(
            this.props.classes.actionSwapType,
          )}
          onClick={() => this.setState({ action: this.state.action === 'link' ? 'merge' : 'link' })}
        >
          <ChangeIcon fontSize='inherit' color='inherit' />
        </IconButton>
      </div >
    );
  }

  renderAction(type: 'link' | 'merge', selected: boolean = false): React.ReactNode {
    return (
      <div className={classNames(
        this.props.classes.action,
        selected && this.props.classes.actionSelected,
        !selected && this.props.classes.actionNotSelected,
      )} >
        {type === 'link'
          ? (<LinkAltIcon fontSize='inherit' color='inherit' />)
          : (<MergeIcon fontSize='inherit' color='inherit' className={this.props.classes.mergeIcon} />)}
        &nbsp;
        {type === 'link'
          ? 'Link'
          : 'Merge'}
        &nbsp;
        <HelpPopper description={type === 'link'
          ? 'Shows a link between two related posts. Typically used for linking related feedback to tasks or completed tasks to a changelog entry.'
          : 'Merges one post to another including all comments, votes and subscribers. Typically used for merging duplicate or similar posts together.'}
        />
      </div>
    );
  }

  renderSearchResult(search: Partial<Admin.IdeaSearchAdmin>): React.ReactNode {
    return (
      <PostList
        server={this.props.server}
        selectable='highlight'
        selected={this.state.selectedPostId}
        search={this.state.search}
        onClickPost={postId => this.setState({ selectedPostId: this.state.selectedPostId === postId ? undefined : postId })}
        displayOverride={display}
      />
    );
  }

  renderSearchFilters(search: Partial<Admin.IdeaSearchAdmin>, isInsideSearch: boolean): React.ReactNode {
    return (
      <DashboardPostFilterControls
        server={this.props.server}
        search={search}
        onSearchChanged={newSearch => this.setState({
          search: {
            ...newSearch,
            similarToIdeaId: undefined,
          }
        })}
        allowSearchMultipleCategories
        sortByDefault={Admin.IdeaSearchAdminSortByEnum.Trending}
        horizontal={isInsideSearch}
      />
    );
  }

  renderSearchBar(search: Partial<Admin.IdeaSearchAdmin>, filters?: React.ReactNode): React.ReactNode {
    return (
      <div className={this.props.classes.searchBar}>
        <DashboardSearchControls
          placeholder='Search'
          searchText={search.searchText || ''}
          onSearchChanged={searchText => this.setState({
            search: {
              ...this.state.search,
              searchText,
              similarToIdeaId: undefined,
            }
          })}
          filters={filters}
        />
      </div>
    );
  }
}

export default withStyles(styles, { withTheme: true })(withWidth({ initialWidth })(PostConnectDialog));
