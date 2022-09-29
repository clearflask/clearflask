// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import classNames from 'classnames';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import * as Client from '../../api/client';
import { ReduxState, Server, StateSettings, Status } from '../../api/server';
import { notEmpty } from '../../common/util/arrayUtil';
import Loader from '../utils/Loader';
import Comment from './Comment';
import CommentReply from './CommentReply';
import LoadMoreButton from './LoadMoreButton';

const styles = (theme: Theme) => createStyles({
  commentIndent: {
    marginLeft: theme.spacing(4),
  },
  commentIndentMergedPost: {
    marginLeft: theme.spacing(8),
  },
});
interface Props {
  server: Server;
  ideaId: string;
  expectedCommentCount: number;
  parentCommentId?: string;
  mergedPostId?: string;
  newCommentsAllowed?: boolean; // TODO add comment replies
  loggedInUser?: Client.User;
  logIn: () => Promise<void>;
  onAuthorClick?: (commentId: string, userId: string) => void;
  disableOnClick?: boolean;
}
interface ConnectProps {
  callOnMount?: () => void,
  comments: Client.CommentWithVote[];
  commentsStatus?: Status;
  settings: StateSettings;
  commentIds?: Set<string>;
}
interface State {
  loadedWithNoResults?: boolean;
}
class CommentListRaw extends Component<Props & ConnectProps & WithStyles<typeof styles, true>, State> {
  state: State = {};

  componentDidMount() {
    this.props.callOnMount?.();

    // If we are top level comment list and no list has been fetched and there are comments, fetch them now
    if (!this.props.parentCommentId && !this.props.commentsStatus && this.props.expectedCommentCount > 0) {
      this.props.server.dispatch().then(d => d.ideaCommentSearch({
        projectId: this.props.server.getProjectId(),
        ideaId: this.props.ideaId,
        ideaCommentSearch: {},
      }));
    }
  }

  render() {
    const parentIsMergedPost = this.props.mergedPostId === this.props.parentCommentId;
    return (
      <div key={this.props.parentCommentId || this.props.ideaId} className={classNames(
        this.props.parentCommentId && (parentIsMergedPost
          ? this.props.classes.commentIndentMergedPost
          : this.props.classes.commentIndent),
      )}>
        {this.props.comments.map(comment => {
          const mergedPostId = comment.mergedPostId || this.props.mergedPostId;
          return (
            <React.Fragment key={comment.commentId}>
              <Comment
                key={comment.commentId}
                server={this.props.server}
                comment={comment}
                isBlurry={this.props.settings.demoBlurryShadow}
                loggedInUser={this.props.loggedInUser}
                replyOpen={!!this.state[`replyOpen${comment.commentId}`]}
                onReplyClicked={() => this.setState({ [`replyOpen${comment.commentId}`]: true })}
                logIn={this.props.logIn}
                disableOnClick={this.props.disableOnClick}
                onAuthorClick={(this.props.onAuthorClick && !this.props.disableOnClick)
                  ? userId => this.props.onAuthorClick && this.props.onAuthorClick(comment.commentId, userId)
                  : undefined}
              />
              <CommentReply
                className={this.props.classes.commentIndent}
                server={this.props.server}
                collapseIn={!!this.state[`replyOpen${comment.commentId}`]}
                focusOnIn
                ideaId={this.props.ideaId}
                parentCommentId={comment.commentId}
                mergedPostId={mergedPostId}
                logIn={this.props.logIn}
                onSubmitted={() => this.setState({ [`replyOpen${comment.commentId}`]: undefined })}
                onBlurAndEmpty={() => this.setState({ [`replyOpen${comment.commentId}`]: undefined })}
              />
              {comment.childCommentCount > 0 && (
                <CommentList
                  {...this.props}
                  mergedPostId={mergedPostId}
                  expectedCommentCount={comment.childCommentCount}
                  parentCommentId={comment.commentId}
                />
              )}
            </React.Fragment>
          );
        })}
        <Loader loaded={this.props.commentsStatus !== Status.PENDING} error={this.props.commentsStatus === Status.REJECTED ? "Failed to load" : undefined}>
          {((this.props.commentsStatus !== Status.PENDING && this.props.comments.length >= this.props.expectedCommentCount) || this.state.loadedWithNoResults)
            ? undefined : <LoadMoreButton onClick={this.loadMore.bind(this)} />}
        </Loader>
      </div>
    );
  }

  async loadMore() {
    const results = await (await this.props.server.dispatch()).ideaCommentSearch({
      projectId: this.props.server.getProjectId(),
      ideaId: this.props.ideaId,
      ideaCommentSearch: {
        parentCommentId: this.props.parentCommentId,
        excludeChildrenCommentIds: this.props.commentIds?.size ? [...this.props.commentIds] : undefined,
      },
    });
    if (!results.results.length) {
      this.setState({ loadedWithNoResults: true });
    }
  }
}

const CommentList = connect<ConnectProps, {}, Props, ReduxState>((state: ReduxState, ownProps: Props): ConnectProps => {
  var callOnMount;
  const comments: Client.CommentWithVote[] = [];
  var ideaIdOrParentCommentId = ownProps.parentCommentId || ownProps.ideaId;
  const commentIds = state.comments.byIdeaIdOrParentCommentId[ideaIdOrParentCommentId];
  const commentsStatus = commentIds && commentIds.status;
  if (commentIds && commentIds.status === Status.FULFILLED && commentIds.commentIds) {
    const missingVotesByCommentIds: string[] = [];
    commentIds.commentIds.forEach(commentId => {
      const comment = state.comments.byId[commentId];
      if (!comment || comment.status !== Status.FULFILLED || !comment.comment) {
        return;
      }
      const commentWithVote: Client.CommentWithVote = comment.comment;
      if (state.commentVotes.statusByCommentId[commentId] === undefined) {
        missingVotesByCommentIds.push(commentId);
      } else {
        commentWithVote.vote = state.commentVotes.votesByCommentId[commentId];
      }
      comments.push(comment.comment);
    });
    if (state.users.loggedIn.status === Status.FULFILLED && missingVotesByCommentIds.length > 0) {
      callOnMount = () => {
        ownProps.server.dispatch().then(d => d.commentVoteGetOwn({
          projectId: state.projectId!,
          commentIds: missingVotesByCommentIds,
          myOwnCommentIds: missingVotesByCommentIds
            .map(commentId => state.comments.byId[commentId])
            .filter(comment => comment?.comment?.authorUserId === state.users.loggedIn.user?.userId)
            .map(comment => comment?.comment?.commentId)
            .filter(notEmpty),
        }));
      };
    }
  }
  comments.sort((l, r) => r.voteValue - l.voteValue);
  return {
    callOnMount,
    commentIds: commentIds?.commentIds,
    commentsStatus: commentsStatus,
    comments: comments,
    settings: state.settings,
  };
})(withStyles(styles, { withTheme: true })(CommentListRaw));
export default CommentList;