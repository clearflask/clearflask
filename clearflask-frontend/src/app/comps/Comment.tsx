import { Typography } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import SpeechIcon from '@material-ui/icons/ChatBubbleOutlineRounded';
import DeletedIcon from '@material-ui/icons/Clear';
import DeleteIcon from '@material-ui/icons/DeleteOutline';
import EditIcon from '@material-ui/icons/Edit';
import MergeIcon from '@material-ui/icons/MergeType';
import classNames from 'classnames';
import React, { Component } from 'react';
import { RouteComponentProps, withRouter } from 'react-router';
import { Link } from 'react-router-dom';
import TimeAgo from 'react-timeago';
import * as Client from '../../api/client';
import { cssBlurry, Server } from '../../api/server';
import HelpPopper from '../../common/HelpPopper';
import RichViewer from '../../common/RichViewer';
import TruncateFade from '../../common/TruncateFade';
import UserWithAvatarDisplay from '../../common/UserWithAvatarDisplay';
import { notEmpty } from '../../common/util/arrayUtil';
import { preserveEmbed } from '../../common/util/historyUtil';
import Delimited from '../utils/Delimited';
import CommentEdit, { CommentDelete } from './CommentEdit';
import MyButton from './MyButton';
import { MaxContentWidth } from './Post';
import { OutlinePostContent } from './PostAsLink';
import VotingControl from './VotingControl';

