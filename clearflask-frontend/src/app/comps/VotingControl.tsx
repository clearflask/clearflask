import { Typography } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import DownvoteIcon from '@material-ui/icons/ArrowDownwardRounded';
import UpvoteIcon from '@material-ui/icons/ArrowUpwardRounded';
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
  voteVoted: {
    color: theme.palette.primary.main + '!important', // important overrides disabled
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
    borderRight: 'none !important',
    paddingRight: theme.spacing(0.7),
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
  },
  voteButtonDownvote: {
    // marginLeft: -1,
    paddingLeft: theme.spacing(0.7),
    borderLeft: 'none !important',
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
  },
  readOnlyContainer: {
    display: 'flex',
    alignItems: 'center',
    whiteSpace: 'nowrap',
    margin: theme.spacing(0.5),
  }
});

interface Props {
  className?: string;
  vote?: Client.VoteOption;
  hidden?: boolean;
  voteValue?: number;
  isSubmittingVote?: Client.VoteOption;
  votingAllowed?: boolean;
  hideControls?: boolean;
  onUpvote: () => void;
  onDownvote?: () => void;
}

class VotingControl extends Component<Props & WithStyles<typeof styles, true>> {

  render() {
    const upvoted: boolean = this.props.vote === Client.VoteOption.Upvote;
    const downvoted: boolean = this.props.vote === Client.VoteOption.Downvote;

    const votingAllowed = !!this.props.votingAllowed && !this.props.hideControls

    if (!votingAllowed) {
      const Icon = (this.props.voteValue || 0) >= 0 ? UpvoteIcon : DownvoteIcon;
      return (
        <Typography className={this.props.classes.readOnlyContainer} variant='caption'>
          <Icon fontSize='inherit' />
          &nbsp;
          {Math.abs(this.props.voteValue || 0)}
        </Typography>
      );
    }

    const upvote = (
      <MyButton
        buttonVariant='post'
        Icon={UpvoteIcon}
        color={upvoted ? 'primary' : undefined}
        className={classNames(
          !!upvoted && this.props.classes.voteVoted,
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
      <React.Fragment>
        {upvote}
        <span className={this.props.classes.voteValueStandalone}>
          {this.props.voteValue || 0}
        </span>
        <MyButton
          buttonVariant='post'
          Icon={DownvoteIcon}
          color={downvoted ? 'primary' : undefined}
          className={classNames(
            this.props.classes.voteButtonDownvote,
            !!downvoted && this.props.classes.voteVoted,
          )}
          onClick={this.props.onDownvote}
        />
      </React.Fragment>
    );
  }
}

export default withStyles(styles, { withTheme: true })(VotingControl);
