// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import { Collapse, Typography, withWidth, WithWidthProps } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import NotifyIcon from '@material-ui/icons/NotificationsActiveRounded';
import classNames from 'classnames';
import React, { Component } from 'react';
import { withTranslation, WithTranslation } from 'react-i18next';
import { connect } from 'react-redux';
import { RouteComponentProps, withRouter } from 'react-router';
import * as Client from '../../api/client';
import { ReduxState, Server, Status } from '../../api/server';
import SubmitButton from '../../common/SubmitButton';
import { preserveEmbed } from '../../common/util/historyUtil';
import { WithMediaQueries, withMediaQueries } from '../../common/util/MediaQuery';
import { RedirectIso } from '../../common/util/routerUtil';
import { initialWidth } from '../../common/util/screenUtil';
import { setAppTitle } from '../../common/util/titleUtil';
import ErrorPage from '../ErrorPage';
import DividerCorner from '../utils/DividerCorner';
import LogIn from './LogIn';
import { Direction } from './Panel';
import PanelPost from './PanelPost';
import Post from './Post';

// It doesn't look nice, need to revisit this later
const SimilarEnabled = false;

export interface MediaQueries {
  spaceForOnePanel: boolean;
  spaceForTwoPanels: boolean;
}

const styles = (theme: Theme) => createStyles({
  container: {
    display: 'flex',
    // flexWrap: 'wrap',
    marginTop: theme.spacing(3),
  },
  panel: {
    display: 'flex',
    flexDirection: 'column',
    flex: '1 1 0px',
    width: 150,
  },
  post: {
  },
  similar: {
    flex: '1 1 0px',
  },
  subscribe: {
    minWidth: 150,
    width: '100%',
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
    marginTop: theme.spacing(1),
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
class PostPage extends Component<Props & ConnectProps & WithTranslation<'app'> & WithWidthProps & WithMediaQueries<keyof MediaQueries> & RouteComponentProps & WithStyles<typeof styles, true>, State> {
  state: State = {};

  render() {
    if (!this.props.postStatus) {
      this.props.server.dispatch({ ssr: true, ssrStatusPassthrough: true, debounce: true }).then(d => d.ideaGet({
        projectId: this.props.server.getProjectId(),
        ideaId: this.props.postId,
      }));
    }

    if (this.props.post?.mergedToPostId) {
      return (
        <RedirectIso to={preserveEmbed(`/post/${this.props.post.mergedToPostId}`)} />
      );
    }

    if (this.props.post && this.props.projectName && !this.props.suppressSetTitle) {
      setAppTitle(this.props.projectName, this.props.post.title);
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

    var subscribeToMe;
    if (this.props.category?.subscription?.hellobar && this.props.category) {
      const isSubscribed = this.props.loggedInUser?.categorySubscriptions?.includes(this.props.category.categoryId);
      subscribeToMe = (
        <>
          {this.props.category.subscription.hellobar.message && (
            <Typography>{this.props.t(this.props.category.subscription.hellobar.message as any)}</Typography>
          )}
          <SubmitButton
            className={this.props.classes.subscribeButton}
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
            {this.props.t(this.props.category.subscription.hellobar.button || 'follow' as any)}
          </SubmitButton>
          <LogIn
            actionTitle={this.props.t(this.props.category.subscription.hellobar.title as any)}
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
          suppressDivider
          className={this.props.classes.subscribe}
          innerClassName={this.props.classes.subscribeInner}
          title={(
            <div className={this.props.classes.subscribeTitle}>
              <NotifyIcon fontSize='inherit' />
              &nbsp;&nbsp;
              {this.props.t(this.props.category.subscription.hellobar.title as any)}
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
        <Collapse mountOnEnter in={!isSubscribed}>
          {subscribeToMe}
        </Collapse>
      );
    }
    const subscribeToMeShowInPanel = !!subscribeToMe && this.props.mediaQueries.spaceForOnePanel;

    const similar = (SimilarEnabled && !this.props.suppressSimilar && this.props.post && (
      subscribeToMeShowInPanel ? this.props.mediaQueries.spaceForTwoPanels : this.props.mediaQueries.spaceForOnePanel
    )) && (
        <div className={this.props.classes.similar}>
          <PanelPost
            direction={Direction.Vertical}
            PostProps={this.props.PostProps}
            widthExpand
            margins={0}
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
                showVotingCount: false,
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
        contentBeforeComments={!subscribeToMeShowInPanel && subscribeToMe}
        {...this.props.PostProps}
      />
    );

    return (
      <div className={this.props.classes.container}>
        <div className={this.props.classes.panel}>
          {similar}
        </div>
        {post}
        <div className={this.props.classes.panel}>
          {subscribeToMeShowInPanel && subscribeToMe}
        </div>
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
  newProps.postStatus = byId?.status;
  newProps.post = byId?.idea;

  if (newProps.post) {
    newProps.category = state.conf.conf?.content.categories.find(c => c.categoryId === newProps.post!.categoryId)
  }

  return newProps;
})(withMediaQueries<keyof MediaQueries, Props>(props => {
  return {
    spaceForOnePanel: `(min-width: ${600 + 250}px)`,
    spaceForTwoPanels: `(min-width: ${600 + 250 + 150}px)`,
  };
})(withStyles(styles, { withTheme: true })(withWidth({ initialWidth })(withRouter(withTranslation('app', { withRef: true })(PostPage))))));
