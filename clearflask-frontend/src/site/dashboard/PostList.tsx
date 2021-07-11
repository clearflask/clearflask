import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import classNames from 'classnames';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import * as Admin from '../../api/admin';
import * as Client from '../../api/client';
import { ReduxState, Server } from '../../api/server';
import PanelPost, { Direction } from '../../app/comps/PanelPost';
import { contentScrollApplyStyles, Orientation } from '../../common/ContentScroll';
import { buttonHover, buttonSelected } from '../../common/util/cssUtil';
import { customShouldComponentUpdate } from '../../common/util/reactUtil';

const styles = (theme: Theme) => createStyles({
  post: {
    ...buttonHover(theme),
    '&:hover $title': {
      textDecoration: 'underline',
    },
    cursor: 'pointer',
    minWidth: 0,
  },
  postSelected: {
    ...buttonSelected(theme),
  },
  postSimilarMergeAction: {
    minWidth: 0,
    padding: 0,
    '& h1': {
      fontSize: '1rem',
    },
    '& *': {
      margin: 0,
      padding: 0,
    },
  },
  scroll: {
    flexGrow: 1,
    minHeight: '100%',
    ...contentScrollApplyStyles({ theme, orientation: Orientation.Vertical }),
  },
});
interface Props {
  className?: string;
  server: Server;
  search?: Partial<Admin.IdeaSearchAdmin>;
  selectedPostId?: string;
  onClickPost?: (postId: string) => void;
  onUserClick?: (userId: string) => void;
  layout?: 'similar-merge-action';
  scroll?: boolean;
  hideIfEmpty?: boolean;
  displayOverride?: Admin.PostDisplay;
  PanelPostProps?: Partial<React.ComponentProps<typeof PanelPost>>;
}
interface ConnectProps {
  configver?: string;
  config?: Client.Config;
  loggedInUserId?: string;
}
class PostList extends Component<Props & ConnectProps & WithStyles<typeof styles, true>> {

  shouldComponentUpdate = customShouldComponentUpdate({
    nested: new Set(['displayOverride', 'PanelPostProps', 'search']),
    presence: new Set(['onClickPost', 'onUserClick']),
  });

  render() {
    const panel: Admin.PagePanelWithHideIfEmpty = {
      display: this.props.layout !== 'similar-merge-action' ? {
        titleTruncateLines: 2,
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
        ...this.props.displayOverride,
      } : {
        titleTruncateLines: 2,
        descriptionTruncateLines: 0,
        responseTruncateLines: 0,
        showCommentCount: false,
        showCategoryName: false,
        showCreated: false,
        showAuthor: false,
        showStatus: false,
        showTags: false,
        showVoting: false,
        showVotingCount: false,
        showFunding: false,
        showExpression: false,
        ...this.props.displayOverride,
      },
      search: {},
      hideIfEmpty: !!this.props.hideIfEmpty,
    };
    var result = (
      <PanelPost
        direction={Direction.Vertical}
        postClassName={classNames(
          this.props.classes.post,
          this.props.layout === 'similar-merge-action' && this.props.classes.postSimilarMergeAction,
          this.props.PanelPostProps?.postClassName,
        )}
        selectedPostId={this.props.selectedPostId}
        selectedPostClassName={this.props.classes.postSelected}
        suppressPanel
        panel={panel}
        widthExpand
        widthExpandMargin={this.props.theme.spacing(2)}
        searchOverrideAdmin={this.props.search}
        server={this.props.server}
        onClickPost={this.props.onClickPost}
        {...this.props.PanelPostProps}
      />
    );
    if (this.props.scroll || this.props.className) {
      result = (
        <div className={classNames(
          this.props.className,
          this.props.scroll && this.props.classes.scroll,
        )}>
          {result}
        </div>
      );
    }
    return result;
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