const styles = (theme: Theme) => createStyles({
  comment: {
    width: MaxContentWidth,
    maxWidth: 'max-content',
    display: 'flex',
    flexDirection: 'column',
    marginTop: theme.spacing(2),
  },
  content: {
    minWidth: 0,
  },
  votingControl: {
    margin: theme.spacing(0, 4),
    position: 'relative',
  },
  votingControlDeletedIcon: {
    fontSize: '1.7rem',
    color: theme.palette.grey[theme.palette.type === 'light' ? 200 : 600],
  },
  votingControlDeletedContainer: {
    display: 'flex',
    margin: theme.spacing(0.5),
    alignItems: 'center',
  },
  votingControlDeletedIconContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 50,
    height: '100%',
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
  barLineHeader: {
    display: 'flex',
    alignItems: 'baseline',
  },
  barLine: {
    display: 'flex',
    alignItems: 'center',
  },
  commentDeleted: {
    color: theme.palette.text.hint,
  },
  created: {
    color: theme.palette.text.hint,
  },
  edited: {
    color: theme.palette.text.hint,
    fontStyle: 'italic',
  },
  grow: {
    flexGrow: 1,
  },
  pre: {
    whiteSpace: 'pre-wrap',
  },
  authorContainer: {
    position: 'relative',
  },
  blurry: {
    ...cssBlurry,
  },
  mergeIcon: {
    color: theme.palette.text.hint,
    fontSize: '1.4em',
  },
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
  hideControls?: boolean;
  disableOnClick?: boolean;
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

    if (!!this.props.comment && !this.props.comment.content) {
      content = (
        <div className={this.props.classes.votingControlDeletedContainer}>
          <div className={this.props.classes.votingControlDeletedIconContainer}>
            <DeletedIcon fontSize='inherit' className={this.props.classes.votingControlDeletedIcon} />
          </div>
          {content}
        </div>
      );
    }

    content = (
      <>
        <div>{this.renderHeader()}</div>
        {content}
        <div>{this.renderBottomBar()}</div>
      </>
    );

    if (this.props.comment?.mergedPostId) {
      content = (
        <OutlinePostContent>
          {content}
        </OutlinePostContent>
      );
    }

    content = (
      <div className={classNames(this.props.classes.comment, this.props.className)}>
        {content}
      </div>
    );

    return content;
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
      const title = this.props.comment.mergedPostTitle !== undefined && (
        <Typography variant='h5'>{this.props.comment.mergedPostTitle}</Typography>
      );
      return (
        <Typography variant={variant} className={`${this.props.classes.pre} ${this.props.isBlurry ? this.props.classes.blurry : ''}`}>
          {title}
          {content}
        </Typography>
      );
    }
  }

  renderVotingControl() {
    if (!this.props.comment?.content) return null;
    return (
      <VotingControl
        vote={this.props.comment.vote}
        voteValue={this.props.comment.voteValue || 0}
        isSubmittingVote={this.state.isSubmittingVote}
        votingAllowed={!!this.props.comment && !this.props.comment.mergedPostId}
        onlyShowCount={!!this.props.hideControls}
        onUpvote={() => this.voteUpdate(this.props.comment?.vote === Client.VoteOption.Upvote ? Client.VoteOption.None : Client.VoteOption.Upvote)}
        onDownvote={() => this.voteUpdate(this.props.comment?.vote === Client.VoteOption.Downvote ? Client.VoteOption.None : Client.VoteOption.Downvote)}
      />
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

  renderHeader() {
    if (!this.props.comment) return null;

    const content = [
      this.renderMerged(),
      this.renderAuthor(),
      this.renderCreatedDatetime(),
      this.renderEdited(),
    ].filter(notEmpty);
    if (content.length === 0) return null;

    return (
      <div className={this.props.classes.barLineHeader}>
        <Delimited delimiter={(<>&nbsp;&nbsp;</>)}>
          {content}
        </Delimited>
      </div>
    );
  }

  renderBottomBar() {
    if (!this.props.comment) return null;

    const leftSide = [
      this.renderVotingControl(),
    ].filter(notEmpty);

    const rightSide = [
      this.renderReply(),
      this.renderAdminDelete(),
      this.renderEdit(),
    ].filter(notEmpty);

    if ((leftSide.length + rightSide.length) === 0) return null;

    return (
      <div className={this.props.classes.barLine}>
        <div className={this.props.classes.barLine}>
          <Delimited delimiter=' '>
            {leftSide}
          </Delimited>
        </div>
        <div className={this.props.classes.grow} />
        <div className={this.props.classes.barLine}>
          <Delimited delimiter=' '>
            {rightSide}
          </Delimited>
        </div>
      </div>
    );
  }

  renderReply() {
    if (!this.props.onReplyClicked) return null;

    return (
      <MyButton
        key='reply'
        buttonVariant='post'
        Icon={SpeechIcon}
        disabled={!!this.props.replyOpen}
        onClick={e => this.props.onReplyClicked && this.props.onReplyClicked()}
      >
        Reply
      </MyButton>
    );
  }

  renderAdminDelete() {
    if (!this.props.comment
      || !this.props.comment.authorUserId
      || !!this.props.comment.mergedPostId
      || !this.props.server.isModOrAdminLoggedIn()
      // Only show admin delete if the regular edit is not shown as it already contains a delete
      || (this.props.loggedInUser && this.props.comment.authorUserId === this.props.loggedInUser.userId)) return null;

    return (
      <React.Fragment key='adminDelete'>
        <MyButton
          buttonVariant='post'
          Icon={DeleteIcon}
          onClick={e => this.setState({ adminDeleteExpanded: !this.state.adminDeleteExpanded })}
        >
          Delete
        </MyButton>
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
      || !!this.props.comment.mergedPostId
      || !(this.props.loggedInUser && this.props.comment.authorUserId === this.props.loggedInUser.userId)) return null;

    return (
      <React.Fragment key='edit'>
        <MyButton
          buttonVariant='post'
          Icon={EditIcon}
          onClick={e => this.setState({ editExpanded: !this.state.editExpanded })}
        >
          Edit
        </MyButton>
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

  renderMerged() {
    if (!this.props.comment?.mergedPostId) return null;

    return (
      <HelpPopper key='merged' description='This is a merged post'>
        <MergeIcon color='inherit' fontSize='inherit' className={this.props.classes.mergeIcon} />
      </HelpPopper>
    );
  }

  renderEdited() {
    if (!this.props.comment || !this.props.comment.edited) return null;

    return (
      <Typography key='edited' className={`${this.props.classes.barItem} ${this.props.classes.edited}`} variant='caption'>
        {!this.props.comment.authorUserId ? 'Deleted' : 'Edited'}
        &nbsp;
        <TimeAgo date={this.props.comment.edited} />
      </Typography>
    );
  }

  renderAuthor() {
    if (!this.props.comment || this.props.hideAuthor) return null;

    const user = (!this.props.comment.authorUserId || !this.props.comment.authorName) ? undefined : {
      userId: this.props.comment.authorUserId,
      name: this.props.comment.authorName,
      isMod: this.props.comment.authorIsMod
    };
    return (
      <div className={this.props.classes.authorContainer}>
        <UserWithAvatarDisplay
          key='author'
          onClick={this.props.onAuthorClick}
          user={user}
          baseline
        />
      </div>
    );
  }

  renderCreatedDatetime() {
    if (!this.props.comment) return null;

    return (
      <Typography key='created' className={classNames(this.props.classes.barItem, this.props.classes.created)} variant='caption'>
        <TimeAgo date={this.props.comment.created} />
      </Typography>
    );
  }
}

export default withStyles(styles, { withTheme: true })(withRouter(Comment));
