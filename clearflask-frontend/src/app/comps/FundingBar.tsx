import { LinearProgress, Typography } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import { fade } from '@material-ui/core/styles/colorManipulator';
import React, { Component } from 'react';
import * as Client from '../../api/client';
import CreditFractionView from '../../common/config/CreditFractionView';

export const FundingMaxWidth = 300;

const styles = (theme: Theme) => createStyles({
  container: {
    maxWidth: FundingMaxWidth,
  },
  fundingAmount: {
    fontSize: '1.2em',
  },
  fundingGoal: {
    fontSize: '0.8em',
    color: theme.palette.text.secondary,
  },
  fundingBarColorPrimary: {
    zIndex: 0,
  },
  fundingBarTransition: {
    transition: theme.transitions.create('transform', {
      duration: theme.transitions.duration.shortest,
      easing: theme.transitions.easing.easeOut,
    }),
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
    background: `linear-gradient(to left, transparent 20px, ${fade(theme['custom'] && theme['custom'].funding || theme.palette.primary.main, 0.4)} 100%)`,
  },
  fundingDiffBarNoGoal: {
    background: `linear-gradient(to left, transparent 20px, ${fade(theme['custom'] && theme['custom'].funding || theme.palette.primary.main, 0.4)} 100%)`,
  },
  fundingBarBackgroundNoGoal: {
    background: `linear-gradient(to right, ${theme.palette.grey[theme.palette.type === 'light' ? 300 : 700]}, transparent 100%)`,
  },
  fundingBufferUndash: {
    backgroundImage: 'unset',
  },
});

interface Props {
  fundingBarRef?: React.Ref<HTMLDivElement>;
  style?: React.CSSProperties;
  idea?: Client.Idea;
  credits?: Client.Credits;
  maxFundAmountSeen: number;
  fundAmountDiff?: number;
  /** If set, shown on the right side of the bar, otherwise a percentage is shown */
  overrideRight?: React.ReactNode;
}

class FundingBar extends Component<Props & WithStyles<typeof styles, true>> {

  render() {
    if (!this.props.idea
      || !this.props.credits) return null;

    const fundGoal = this.props.idea.fundGoal && this.props.idea.fundGoal > 0
      ? this.props.idea.fundGoal : undefined;
    const fundPerc = Math.floor(100 * (this.props.idea.funded || 0) / (fundGoal || this.props.maxFundAmountSeen));
    const fundPercNew = this.props.fundAmountDiff ? Math.floor(100 * ((this.props.idea.funded || 0) + this.props.fundAmountDiff) / (fundGoal || this.props.maxFundAmountSeen)) : fundPerc;
    const fundFractionDisplay = (
      <CreditFractionView
        numerator={(this.props.idea.funded || 0) + (this.props.fundAmountDiff || 0)}
        numeratorClassName={this.props.classes.fundingAmount}
        denominator={this.props.idea.fundGoal}
        denominatorClassName={this.props.classes.fundingGoal}
        additionalSuffix='raised'
        credits={this.props.credits}
      />
    );
    const fundRightSide = this.props.overrideRight || fundGoal && (
      <Typography variant='body1'>
        <span className={this.props.classes.fundingGoal}>
          {fundPercNew}
          &nbsp;%
        </span>
      </Typography>
    );
    return (
      <div ref={this.props.fundingBarRef} style={this.props.style} className={this.props.classes.container}>
        <div style={{
          display: 'flex',
          alignItems: 'baseline',
        }}>
          {fundFractionDisplay}
          <div style={{ flexGrow: 1 }}>&nbsp;</div>
          {fundRightSide}
        </div>
        <LinearProgress
          variant='buffer'
          value={Math.min(fundPercNew, fundPerc, 100)}
          valueBuffer={Math.min(Math.max(fundPercNew, fundPerc), 100)}
          classes={{
            bar2Buffer: `${this.props.classes.fundingBarTransition} ${fundGoal ? this.props.classes.fundingDiffBar : this.props.classes.fundingDiffBarNoGoal}`,
            barColorPrimary: `${this.props.classes.fundingBarColorPrimary} ${this.props.classes.fundingBarTransition} ${fundGoal ? this.props.classes.fundingBar : this.props.classes.fundingBarNoGoal}`,
            dashedColorPrimary: this.props.classes.fundingBufferUndash,
            root: fundGoal ? this.props.classes.fundingBarBackground : this.props.classes.fundingBarBackgroundNoGoal,
          }}
        />
      </div>
    );
  }
}

export default withStyles(styles, { withTheme: true })(FundingBar);
