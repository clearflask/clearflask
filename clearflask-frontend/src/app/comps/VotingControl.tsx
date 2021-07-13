import { darken, Typography } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import DownvoteIcon from '@material-ui/icons/ArrowDownwardRounded';
import UpvoteIcon from '@material-ui/icons/ArrowUpwardRounded';
import PositiveSelectedIcon from '@material-ui/icons/Favorite';
import PositiveIcon from '@material-ui/icons/FavoriteBorder';
import NegativeSelectedIcon from '@material-ui/icons/ThumbDown';
import NegativeIcon from '@material-ui/icons/ThumbDownOutlined';
import classNames from 'classnames';
import React, { Component } from 'react';
import * as Client from '../../api/client';
import MyButton from './MyButton';

const styles = (theme: Theme) => createStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  voteButtonDownWithoutValue: {
    marginTop: -8,
  },
  voteUpvoted: {
    color: theme.palette.primary.main + '!important', // important overrides disabled
  },
  voteDownvoted: {
    color: darken(theme.palette.error.dark, 0.3) + '!important', // important overrides disabled
  },
  voteValue: {
    lineHeight: '1em',
    fontSize: '0.9em',
  },
  voteValueStandalone: {
    padding: theme.spacing(0.25, 0),
    border: '1px solid rgba(0,0,0,0.02)',
    borderLeft: 'none',
    borderRight: 'none',
  },
  invisible: {
    visibility: 'hidden',
  },
  hidden: {
    visibility: 'hidden',
    height: 1,
  },
  voteButtonUpvoteBesideDownvoteButton: {
    // borderRight: 'none !important',
    // paddingRight: theme.spacing(0.7),
    // borderTopRightRadius: 0,
    // borderBottomRightRadius: 0,
  },
  voteButtonDownvote: {
    // paddingLeft: theme.spacing(0.7),
    // borderLeft: 'none !important',
    // borderTopLeftRadius: 0,
    // borderBottomLeftRadius: 0,
  },
  readOnlyContainer: {
    display: 'flex',
    alignItems: 'center',
    whiteSpace: 'nowrap',
    margin: theme.spacing(0.5),
  },
  voteButtonWantThis: {
  },
  voteButtonPositive: {
  },
  voteButtonPositiveUpvoted: {
    color: theme.palette.primary.main,
  },
  voteButtonNegative: {
  },
  voteButtonNegativeDownvoted: {
    color: darken(theme.palette.error.dark, 0.3),
  },
});

interface Props {
  className?: string;
  vote?: Client.VoteOption;
  hidden?: boolean;
  voteValue?: number;
  isSubmittingVote?: Client.VoteOption;
  votingAllowed?: boolean;
  onlyShowCount?: boolean;
  onUpvote?: () => void;
  iWantThis?: Client.VotingIWantThis;
  onDownvote?: () => void;
}

class VotingControl extends Component<Props & WithStyles<typeof styles, true>> {

  render() {
    if (!this.props.votingAllowed || this.props.onlyShowCount || !this.props.onUpvote) {
      return this.renderVotingCount();
    }

    if (this.props.iWantThis) {
      return this.renderIWantThis();
    }

    return this.renderVotingButtons();
  }

  renderVotingCount() {
    const Icon = (this.props.voteValue || 0) >= 0
      ? (this.props.iWantThis ? PositiveIcon : UpvoteIcon)
      : (this.props.iWantThis ? NegativeIcon : DownvoteIcon);
    return (
      <Typography className={this.props.classes.readOnlyContainer} variant='caption'>
        <Icon fontSize='inherit' />
        &nbsp;
        {Math.abs(this.props.voteValue || 0)}
      </Typography>
    );
  }

  renderVotingButtons() {
    const upvoted: boolean = this.props.vote === Client.VoteOption.Upvote;
    const downvoted: boolean = this.props.vote === Client.VoteOption.Downvote;

    const upvote = (
      <MyButton
        buttonVariant='post'
        Icon={UpvoteIcon}
        color={upvoted ? 'primary' : undefined}
        className={classNames(
          !!upvoted && this.props.classes.voteUpvoted,
          this.props.onDownvote !== undefined && this.props.classes.voteButtonUpvoteBesideDownvoteButton,
        )}
        onClick={this.props.onUpvote}
      >
        {this.props.onDownvote === undefined ? this.props.voteValue || 0 : undefined}
      </MyButton>
    );

    if (this.props.onDownvote === undefined) {
      return upvote;
    }

    return (
      <>
        {upvote}
        <span className={this.props.classes.voteValueStandalone}>
          {this.props.voteValue || 0}
        </span>
        <MyButton
          buttonVariant='post'
          Icon={DownvoteIcon}
          color={downvoted ? 'inherit' : undefined}
          className={classNames(
            this.props.classes.voteButtonDownvote,
            !!downvoted && this.props.classes.voteDownvoted,
          )}
          onClick={this.props.onDownvote}
        />
      </>
    );
  }

  renderIWantThis() {
    const upvoted: boolean = this.props.vote === Client.VoteOption.Upvote;
    const downvoted: boolean = this.props.vote === Client.VoteOption.Downvote;

    const upvote = (
      <MyButton
        buttonVariant='post'
        color={upvoted ? 'inherit' : undefined}
        Icon={upvoted ? PositiveSelectedIcon : PositiveIcon}
        className={classNames(
          this.props.classes.voteButtonWantThis,
          this.props.classes.voteButtonPositive,
          !!upvoted && this.props.classes.voteButtonPositiveUpvoted,
        )}
        onClick={this.props.onUpvote}
      >
        {this.props.iWantThis?.positiveLabel || 'Want'}
      </MyButton>
    );

    if (this.props.onDownvote === undefined) {
      return upvote;
    }

    return (
      <>
        {upvote}
        <MyButton
          buttonVariant='post'
          color={downvoted ? 'inherit' : undefined}
          Icon={downvoted ? NegativeSelectedIcon : NegativeIcon}
          className={classNames(
            this.props.classes.voteButtonWantThis,
            this.props.classes.voteButtonNegative,
            !!downvoted && this.props.classes.voteButtonNegativeDownvoted,
          )}
          onClick={this.props.onDownvote}
        >
          {this.props.iWantThis?.negativeLabel || 'Hate'}
        </MyButton>
      </>
    );
  }
}

export default withStyles(styles, { withTheme: true })(VotingControl);
