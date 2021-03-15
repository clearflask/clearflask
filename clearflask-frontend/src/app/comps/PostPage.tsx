import { isWidthUp, withWidth, WithWidthProps } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import * as Client from '../../api/client';
import { ReduxState, Server, Status } from '../../api/server';
import { initialWidth } from '../../common/util/screenUtil';
import { truncateWithElipsis } from '../../common/util/stringUtil';
import { setAppTitle } from '../../common/util/titleUtil';
import ErrorPage from '../ErrorPage';
import { Direction } from './Panel';
import PanelPost from './PanelPost';
import Post from './Post';

const styles = (theme: Theme) => createStyles({
  container: {
    display: 'flex',
    flexWrap: 'wrap',
  },
  post: {
    flexGrow: 1,
    display: 'flex',
    justifyContent: 'center',
  },
  similar: {
    minWidth: 300,
    margin: theme.spacing(2),
    flexBasis: 0,
  },
});
interface Props {
  server: Server;
  postId: string;
  PostProps?: Partial<React.ComponentProps<typeof Post>>;
  suppressSimilar?: boolean;
}
interface ConnectProps {
  callOnMount?: () => void,
  postStatus: Status;
  post?: Client.Idea;
  projectName?: string,
  suppressSetTitle?: boolean,
}
class PostPage extends Component<Props & ConnectProps & WithWidthProps & WithStyles<typeof styles, true>> {
  componentDidMount() {
    this.props.callOnMount && this.props.callOnMount();
  }
  render() {
    if (this.props.post && this.props.projectName && !this.props.suppressSetTitle) {
      setAppTitle(this.props.projectName, truncateWithElipsis(25, this.props.post.title));
    }

    if (this.props.postStatus === Status.REJECTED) {
      if (this.props.projectName && !this.props.suppressSetTitle) {
        setAppTitle(this.props.projectName, 'Failed to load');
      }
      return (<ErrorPage msg='Oops, not found' />);
    } else if (this.props.postStatus === Status.FULFILLED && this.props.post === undefined) {
      if (this.props.projectName && !this.props.suppressSetTitle) {
        setAppTitle(this.props.projectName, 'Not found');
      }
      return (<ErrorPage msg='Oops, not found' />);
    }

    const post = (
      <Post
        className={this.props.classes.post}
        key='post'
        server={this.props.server}
        idea={this.props.post}
        variant='page'
        {...this.props.PostProps}
      />
    );

    const similar = (!this.props.suppressSimilar && this.props.post && this.props.width && isWidthUp('md', this.props.width, true)) && (
      <div className={this.props.classes.similar}>
        <PanelPost
          direction={Direction.Vertical}
          PostProps={this.props.PostProps}
          panel={{
            hideIfEmpty: true,
            title: 'Similar',
            search: {
              similarToIdeaId: this.props.postId,
              filterCategoryIds: [this.props.post.categoryId],
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
      </div>
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
    projectName: state.conf.conf?.layout.pageTitleSuffix || state.conf.conf?.name,
    suppressSetTitle: state.settings.suppressSetTitle,
  };

  const byId = state.ideas.byId[ownProps.postId];
  if (!byId) {
    newProps.callOnMount = () => {
      ownProps.server.dispatch({ ssr: true, ssrStatusPassthrough: true }).then(d => d.ideaGet({
        projectId: state.projectId!,
        ideaId: ownProps.postId,
      }));
    };
  } else {
    newProps.postStatus = byId.status;
    newProps.post = byId.idea;
  }

  return newProps;
})(withStyles(styles, { withTheme: true })(withWidth({ initialWidth })(PostPage)));
