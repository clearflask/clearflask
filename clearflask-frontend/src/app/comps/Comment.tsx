import { Button, Typography } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import classNames from 'classnames';
import React, { Component } from 'react';
import TimeAgo from 'react-timeago';
import * as Client from '../../api/client';
import { cssBlurry, Server } from '../../api/server';
import ModStar from '../../common/ModStar';
import RichViewer from '../../common/RichViewer';
import notEmpty from '../../common/util/arrayUtil';
import Delimited from '../utils/Delimited';
import CommentEdit, { CommentDelete } from './CommentEdit';
import VotingControl from './VotingControl';

const styles = (theme: Theme) => createStyles({
  comment: {
    margin: theme.spacing(2, 2, 2, 0),
    display: 'grid',
    gridTemplateColumns: 'auto 1fr',
    gridTemplateRows: '1fr auto',
    gridTemplateAreas:
      "'v c'"
      + " 'v f'",
  },
  content: {
    gridArea: 'c',
    alignSelf: 'end',
  },
  votingControl: {
    gridArea: 'v',
    margin: theme.spacing(0, 2),
  },
  footer: {
    gridArea: 'f',
  },
  clickable: {
    '&:hover': {
      textDecoration: 'underline',
    },
    cursor: 'pointer',
  },
  barItem: {
    whiteSpace: 'nowrap',
    margin: theme.spacing(0.5),
  },
  bottomBarLine: {
    display: 'flex',
    alignItems: 'center',
  },
  commentDeleted: {
    color: theme.palette.text.secondary,
  },
  edited: {
    fontStyle: 'italic',
  },
  unknownUser: {
    fontStyle: 'italic',
  },
  editButton: {
    padding: `3px ${theme.spacing(0.5)}px`,
    whiteSpace: 'nowrap',
    minWidth: 'unset',
    color: theme.palette.text.secondary,
  },
  grow: {
    flexGrow: 1,
  },
  pre: {
    whiteSpace: 'pre-wrap',
  },
  editIconButton: {
    padding: '0px',
    color: theme.palette.text.secondary,
  },
  ...cssBlurry,
});

interface Props {
  server: Server;
  comment?: Client.CommentWithVote;
  isBlurry?: boolean;
  loggedInUser?: Client.User;
  replyOpen?: boolean;
  onCommentClick?: () => void;
  onReplyClicked?: () => void;
  logIn: () => Promise<void>;
}
interface State {
  editExpanded?: boolean;
  adminDeleteExpanded?: boolean;
  deleteExpanded?: boolean;
  isSubmittingVote?: Client.VoteOption;
}

class Comment extends Component<Props & WithStyles<typeof styles, true>, State> {
  state: State = {};

  render() {
    return (
      <div className={this.props.classes.comment}>
        <div
          className={classNames(this.props.classes.content, !!this.props.onCommentClick && this.props.classes.clickable)}
          onClick={!!this.props.onCommentClick ? this.props.onCommentClick.bind(this) : undefined}
        >
          {this.renderContent()}
        </div>
        <div className={this.props.classes.votingControl}>{this.renderVotingControl()}</div>
        <div className={this.props.classes.footer}>{this.renderBottomBar()}</div>
      </div>
    );
  }

  renderContent() {
    if (!this.props.comment) return null;
    return this.props.comment.authorUserId === undefined ? (
      <Typography variant='overline' className={this.props.classes.commentDeleted}>Comment deleted</Typography>
    ) : (
        <Typography variant='body1' className={`${this.props.classes.pre} ${this.props.isBlurry ? this.props.classes.blurry : ''}`}>
          <RichViewer key={this.props.comment.content || 'empty'} initialRaw={this.props.comment.content || ''} />
        </Typography>
      );
  }

  renderVotingControl() {
    if (!this.props.comment) return null;
    return (
      <VotingControl
        vote={this.props.comment.vote}
        hidden={!this.props.comment.content}
        voteValue={this.props.comment.voteValue || 0}
        isSubmittingVote={this.state.isSubmittingVote}
        votingAllowed={!!this.props.comment}
        onUpvote={() => this.voteUpdate(this.props.comment?.vote === Client.VoteOption.Upvote ? Client.VoteOption.None : Client.VoteOption.Upvote)}
        onDownvote={() => this.voteUpdate(this.props.comment?.vote === Client.VoteOption.Downvote ? Client.VoteOption.None : Client.VoteOption.Downvote)}
      />
    );
  }

