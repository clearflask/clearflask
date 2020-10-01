import { Collapse } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import * as Client from '../../api/client';
import { ReduxState, Server, StateSettings, Status } from '../../api/server';
import Loader from '../utils/Loader';
import Comment from './Comment';
import CommentReply from './CommentReply';
import LoadMoreButton from './LoadMoreButton';

const styles = (theme: Theme) => createStyles({
  commentIndent: {
    marginLeft: theme.spacing(3),
  },
});
interface Props {
  server: Server;
  ideaId: string;
  expectedCommentCount: number;
  parentCommentId?: string;
  newCommentsAllowed?: boolean; // TODO add comment replies
  loggedInUser?: Client.User;
  logIn: () => Promise<void>;
  onAuthorClick?: (commentId: string, userId: string) => void;
}
interface ConnectProps {
  comments: Client.CommentWithVote[];
  commentsStatus?: Status;
  loadMore: () => Promise<Client.IdeaCommentSearchResponse>;
  settings: StateSettings;
}
class CommentListRaw extends Component<Props & ConnectProps & WithStyles<typeof styles, true>> {
  state = {};

  constructor(props) {
    super(props)

    // If we are top level comment list and no list has been fetched and there are comments, fetch them now
    if (!this.props.parentCommentId && !this.props.commentsStatus && this.props.expectedCommentCount > 0) {
      this.props.server.dispatch().ideaCommentSearch({
        projectId: this.props.server.getProjectId(),
        ideaId: this.props.ideaId,
        ideaCommentSearch: {},
      });
    }
  }

  render() {
    return (
      <div key={this.props.parentCommentId || this.props.ideaId} className={this.props.parentCommentId ? this.props.classes.commentIndent : undefined}>
        {this.props.comments.sort((l, r) => r.voteValue - l.voteValue).map(comment => (
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
              onAuthorClick={!!this.props.onAuthorClick
                ? userId => this.props.onAuthorClick && this.props.onAuthorClick(comment.commentId, userId)
                : undefined}
            />
            {comment.childCommentCount > 0 && (
              <CommentList
                {...this.props}
                expectedCommentCount={comment.childCommentCount}
                parentCommentId={comment.commentId}
              />
            )}
            <Collapse
              in={!!this.state[`replyOpen${comment.commentId}`]}
              mountOnEnter
              unmountOnExit
              className={this.props.classes.commentIndent}
            >
              <CommentReply
                server={this.props.server}
                focusOnMount
                ideaId={this.props.ideaId}
                parentCommentId={comment.commentId}
                logIn={this.props.logIn}
                onSubmitted={() => this.setState({ [`replyOpen${comment.commentId}`]: undefined })}
                onBlurAndEmpty={() => this.setState({ [`replyOpen${comment.commentId}`]: undefined })}
              />
            </Collapse>
          </React.Fragment>
        ))}
        <Loader loaded={this.props.commentsStatus !== Status.PENDING} error={this.props.commentsStatus === Status.REJECTED ? "Failed to load" : undefined}>
          {(this.props.commentsStatus !== Status.PENDING && this.props.comments.length >= this.props.expectedCommentCount)
            ? undefined : <LoadMoreButton onClick={this.props.loadMore.bind(this)} />}
        </Loader>
      </div>
    );
  }
}

const CommentList = connect<ConnectProps, {}, Props, ReduxState>((state: ReduxState, ownProps: Props): ConnectProps => {
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
      ownProps.server.dispatch().commentVoteGetOwn({
        projectId: state.projectId,
        commentIds: missingVotesByCommentIds,
      });
    }
  }
  return {
    commentsStatus: commentsStatus,
    comments: comments,
    settings: state.settings,
    loadMore: (): Promise<Client.IdeaCommentSearchResponse> => ownProps.server.dispatch().ideaCommentSearch({
      projectId: state.projectId,
      ideaId: ownProps.ideaId,
      ideaCommentSearch: {
        parentCommentId: ownProps.parentCommentId,
        excludeChildrenCommentIds: commentIds && commentIds.commentIds ? [...commentIds.commentIds] : undefined,
      },
    }),
  };
})(withStyles(styles, { withTheme: true })(CommentListRaw));
export default CommentList;