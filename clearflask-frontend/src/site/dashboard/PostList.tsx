import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import { Component } from 'react';
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
});
interface Props {
  server: Server;
  search?: Partial<Admin.IdeaSearchAdmin>;
  selectedPostId?: string;
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
        postClassName={this.props.classes.post}
        selectedPostId={this.props.selectedPostId}
        selectedPostClassName={this.props.classes.postSelected}
        suppressPanel
        panel={{
          display: {
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
          },
          search: {},
          hideIfEmpty: false,
        }}
        widthExpand
        widthExpandMargin={this.props.theme.spacing(2)}
        showDivider
        searchOverrideAdmin={this.props.search}
        server={this.props.server}
        onClickPost={this.props.onClickPost}
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
