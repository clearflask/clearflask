import { IconButton, Typography } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import DownvoteIcon from '@material-ui/icons/ArrowDropDownRounded';
import UpvoteIcon from '@material-ui/icons/ArrowDropUpRounded';
import React, { Component } from 'react';
import * as Client from '../../api/client';

const styles = (theme: Theme) => createStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  voteIconButton: {
    fontSize: '2em',
    padding: '0px',
    color: theme.palette.text.hint,
  },
  voteIconButtonUp: {
    borderRadius: '80% 80% 50% 50%',
  },
  voteIconButtonDown: {
    borderRadius: '50% 50% 80% 80%',
  },
  voteIconButtonDownWithoutValue: {
    marginTop: -8,
  },
  voteIconVoted: {
    color: theme.palette.primary.main + '!important', // important overrides disabled
    transform: 'scale(1.25)',
  },
  voteValue: {
    lineHeight: '1em',
    fontSize: '0.9em',
  },
  hidden: {
    visibility: 'hidden',
    height: 1,
  },
});

interface Props {
  className?: string;
  vote?: Client.VoteOption;
  hidden?: boolean;
  voteValue?: number;
  isSubmittingVote?: Client.VoteOption;
  votingAllowed?: boolean
  onUpvote: () => void;
  onDownvote?: () => void;
}

class VotingControl extends Component<Props & WithStyles<typeof styles, true>> {

  render() {
    const upvoted: boolean = this.props.vote === Client.VoteOption.Upvote;
    const downvoted: boolean = this.props.vote === Client.VoteOption.Downvote;

    return (
      <div className={`${this.props.classes.container} ${this.props.hidden ? this.props.classes.hidden : ''} ${this.props.className || ''}`}>
        <IconButton
          color={upvoted ? 'primary' : undefined}
          className={`${this.props.classes.voteIconButton} ${this.props.classes.voteIconButtonUp} ${upvoted ? this.props.classes.voteIconVoted : ''}`}
          disabled={!this.props.votingAllowed}
          onClick={this.props.votingAllowed ? this.props.onUpvote.bind(this) : undefined}
        >
          <UpvoteIcon fontSize='inherit' />
        </IconButton>
        {this.props.voteValue !== undefined && (
          <Typography variant='overline' className={this.props.classes.voteValue}>
            {this.props.voteValue}
          </Typography>
        )}
        {this.props.onDownvote !== undefined && (
          <IconButton
            color={downvoted ? 'primary' : undefined}
            className={`${this.props.classes.voteIconButton} ${this.props.classes.voteIconButtonDown} ${downvoted ? this.props.classes.voteIconVoted : ''} ${this.props.voteValue === undefined ? this.props.classes.voteIconButtonDownWithoutValue : ''}`}
            disabled={!this.props.votingAllowed}
            onClick={this.props.votingAllowed ? this.props.onDownvote.bind(this) : undefined}
          >
            <DownvoteIcon fontSize='inherit' />
          </IconButton>
        )}
      </div>
    );
  }
}

export default withStyles(styles, { withTheme: true })(VotingControl);
