import React, { Component } from 'react';
import * as Client from '../../api/client';
import { withStyles, Theme, createStyles, WithStyles } from '@material-ui/core/styles';
import { Typography, Tooltip, Button } from '@material-ui/core';
import { connect } from 'react-redux';
import { ReduxState, Status, Server } from '../../api/server';
import Loader from '../utils/Loader';
import Comment from './Comment';
import { CommentSearchResponse } from '../../api/client';

const styles = (theme:Theme) => createStyles({
  indent: {
    marginLeft: theme.spacing(3),
  },
  loadMore: {
  },
});

interface Props {
  server:Server;
  ideaId:string;
  expectedCommentCount:number;
  parentCommentId?:string;
}

interface ConnectProps {
  comments:Client.CommentWithAuthor[];
  commentsStatus?:Status;
  loadMore:()=>Promise<CommentSearchResponse>;
}

class CommentListRaw extends Component<Props&ConnectProps&WithStyles<typeof styles, true>> {

  constructor(props) {
    super(props)

    // If we are top level comment list and no list has been fetched and there are comments, fetch them now
    if(!this.props.parentCommentId && !this.props.commentsStatus && this.props.expectedCommentCount > 0) {
      this.props.server.dispatch().commentList({
        projectId: this.props.server.getProjectId(),
        ideaId: this.props.ideaId,
        commentSearch: {},
      });
    }  
  }

  render() {
    return (
      <div key={this.props.parentCommentId || this.props.ideaId} className={this.props.parentCommentId ? this.props.classes.indent : undefined}>
        {this.props.comments.map(comment => (
          <React.Fragment key={comment.commentId}>
            <Comment comment={comment}></Comment>
            {comment.childCommentCount > 0 && (
              <CommentList
                server={this.props.server}
                ideaId={this.props.ideaId}
                expectedCommentCount={comment.childCommentCount}
                parentCommentId={comment.commentId}
              />
            )}
          </React.Fragment>
        ))}
        <Loader loaded={this.props.commentsStatus !== Status.PENDING} error={this.props.commentsStatus === Status.REJECTED ? "Failed to load" : undefined}>
          {this.renderLoadMore()}
        </Loader>
      </div>
    );
  }

  renderLoadMore() {
    if(this.props.commentsStatus !== Status.PENDING
      && this.props.comments.length >= this.props.expectedCommentCount) return null;

    return (
      <Button
        variant="text"
        className={this.props.classes.loadMore}
        onClick={e => this.props.loadMore()}>
        <Typography variant='caption'>See more</Typography>
      </Button>
    );
  }
}

const CommentList = connect<ConnectProps,{},Props,ReduxState>((state:ReduxState, ownProps:Props):ConnectProps => {
  const comments:Client.CommentWithAuthor[] = [];
  var ideaIdOrParentCommentId = ownProps.parentCommentId || ownProps.ideaId;
  const commentIds = state.comments.byIdeaIdOrParentCommentId[ideaIdOrParentCommentId];
  const commentsStatus = commentIds && commentIds.status;
  if(commentIds && commentIds.status === Status.FULFILLED && commentIds.commentIds) {
    commentIds.commentIds.forEach(commentId => {
      const comment = state.comments.byId[commentId];
      if(comment && comment.status === Status.FULFILLED && comment.comment) {
        comments.push(comment.comment);
      }
    });
  }
  return {
    commentsStatus: commentsStatus,
    comments: comments,
    loadMore: ():Promise<CommentSearchResponse> => ownProps.server.dispatch().commentList({
      projectId: state.projectId,
      ideaId: ownProps.ideaId,
      commentSearch: {
        parentCommentId: ownProps.parentCommentId,
        excludeChildrenCommentIds: commentIds && commentIds.commentIds ? [...commentIds.commentIds] : undefined,
      },
    }),
  };
})(withStyles(styles, { withTheme: true })(CommentListRaw));
export default CommentList;