// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import { Slider, Typography } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import classNames from 'classnames';
import React, { Component } from 'react';
import ReactGA from 'react-ga';
import { withTranslation, WithTranslation } from 'react-i18next';
import { RouteComponentProps, withRouter } from 'react-router';
import * as Admin from '../api/admin';
import { isProd } from '../common/util/detectEnv';
import { trackingBlock } from '../common/util/trackingDelay';
import { PRE_SELECTED_BASE_PLAN_ID, PRE_SELECTED_PLAN_PRICE, SIGNUP_PROD_ENABLED } from './AccountEnterPage';
import { FlatYearlyStartingPrice } from './PricingPage';
import PricingPlan from './PricingPlan';

type Marks = Array<{ val: number, basePlanId?: string }>;
const startingStep = 12;
const pricePoints = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20, 25, 30, 40, 50, 60, 70, 80, 90, 100, 125, 150, 175, 200];
const SliderHangs = true;
const SliderHeight = 138;

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
    textAlign: 'left',
  },
  sliderContainer: {
    flex: '1',
    height: SliderHeight,
    width: '100%',
    position: 'relative',
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    padding: SliderHangs ? theme.spacing(4, 0) : undefined,
  },
  slider: {
  },
  floating: {
    position: 'relative',
    transition: theme.transitions.create(['bottom', 'transform'], {
      duration: theme.transitions.duration.shortest,
      easing: theme.transitions.easing.easeOut,
    }),
    transform: SliderHangs ? 'translateY(50%)' : undefined,
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
}
interface State {
  mauIndex: number;
  marks: Marks;
}
class PricingSlider extends Component<Props & RouteComponentProps & WithTranslation<'site'> & WithStyles<typeof styles, true>, State> {
  state: State = {
    mauIndex: startingStep,
    marks: this.getMarks(),
  };
  lastSelectedPlanid?: string;

  render() {
    if (this.props.plans.length === 0) return null;

    const mauIndex = this.state.mauIndex;
    const mauMark = this.state.marks[mauIndex];
    const standardPlan = this.props.plans.slice()
      .reverse()
      .find(p => !!p.pricing)!;
    const price = mauMark.val;
    const min = 0;
    const max = this.state.marks.length - 1;
    const sliderPercentage = `${mauIndex / (max - min) * 100}%`;

    return (
      <PricingPlan
        plan={standardPlan}
        customPrice={(
          <div>
            <div className={this.props.classes.sliderContainer}>
              <div className={classNames(this.props.classes.floating, this.props.classes.info)}
                style={{
                  bottom: sliderPercentage,
                  ...(SliderHangs ? {} : {
                    transform: `translateY(${sliderPercentage})`,
                  }),
                }}>
                <div className={this.props.classes.valueHorizontal}>
                  <Typography component='div' variant='subtitle2' color='textSecondary' style={{ alignSelf: 'flex-start' }}>{'$'}</Typography>
                  <Typography component='div' variant='h4'>{this.formatNumber(price)}</Typography>
                  <Typography component='div' variant='subtitle2' color='textSecondary'>/&nbsp;mo</Typography>
                </div>
                <Typography component='div' variant='subtitle2' color='textSecondary'>Billed annually</Typography>
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
            </div>
          </div>
        )}
        overridePerks={[
          { desc: 'Pay what you can afford' },
        ]}
        actionTitle={this.props.t('get-started') + '*'}
        remark={(
          <div className={this.props.classes.disclaimer}>
            <Typography variant='caption' component='div' color='textSecondary'>*&nbsp;</Typography>
            <Typography variant='caption' component='div' color='textSecondary'>
              Start a trial and we will approve<br />
              your price request shortly by email.
            </Typography>
          </div>
        )}
        actionOnClick={() => {
          trackingBlock(() => {
            ReactGA.event({
              category: 'pricing',
              action: 'click-plan',
              label: standardPlan.basePlanId,
              value: price,
            });
          });
        }}
        actionTo={(SIGNUP_PROD_ENABLED || !isProd())
          ? {
            pathname: '/signup',
            state: {
              [PRE_SELECTED_BASE_PLAN_ID]: standardPlan.basePlanId,
              [PRE_SELECTED_PLAN_PRICE]: price,
            },
          }
          : '/contact/sales'}

      />
    );
  }

  formatNumber(val: number): string {
    return val.toLocaleString('en-US');
  }

  getMarks(): Marks {
    var lastPlanIndex = 0;
    const points: Marks = pricePoints.map(price => {
      const plan = this.props.plans[lastPlanIndex];
      const planPrice = plan?.basePlanId === 'flat-yearly'
        ? FlatYearlyStartingPrice
        : plan?.pricing?.basePrice || 0;
      if (!!plan && price * 12 > planPrice) {
        lastPlanIndex++;
      }
      return { val: price, basePlanId: this.props.plans[lastPlanIndex]?.basePlanId };
    });

    return points;
  }
}

export default withStyles(styles, { withTheme: true })(withRouter(withTranslation('site', { withRef: true })(PricingSlider)));
