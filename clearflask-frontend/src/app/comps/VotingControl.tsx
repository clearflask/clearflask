// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import { darken, Typography } from '@material-ui/core';
import { createStyles, lighten, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import DownvoteIcon from '@material-ui/icons/ArrowDownwardRounded';
import UpvoteIcon from '@material-ui/icons/ArrowUpwardRounded';
import PositiveSelectedIcon from '@material-ui/icons/Favorite';
import PositiveIcon from '@material-ui/icons/FavoriteBorder';
import VotersIcon from '@material-ui/icons/PeopleAlt';
import NegativeSelectedIcon from '@material-ui/icons/ThumbDown';
import NegativeIcon from '@material-ui/icons/ThumbDownOutlined';
import React, { Component } from 'react';
import { withTranslation, WithTranslation } from 'react-i18next';
import * as Client from '../../api/client';
import { Server } from '../../api/server';
import ClosablePopper from '../../common/ClosablePopper';
import MyButton from './MyButton';
import VotersList from './VotersList';

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
  server: Server;
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
  showVotersForPostId?: string;
}
interface State {
  votersAnchorEl?: HTMLElement;
}
class VotingControl extends Component<Props & WithTranslation<'app'> & WithStyles<typeof styles, true>, State> {
  state: State = {};

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

    return (
      <>
        <MyButton
          buttonVariant='post'
          Icon={UpvoteIcon}
          color={this.props.theme.palette.primary.main}
          colorHide={!upvoted}
          onClick={this.props.onUpvote}
        >
          {this.props.onDownvote === undefined ? this.props.voteValue || 0 : undefined}
        </MyButton>
        {!!this.props.onDownvote && (
          <>
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
        )}
        {this.renderVotersList(false)}
      </>
    );
  }

  renderIWantThis() {
    const upvoted: boolean = this.props.vote === Client.VoteOption.Upvote;
    const downvoted: boolean = this.props.vote === Client.VoteOption.Downvote;

    return (
      <>
        <MyButton
          buttonVariant='post'
          color={this.props.theme.palette.primary.main}
          colorHide={!upvoted}
          Icon={upvoted ? PositiveSelectedIcon : PositiveIcon}
          onClick={this.props.onUpvote}
        >
          {this.props.t(this.props.iWantThis?.positiveLabel as any || 'want')}
        </MyButton>
        {!!this.props.onDownvote && (
          <MyButton
            buttonVariant='post'
            color={this.props.theme.palette.type === 'dark'
              ? lighten(this.props.theme.palette.error.dark, 0.3)
              : darken(this.props.theme.palette.error.dark, 0.3)}
            colorHide={!downvoted}
            Icon={downvoted ? NegativeSelectedIcon : NegativeIcon}
            onClick={this.props.onDownvote}
          >
            {this.props.t(this.props.iWantThis?.negativeLabel as any || 'hate')}
          </MyButton>
        )}
        {this.renderVotersList(true)}
      </>
    );
  }

  renderVotersList(showCount: boolean): React.ReactNode {
    if (!this.props.showVotersForPostId || !this.props.server.isModOrAdminLoggedIn()) {
      return null;
    }
    return (
      <>
        <MyButton
          buttonVariant='post'
          Icon={VotersIcon}
          onClick={e => this.setState({ votersAnchorEl: !!this.state.votersAnchorEl ? undefined : e.currentTarget })}
        >
          {showCount ? this.props.voteValue || 0 : undefined}
        </MyButton>
        <ClosablePopper
          anchorType='element'
          anchor={this.state.votersAnchorEl}
          open={!!this.state.votersAnchorEl}
          onClose={() => this.setState({ votersAnchorEl: undefined })}
          placement='bottom-end'
          arrow
          clickAway
          closeButtonPosition='disable'
        >
          {!!this.state.votersAnchorEl && (
            <VotersList
              postId={this.props.showVotersForPostId}
              server={this.props.server}
              isInsidePaper
            />
          )}
        </ClosablePopper>
      </>
    );
  }
}

export default withStyles(styles, { withTheme: true })(withTranslation('app', { withRef: true })(VotingControl));
