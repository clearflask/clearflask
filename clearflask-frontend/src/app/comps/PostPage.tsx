import { Fade, isWidthUp, withWidth, WithWidthProps } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import * as Client from '../../api/client';
import { getSearchKey, ReduxState, Server, Status } from '../../api/server';
import { truncateWithElipsis } from '../../common/util/stringUtil';
import setTitle from '../../common/util/titleUtil';
import ErrorPage from '../ErrorPage';
import { Direction } from './Panel';
import PanelPost from './PanelPost';
import Post from './Post';

const styles = (theme: Theme) => createStyles({
  container: {
    display: 'flex',
    flexWrap: 'wrap',
  },
  grow: {
    flexGrow: 1,
  },
  similar: {
    margin: theme.spacing(2),
    flexBasis: 0,
  },
});
interface Props {
  server: Server;
  postId: string;
  PostProps?: Partial<React.ComponentProps<typeof Post>>;
}
interface ConnectProps {
  postStatus: Status;
  post?: Client.Idea;
  suppressSetTitle?: boolean,
}
class PostPage extends Component<Props & ConnectProps & WithWidthProps & WithStyles<typeof styles, true>> {
  render() {
    if (this.props.post && !this.props.suppressSetTitle) {
      setTitle(truncateWithElipsis(25, this.props.post.title), true);
    }

    if (this.props.postStatus === Status.REJECTED) {
      if (!this.props.suppressSetTitle) {
        setTitle("Failed to load");
      }
      return (<ErrorPage msg='Oops, failed to load' />);
    } else if (this.props.postStatus === Status.FULFILLED && this.props.post === undefined) {
      if (!this.props.suppressSetTitle) {
        setTitle("Not found");
      }
      return (<ErrorPage msg='Oops, not found' />);
    }

    const post = (
      <Post
        key='post'
        server={this.props.server}
        idea={this.props.post}
        variant='page'
        {...this.props.PostProps}
      />
    );

    const similar = (this.props.width && isWidthUp('md', this.props.width, true)) && (
      <React.Fragment>
        <div className={this.props.classes.grow} />
        <PanelPost
          className={this.props.classes.similar}
          direction={Direction.Vertical}
          panel={{
            hideIfEmpty: true,
            title: 'SIMILAR',
            search: {
              similarToIdeaId: this.props.postId,
              limit: 5,
            },
            display: {
              titleTruncateLines: 1,
              descriptionTruncateLines: 2,
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
          }}
          server={this.props.server}
        />
      </React.Fragment>
    );

    return (
      <div className={this.props.classes.container}>
        {post}
        {similar}
      </div>
    );
  }
}

export default connect<ConnectProps, {}, Props, ReduxState>((state: ReduxState, ownProps: Props) => {
  var newProps: ConnectProps = {
    postStatus: Status.PENDING,
    post: undefined,
    suppressSetTitle: state.settings.suppressSetTitle,
  };

  const byId = state.ideas.byId[ownProps.postId];
  if (!byId) {
    ownProps.server.dispatch().ideaGet({
      projectId: state.projectId!,
      ideaId: ownProps.postId,
    });
  } else {
    newProps.postStatus = byId.status;
    newProps.post = byId.idea;
  }

  return newProps;
})(withStyles(styles, { withTheme: true })(withWidth()(PostPage)));
