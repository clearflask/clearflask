import React, { Component } from 'react';
import * as Client from '../../api/client';
import { Typography, CardActionArea, Grid, Button, IconButton, LinearProgress, Popover, Grow, Collapse, Chip } from '@material-ui/core';
import { withStyles, Theme, createStyles, WithStyles } from '@material-ui/core/styles';
import Loader from '../utils/Loader';
import { connect } from 'react-redux';
import { ReduxState, Server, Status } from '../../api/server';
import TimeAgo from 'react-timeago'
import CreditView from '../../common/config/CreditView';
import { withRouter, RouteComponentProps, matchPath } from 'react-router';
import Expander from '../../common/Expander';
import Delimited from '../utils/Delimited';
import Comment from './Comment';
import LogIn from './LogIn';
import AddEmojiIcon from '@material-ui/icons/InsertEmoticon';
import AddIcon from '@material-ui/icons/Add';
import { Picker, BaseEmoji } from 'emoji-mart';
import GradientFade from '../../common/GradientFade';
import { PopoverPosition } from '@material-ui/core/Popover';
import { fade } from '@material-ui/core/styles/colorManipulator';
import { withSnackbar, WithSnackbarProps } from 'notistack';

const styles = (theme:Theme) => createStyles({
  container: {
  },
  fundingAmount: {
    fontSize: '1.1em',
  },
  fundingGoal: {
    fontSize: '0.8em',
  },
  fundingAmountReached: {
    fontSize: '1.2em',
  },
  fundingGoalReached: {
    fontSize: '0.8em',
  },
  fundingBar: {
    backgroundColor: theme['custom'] && theme['custom'].funding || theme.palette.primary.main,
  },
  fundingDiffBar: {
    backgroundColor: fade(theme['custom'] && theme['custom'].funding || theme.palette.primary.main, 0.4),
  },
  fundingBarBackground: {
    animation: 'unset',
    backgroundImage: 'unset',
    backgroundColor: theme.palette.grey[theme.palette.type === 'light' ? 300 : 700],
  },
  fundingBarNoGoal: {
    background: `linear-gradient(to left, transparent 20px, ${theme['custom'] && theme['custom'].funding} 100%)`,
    opacity: 0.4,
  },
  fundingDiffBarNoGoal: {
    background: `linear-gradient(to left, transparent 20px, ${fade(theme['custom'] && theme['custom'].funding || theme.palette.primary.main, 0.4)} 100%)`,
    opacity: 0.4,
  },
  fundingBarBackgroundNoGoal: {
    backgroundImage: 'unset',
    background: `linear-gradient(to right, ${theme.palette.grey[theme.palette.type === 'light' ? 300 : 700]}, transparent 100%)`,
  },
});

interface Props {
  style?:React.CSSProperties;
  idea?:Client.Idea;
  credits?:Client.Credits;
  vote?:Client.Vote;
  maxFundAmountSeen:number;
  fundAmountDiff?:number;
}

class FundingBar extends Component<Props&WithStyles<typeof styles, true>> {

  render() {
    if(!this.props.idea
      || !this.props.credits) return null;

    const fundGoal = this.props.idea.fundGoal && this.props.idea.fundGoal > 0
      ? this.props.idea.fundGoal : undefined;
    const fundPerc = Math.floor(100 * (this.props.idea.funded || 0) / (fundGoal || this.props.maxFundAmountSeen));
    const fundPercOld = this.props.fundAmountDiff ? Math.floor(100 * ((this.props.idea.funded || 0) + this.props.fundAmountDiff) / (fundGoal || this.props.maxFundAmountSeen)) : fundPerc;
    const fundingReached = fundGoal ? ((this.props.idea.funded || 0) + (this.props.fundAmountDiff || 0)) >= fundGoal : false;
    const fundAmountDisplay = (
      <Typography variant='body1' inline>
        <span className={fundingReached ? this.props.classes.fundingAmountReached : this.props.classes.fundingAmount}>
          <CreditView val={(this.props.idea.funded || 0) + (this.props.fundAmountDiff || 0)} credits={this.props.credits} />
          {fundGoal && (<span>&nbsp;/&nbsp;</span>)}
        </span>
      </Typography>
    );
    const fundGoalDisplay = (
      <Typography variant='body1' inline>
        <span className={fundingReached ? this.props.classes.fundingGoalReached : this.props.classes.fundingGoal} style={{
          display: 'flex',
          alignItems: 'flex-end',
          lineHeight: 'normal',
        }}>
          {fundGoal && (<CreditView val={this.props.idea.fundGoal || 0} credits={this.props.credits} />)}
          &nbsp;raised
        </span>
      </Typography>
    );
    const fundPercDisplay = fundGoal && [
      <div style={{ flexGrow: 1 }}>&nbsp;</div>,
      <Typography variant='body1' inline>
        <span className={fundingReached ? this.props.classes.fundingGoalReached : this.props.classes.fundingGoal}>
          {fundPerc}
          &nbsp;%
        </span>
      </Typography>,
    ];
    return (
      <div style={this.props.style} className={this.props.classes.container}>
        <div style={{
          display: 'flex',
          alignItems: 'baseline',
        }}>
          {fundAmountDisplay}
          {fundGoalDisplay}
          {fundPercDisplay}
        </div>
        <LinearProgress
          variant='buffer'
          value={Math.min(fundPercOld, fundPerc, 100)}
          valueBuffer={Math.min(Math.max(fundPercOld, fundPerc), 100)}
          className={this.props.classes.fundingBar}
          classes={{
            colorPrimary: fundGoal ? this.props.classes.fundingDiffBar : this.props.classes.fundingDiffBarNoGoal,
            barColorPrimary: fundGoal ? this.props.classes.fundingBar : this.props.classes.fundingBarNoGoal,
            dashedColorPrimary: fundGoal ? this.props.classes.fundingBarBackground : this.props.classes.fundingBarBackgroundNoGoal,
          }}
        />
      </div>
    );
  }
}

export default withStyles(styles, { withTheme: true })(FundingBar);
