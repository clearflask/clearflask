import { darken, Typography } from '@material-ui/core';
import { createStyles, lighten, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import DownvoteIcon from '@material-ui/icons/ArrowDownwardRounded';
import UpvoteIcon from '@material-ui/icons/ArrowUpwardRounded';
import PositiveSelectedIcon from '@material-ui/icons/Favorite';
import PositiveIcon from '@material-ui/icons/FavoriteBorder';
import NegativeSelectedIcon from '@material-ui/icons/ThumbDown';
import NegativeIcon from '@material-ui/icons/ThumbDownOutlined';
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
  readOnlyContainer: {
    display: 'flex',
    alignItems: 'center',
    whiteSpace: 'nowrap',
    margin: theme.spacing(0.5),
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
        color={this.props.theme.palette.primary.main}
        colorHide={!upvoted}
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
          color={this.props.theme.palette.type === 'dark'
            ? lighten(this.props.theme.palette.error.dark, 0.3)
            : darken(this.props.theme.palette.error.dark, 0.3)}
          colorHide={!downvoted}
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
        color={this.props.theme.palette.primary.main}
        colorHide={!upvoted}
        Icon={upvoted ? PositiveSelectedIcon : PositiveIcon}
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
          color={this.props.theme.palette.type === 'dark'
            ? lighten(this.props.theme.palette.error.dark, 0.3)
            : darken(this.props.theme.palette.error.dark, 0.3)}
          colorHide={!downvoted}
          Icon={downvoted ? NegativeSelectedIcon : NegativeIcon}
          onClick={this.props.onDownvote}
        >
          {this.props.iWantThis?.negativeLabel || 'Hate'}
        </MyButton>
      </>
    );
  }
}

export default withStyles(styles, { withTheme: true })(VotingControl);
