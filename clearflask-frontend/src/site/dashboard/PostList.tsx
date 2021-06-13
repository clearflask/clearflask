import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import classNames from 'classnames';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import * as Admin from '../../api/admin';
import * as Client from '../../api/client';
import { ReduxState, Server } from '../../api/server';
import PanelPost, { Direction } from '../../app/comps/PanelPost';
import { buttonHover, buttonSelected } from '../../common/util/cssUtil';

const styles = (theme: Theme) => createStyles({
  post: {
    ...buttonHover(theme),
    '&:hover $title': {
      textDecoration: 'underline',
    },
    cursor: 'pointer',
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
});
interface Props {
  server: Server;
  search?: Partial<Admin.IdeaSearchAdmin>;
  selectedPostId?: string;
  onClickPost: (postId: string) => void;
  onUserClick: (userId: string) => void;
  layout?: 'similar-merge-action';
  dragndrop?: boolean;
  PanelPostProps?: Partial<React.ComponentProps<typeof PanelPost>>;
}
interface ConnectProps {
  configver?: string;
  config?: Client.Config;
  loggedInUserId?: string;
}
class PostList extends Component<Props & ConnectProps & WithStyles<typeof styles, true>> {

  render() {
    const panel = {
      display: this.props.layout !== 'similar-merge-action' ? {
        titleTruncateLines: 2,
        descriptionTruncateLines: 2,
        responseTruncateLines: 0,
        showCommentCount: true,
        showCreated: false,
        showAuthor: false,
        showStatus: true,
        showTags: true,
        showVoting: true,
        showFunding: false,
        showExpression: true,
        showEdit: false,
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
        showFunding: false,
        showExpression: false,
      },
      search: {},
      hideIfEmpty: false,
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
        showDivider={this.props.layout !== 'similar-merge-action'}
        searchOverrideAdmin={this.props.search}
        server={this.props.server}
        onClickPost={this.props.onClickPost}
        {...this.props.PanelPostProps}
      />
    );
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
