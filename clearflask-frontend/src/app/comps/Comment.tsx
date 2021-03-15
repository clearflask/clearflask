import { Button, Typography } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import DeletedIcon from '@material-ui/icons/Clear';
import classNames from 'classnames';
import React, { Component } from 'react';
import { RouteComponentProps, withRouter } from 'react-router';
import { Link } from 'react-router-dom';
import TimeAgo from 'react-timeago';
import * as Client from '../../api/client';
import { cssBlurry, Server } from '../../api/server';
import ModAction from '../../common/ModAction';
import RichViewer from '../../common/RichViewer';
import TruncateFade from '../../common/Truncate';
import UserDisplay from '../../common/UserDisplay';
import notEmpty from '../../common/util/arrayUtil';
import { preserveEmbed } from '../../common/util/historyUtil';
import Delimited from '../utils/Delimited';
import CommentEdit, { CommentDelete } from './CommentEdit';
import { MaxContentWidth } from './Post';
import VotingControl from './VotingControl';

const styles = (theme: Theme) => createStyles({
  comment: {
    margin: theme.spacing(2, 2, 2, 0),
    maxWidth: MaxContentWidth,
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
    minWidth: 0,
  },
  votingControl: {
    gridArea: 'v',
    margin: theme.spacing(0, 2),
    position: 'relative',
  },
  votingControlDeletedIcon: {
    position: 'relative',
    left: '50%',
    top: '50%',
    fontSize: '1.7rem',
    transform: 'translateX(-50%) translateY(-50%)',
    color: theme.palette.grey[theme.palette.type === 'light' ? 200 : 600],
  },
  footer: {
    gridArea: 'f',
    minWidth: 0,
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
    color: theme.palette.text.hint,
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
  ...cssBlurry,
});

interface Props {
  server: Server;
  className?: string;
  comment?: Client.CommentWithVote;
  isBlurry?: boolean;
  loggedInUser?: Client.User;
  replyOpen?: boolean;
  linkToPost?: boolean;
  onCommentClick?: () => void;
  onReplyClicked?: () => void;
  logIn: () => Promise<void>;
  truncateLines?: number;
  hideAuthor?: boolean;
  onAuthorClick?: (userId: string) => void;
  onUpdated?: () => void;
}
interface State {
  editExpanded?: boolean;
  adminDeleteExpanded?: boolean;
  deleteExpanded?: boolean;
  isSubmittingVote?: Client.VoteOption;
}

class Comment extends Component<Props & RouteComponentProps & WithStyles<typeof styles, true>, State> {
  state: State = {};

  render() {
    var content = this.renderContent();
    content = this.props.linkToPost && this.props.comment ? (
      <Link
        className={classNames(this.props.classes.content, this.props.classes.clickable)}
        to={preserveEmbed(`/post/${this.props.comment.ideaId}`, this.props.location)}
      >
        {content}
      </Link>
    ) : (
        <div
          className={classNames(this.props.classes.content, this.props.onCommentClick && this.props.classes.clickable)}
          onClick={this.props.onCommentClick}
        >
          {content}
        </div>
      );
    return (
      <div className={classNames(this.props.classes.comment, this.props.className)}>
        {content}
        {this.renderVotingControl()}
        <div className={this.props.classes.footer}>{this.renderBottomBar()}</div>
      </div>
    );
  }

  renderContent() {
    if (!this.props.comment) return null;
    if (this.props.comment.authorUserId === undefined) {
      return (
        <Typography variant='overline' className={this.props.classes.commentDeleted}>Comment deleted</Typography>
      );
    } else {
      const variant = 'body1';
      var content = (
        <RichViewer key={this.props.comment.content || 'empty'} iAgreeInputIsSanitized html={this.props.comment.content || ''} />
      );
      if (this.props.truncateLines) {
        content = (
          <TruncateFade variant={variant} lines={this.props.truncateLines}>
            {content}
          </TruncateFade>
        );
      }
      return (
        <Typography variant={variant} className={`${this.props.classes.pre} ${this.props.isBlurry ? this.props.classes.blurry : ''}`}>
          {content}
        </Typography>
      );
    }
  }

  renderVotingControl() {
    if (!this.props.comment) return null;
    const hidden = !this.props.comment.content;
    return (
      <div className={this.props.classes.votingControl}>
        {hidden && (
          <DeletedIcon fontSize='inherit' className={this.props.classes.votingControlDeletedIcon} />
        )}
        <VotingControl
          vote={this.props.comment.vote}
          hidden={hidden}
          voteValue={this.props.comment.voteValue || 0}
          isSubmittingVote={this.state.isSubmittingVote}
          votingAllowed={!!this.props.comment}
          onUpvote={() => this.voteUpdate(this.props.comment?.vote === Client.VoteOption.Upvote ? Client.VoteOption.None : Client.VoteOption.Upvote)}
          onDownvote={() => this.voteUpdate(this.props.comment?.vote === Client.VoteOption.Downvote ? Client.VoteOption.None : Client.VoteOption.Downvote)}
        />
      </div>
    );
  }

  voteUpdate(vote: Client.VoteOption) {
    this.setState({ isSubmittingVote: vote });
    this.props.logIn().then(() => this.props.server.dispatch().then(d => d.commentVoteUpdate({
      projectId: this.props.server.getProjectId(),
      commentId: this.props.comment!.commentId,
      ideaId: this.props.comment!.ideaId,
      commentVoteUpdate: { vote: vote },
    }))).then(commentResult => {
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
      || !this.props.server.isModOrAdminLoggedIn()
      // Only show admin delete if the regular edit is not shown as it already contains a delete
      || (this.props.loggedInUser && this.props.comment.authorUserId === this.props.loggedInUser.userId)) return null;

    return (
      <React.Fragment key='adminDelete'>
        <Button variant='text' className={this.props.classes.editButton}
          onClick={e => this.setState({ adminDeleteExpanded: !this.state.adminDeleteExpanded })}>
          <Typography variant='caption'>
            <ModAction label='Delete' />
          </Typography>
        </Button>
        {this.state.adminDeleteExpanded !== undefined && (
          <CommentDelete
            key={this.props.comment.commentId}
            server={this.props.server}
            comment={this.props.comment}
            asAdmin={true}
            open={this.state.adminDeleteExpanded}
            onClose={() => this.setState({ adminDeleteExpanded: false })}
            onDelete={() => {
              this.setState({ adminDeleteExpanded: false });
              this.props.onUpdated && this.props.onUpdated();
            }}
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
            onUpdated={this.props.onUpdated}
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
    if (!this.props.comment || this.props.hideAuthor) return null;
    if (!this.props.comment.authorUserId || !this.props.comment.authorName) {
      return (
        <Typography key='author' className={`${this.props.classes.barItem} ${this.props.classes.unknownUser}`} variant='caption'>
          Unknown
        </Typography>
      );
    }

    return (
      <Typography key='author' className={this.props.classes.barItem} style={{ margin: 0, }} variant='caption'>
        <UserDisplay
          onClick={this.props.onAuthorClick}
          user={{
            userId: this.props.comment.authorUserId,
            name: this.props.comment.authorName,
            isMod: this.props.comment.authorIsMod
          }}
        />
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
}

export default withStyles(styles, { withTheme: true })(withRouter(Comment));