  voteUpdate(vote: Client.VoteOption) {
    this.setState({ isSubmittingVote: vote });
    this.props.logIn().then(() => this.props.server.dispatch().commentVoteUpdate({
      projectId: this.props.server.getProjectId(),
      commentId: this.props.comment!.commentId,
      ideaId: this.props.comment!.ideaId,
      commentVoteUpdate: { vote: vote },
    })).then(commentResult => {
      this.setState({ isSubmittingVote: undefined });
    }).catch(err => {
      this.setState({ isSubmittingVote: undefined });
    });
  }

  renderBottomBar() {
    if (!this.props.comment) return null;

    const leftSide = [
      this.renderAuthor(),
      this.renderCreatedDatetime(),
      this.renderEdited(),
      this.renderReply(),
      this.renderAdminDelete(),
      this.renderEdit(),
    ].filter(notEmpty);
    const rightSide = [
    ].filter(notEmpty);

    if (leftSide.length + rightSide.length === 0) return null;

    return (
      <div className={this.props.classes.bottomBarLine}>
        <Delimited>
          {leftSide}
        </Delimited>
        <div className={this.props.classes.grow} />
        <Delimited>
          {rightSide}
        </Delimited>
      </div>
    );
  }

  renderReply() {
    if (this.props.replyOpen
      || !this.props.onReplyClicked) return null;

    return (
      <Button key='reply' variant='text' className={this.props.classes.editButton}
        onClick={e => this.props.onReplyClicked && this.props.onReplyClicked()}>
        <Typography variant='caption'>Reply</Typography>
      </Button>
    );
  }

  renderAdminDelete() {
    if (!this.props.comment
      || !this.props.comment.authorUserId
      || !this.props.server.isModLoggedIn()
      // Only show admin delete if the regular edit is not shown as it already contains a delete
      || (this.props.loggedInUser && this.props.comment.authorUserId === this.props.loggedInUser.userId)) return null;

    return (
      <React.Fragment key='adminDelete'>
        <Button variant='text' className={this.props.classes.editButton}
          onClick={e => this.setState({ adminDeleteExpanded: !this.state.adminDeleteExpanded })}>
          <Typography variant='caption'>Delete</Typography>
        </Button>
        {this.state.adminDeleteExpanded !== undefined && (
          <CommentDelete
            key={this.props.comment.commentId}
            server={this.props.server}
            comment={this.props.comment}
            asAdmin={true}
            open={this.state.adminDeleteExpanded}
            onClose={() => this.setState({ adminDeleteExpanded: false })}
          />
        )}
      </React.Fragment>
    );
  }

  renderEdit() {
    if (!this.props.comment
      || !this.props.comment.authorUserId
      || !(this.props.loggedInUser && this.props.comment.authorUserId === this.props.loggedInUser.userId)) return null;

    return (
      <React.Fragment key='edit'>
        <Button variant='text' className={this.props.classes.editButton}
          onClick={e => this.setState({ editExpanded: !this.state.editExpanded })}>
          <Typography variant='caption'>Edit</Typography>
        </Button>
        {this.state.editExpanded !== undefined && (
          <CommentEdit
            key={this.props.comment.commentId}
            server={this.props.server}
            comment={this.props.comment}
            loggedInUser={this.props.loggedInUser}
            open={this.state.editExpanded}
            onClose={() => this.setState({ editExpanded: false })}
          />
        )}
      </React.Fragment>
    );
  }

  renderEdited() {
    if (!this.props.comment || !this.props.comment.edited) return null;

    return (
      <Typography key='edited' className={`${this.props.classes.barItem} ${this.props.classes.edited}`} variant='caption'>
        {!this.props.comment.authorUserId ? 'deleted' : 'edited'}
        &nbsp;
        <TimeAgo date={this.props.comment.edited} />
      </Typography>
    );
  }

  renderAuthor() {
    if (!this.props.comment) return null;
    if (!this.props.comment.authorUserId || !this.props.comment.authorName) {
      return (
        <Typography key='author' className={`${this.props.classes.barItem} ${this.props.classes.unknownUser}`} variant='caption'>
          Unknown
        </Typography>
      );
    }

    return (
      <Typography key='author' className={this.props.classes.barItem} variant='caption'>
        <ModStar name={this.props.comment.authorName} isMod={this.props.comment.authorIsMod} />
      </Typography>
    );
  }

  renderCreatedDatetime() {
    if (!this.props.comment) return null;

    return (
      <Typography key='created' className={this.props.classes.barItem} variant='caption'>
        <TimeAgo date={this.props.comment.created} />
      </Typography>
    );
  }

  contentClick() {

  }
}

export default withStyles(styles, { withTheme: true })(Comment);
