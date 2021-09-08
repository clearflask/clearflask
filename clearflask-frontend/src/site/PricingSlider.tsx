// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
import { Button, Slider, Typography } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import classNames from 'classnames';
import React, { Component } from 'react';
import { RouteComponentProps, withRouter } from 'react-router';
import { Link } from 'react-router-dom';
import * as Admin from '../api/admin';
import { EstimatedPercUsersBecomeTracked } from './PricingPage';

type Marks = Array<{ val: number, basePlanId: string }>;
const quadrupleStepAfterIteration = 100;
const maxMau = 5001;
const startingStep = 10;
const callForQuoteCount = 5;

const styles = (theme: Theme) => createStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    height: '100%',
    minHeight: 300,
  },
  disclaimer: {
    marginTop: theme.spacing(1),
    display: 'flex',
    alignItems: 'baseline',
  },
  sliderContainer: {
    flex: '1',
    height: '100%',
    width: '100%',
    position: 'relative',
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    padding: theme.spacing(4, 0),
  },
  slider: {
  },
  floating: {
    position: 'relative',
    transition: theme.transitions.create(['bottom'], {
      duration: theme.transitions.duration.shortest,
      easing: theme.transitions.easing.easeOut,
    }),
    transform: 'translateY(50%)',
    flex: '1',
    overflow: 'visible',
  },
  info: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
  },
  valueHorizontal: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'baseline',
  },
});
interface Props {
  className: string;
  plans: Admin.Plan[];
  onSelectedPlanChange: (basePlanId: string, callForQuote: boolean) => void;
}
interface State {
  mauIndex: number;
  marks: Marks;
}
class PricingSlider extends Component<Props & RouteComponentProps & WithStyles<typeof styles, true>, State> {
  state: State = {
    mauIndex: startingStep,
    marks: this.getMarks(),
  };
  lastSelectedPlanid?: string;
  lastCallForQuote?: boolean;

  render() {
    if (this.props.plans.length === 0) return null;

    const mauIndex = this.state.mauIndex;

    const callForQuote = mauIndex >= this.state.marks.length - callForQuoteCount;
    const mauMark = this.state.marks[mauIndex];
    const mau = mauMark.val;

    const plan = this.props.plans.find(p => p.basePlanId === mauMark.basePlanId);
    if (!plan) return null;

    if (this.lastSelectedPlanid !== plan.basePlanId
      || this.lastCallForQuote !== callForQuote) {
      this.props.onSelectedPlanChange(plan.basePlanId, callForQuote);
      this.lastSelectedPlanid = plan.basePlanId;
      this.lastCallForQuote = callForQuote;
    }

    const pricing: Admin.PlanPricing = plan.pricing!;

    const monthlyUsers = Math.round(mau / EstimatedPercUsersBecomeTracked);

    const addtPrice = Math.ceil(Math.max(0, mau - pricing.baseMau) / pricing.unitMau) * pricing.unitPrice;
    const price = pricing.basePrice + addtPrice;

    const min = 0;
    const max = this.state.marks.length - 1;

    const bottom = `${mauIndex / (max - min) * 100}%`;
    return (
      <div className={classNames(this.props.className, this.props.classes.container)}>
        <div className={this.props.classes.sliderContainer}>
          <div className={classNames(this.props.classes.floating, this.props.classes.info)} style={{ bottom }}>
            <div className={this.props.classes.valueHorizontal}>
              <Typography variant='h6' component='div' style={{ visibility: 'hidden' }}>+</Typography>
              <Typography variant='h6' component='div'>{this.formatNumber(monthlyUsers)}</Typography>
              <Typography variant='h6' component='div' style={{ visibility: (callForQuote && (mauIndex === this.state.marks.length - 1)) ? 'visible' : 'hidden' }}>+</Typography>
            </div>
            <div className={this.props.classes.valueHorizontal}>
              <Typography variant='caption' component='div'>Total users</Typography>
            </div>
          </div>
          <Slider
            key='slider'
            className={this.props.classes.slider}
            value={mauIndex}
            min={min}
            step={1}
            orientation='vertical'
            max={max}
            onChange={(e, val) => {
              this.setState({ mauIndex: (val as any as number) })
            }}
          />
          <div className={classNames(this.props.classes.floating, this.props.classes.info)} style={{ bottom }}>
            {callForQuote ? (
              <Button
                color='primary'
                component={Link}
                to='/contact/sales'
              >Talk to us</Button>
            ) : (
              <>
                <div className={this.props.classes.valueHorizontal}>
                  <Typography component='div' variant='subtitle2' color='textSecondary' style={{ alignSelf: 'flex-start' }}>{'$'}</Typography>
                  <Typography component='div' variant='h4'>{this.formatNumber(price)}</Typography>
                  <Typography component='div' variant='subtitle2' color='textSecondary'>/&nbsp;mo</Typography>
                </div>
                <Typography component='div' variant='subtitle2' color='textSecondary'>{this.formatNumber(mau)}&nbsp;tracked*</Typography>
              </>
            )}
          </div>
        </div>
        <div className={this.props.classes.disclaimer}>
          <Typography variant='caption' component='div' color='textSecondary'>*&nbsp;</Typography>
          <Typography variant='caption' component='div' color='textSecondary'>
            Typically about {EstimatedPercUsersBecomeTracked * 100}% of your total users will become tracked
          </Typography>
        </div>
      </div>
    );
  }

  formatNumber(val: number): string {
    return val.toLocaleString('en-US');
  }

  getMarks(): Marks {
    var fractionsToInclude = 1;
    var currMaxMau = maxMau;
    const points = this.props.plans.slice().reverse().flatMap(plan => {
      var step = 1;
      const pts: Marks = [];
      if (!plan.pricing) return pts;

      var currPt: number = plan.pricing.baseMau;
      while (currPt < currMaxMau) {
        pts.push({ val: currPt, basePlanId: plan.basePlanId });
        currPt += plan.pricing.unitMau;
        if (step++ >= quadrupleStepAfterIteration) {
          currPt += plan.pricing.unitMau;
          currPt += plan.pricing.unitMau;
          currPt += plan.pricing.unitMau;
        }
      }

      currMaxMau = plan.pricing.baseMau;
      return pts;
    });
    points.sort((l, r) => l.val - r.val);
    while (fractionsToInclude > 0) {
      points.unshift({ val: points[0].val / 2, basePlanId: points[0].basePlanId });
      fractionsToInclude--;
    }
    return points;
  }
}

export default withStyles(styles, { withTheme: true })(withRouter(PricingSlider));
