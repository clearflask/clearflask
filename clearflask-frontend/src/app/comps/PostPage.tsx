import { Collapse, isWidthUp, Typography, withWidth, WithWidthProps } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import NotifyIcon from '@material-ui/icons/NotificationsActiveRounded';
import classNames from 'classnames';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import * as Client from '../../api/client';
import { ReduxState, Server, Status } from '../../api/server';
import SubmitButton from '../../common/SubmitButton';
import { initialWidth } from '../../common/util/screenUtil';
import { truncateWithElipsis } from '../../common/util/stringUtil';
import { setAppTitle } from '../../common/util/titleUtil';
import ErrorPage from '../ErrorPage';
import DividerCorner from '../utils/DividerCorner';
import LogIn from './LogIn';
import { Direction } from './Panel';
import PanelPost from './PanelPost';
import Post from './Post';

const styles = (theme: Theme) => createStyles({
  container: {
    display: 'flex',
    flexWrap: 'wrap',
  },
  panel: {
    display: 'flex',
    flexDirection: 'column',
    flexBasis: 0,
  },
  post: {
    flexGrow: 1,
    display: 'flex',
  },
  similar: {
    minWidth: 300,
    margin: theme.spacing(2),
  },
  subscribe: {
    width: 300,
    margin: theme.spacing(2),
  },
  subscribeInner: {
    margin: theme.spacing(2),
    display: 'flex',
    flexDirection: 'column',
  },
  subscribeTitle: {
    display: 'flex',
    alignItems: 'center',
  },
  subscribeButton: {
    alignSelf: 'flex-end',
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
  loggedInUser?: Client.UserMe;
  category?: Client.Category;
  projectName?: string,
  suppressSetTitle?: boolean,
}
interface State {
  isSubmitting?: boolean;
  logInOpen?: boolean;
}
class PostPage extends Component<Props & ConnectProps & WithWidthProps & WithStyles<typeof styles, true>, State> {
  state: State = {};

  constructor(props) {
    super(props);

    props.callOnMount?.();
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

    const isWidthEnough = this.props.width && isWidthUp('md', this.props.width, true);

    var subscribeToMe;
    if (this.props.category?.subscription?.hellobar && this.props.category) {
      const isSubscribed = this.props.loggedInUser?.categorySubscriptions?.includes(this.props.category.categoryId);
      subscribeToMe = (
        <>
          {this.props.category.subscription.hellobar.message && (
            <Typography>{this.props.category.subscription.hellobar.message}</Typography>
          )}
          <SubmitButton
            wrapperClassName={this.props.classes.subscribeButton}
            isSubmitting={this.state.isSubmitting}
            onClick={async () => {
              if (!this.props.loggedInUser) {
                this.setState({ logInOpen: true });
                return;
              }
              this.setState({ isSubmitting: true });
              try {
                const dispatcher = await this.props.server.dispatch();
                await dispatcher.categorySubscribe({
                  projectId: this.props.server.getProjectId(),
                  categoryId: this.props.category!.categoryId,
                  subscribe: !isSubscribed,
                });
              } finally {
                this.setState({ isSubmitting: false });
              }
            }}
            color='primary'
          >
            {this.props.category.subscription.hellobar.button || 'Follow'}
          </SubmitButton>
          <LogIn
            actionTitle={this.props.category.subscription.hellobar.title}
            server={this.props.server}
            open={this.state.logInOpen}
            onClose={() => this.setState({ logInOpen: false })}
            onLoggedInAndClose={async () => {
              this.setState({ logInOpen: false });
              const dispatcher = await this.props.server.dispatch();
              await dispatcher.categorySubscribe({
                projectId: this.props.server.getProjectId(),
                categoryId: this.props.category!.categoryId,
                subscribe: !isSubscribed,
              });
            }}
          />
        </>
      );
      subscribeToMe = !!this.props.category.subscription.hellobar.title ? (
        <DividerCorner
          className={this.props.classes.subscribe}
          innerClassName={this.props.classes.subscribeInner}
          title={(
            <div className={this.props.classes.subscribeTitle}>
              <NotifyIcon fontSize='inherit' />
              &nbsp;&nbsp;
              {this.props.category.subscription.hellobar.title}
            </div>
          )}
        >
          {subscribeToMe}
        </DividerCorner>
      ) : (
        <div
          className={classNames(this.props.classes.subscribe, this.props.classes.subscribeInner)}
        >
          {subscribeToMe}
        </div>
      );
      subscribeToMe = (
        <Collapse in={!isSubscribed}>
          {subscribeToMe}
        </Collapse>
      );
    }

    const similar = (isWidthEnough && !this.props.suppressSimilar && this.props.post) && (
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

    const post = (
      <Post
        className={this.props.classes.post}
        key='post'
        server={this.props.server}
        idea={this.props.post}
        variant='page'
        contentBeforeComments={!isWidthEnough && subscribeToMe}
        {...this.props.PostProps}
      />
    );

    return (
      <div className={this.props.classes.container}>
        {post}
        {isWidthEnough && (
          <div className={this.props.classes.panel}>
            {subscribeToMe}
            {similar}
          </div>
        )}
      </div>
    );
  }
}

export default connect<ConnectProps, {}, Props, ReduxState>((state: ReduxState, ownProps: Props) => {
  var newProps: ConnectProps = {
    postStatus: Status.PENDING,
    post: undefined,
    category: undefined,
    loggedInUser: state.users.loggedIn.user,
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

  if (newProps.post) {
    newProps.category = state.conf.conf?.content.categories.find(c => c.categoryId === newProps.post!.categoryId)
  }

  return newProps;
})(withStyles(styles, { withTheme: true })(withWidth({ initialWidth })(PostPage)));
