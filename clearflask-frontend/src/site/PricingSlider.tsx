// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import { Slider, Typography } from '@material-ui/core';
import { Theme, WithStyles, createStyles, withStyles } from '@material-ui/core/styles';
import classNames from 'classnames';
import { Component } from 'react';
import ReactGA from 'react-ga';
import ReactGA4 from 'react-ga4';
import { WithTranslation, withTranslation } from 'react-i18next';
import { RouteComponentProps, withRouter } from 'react-router';
import * as Admin from '../api/admin';
import { isProd } from '../common/util/detectEnv';
import { trackingBlock } from '../common/util/trackingDelay';
import { PRE_SELECTED_BASE_PLAN_ID, PRE_SELECTED_PLAN_PRICE, SIGNUP_PROD_ENABLED } from './AccountEnterPage';
import PricingPlan from './PricingPlan';

const startingStep = 5;
// If min/max changed, also update PlanStore.java
const pricePoints = [1, 2, 3, 4, 5, 10, 15, 20, 30, 50, 75];
const SliderHangs = false;
const SliderHeight = 100;

const styles = (theme: Theme) => createStyles({
  container: {
    margin: theme.spacing(-3, 0, -1, 0),
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
    padding: SliderHangs ? theme.spacing(3, 0) : undefined,
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
  plan: Admin.Plan;
}
interface State {
  mauIndex: number;
}
class PricingSlider extends Component<Props & RouteComponentProps & WithTranslation<'site'> & WithStyles<typeof styles, true>, State> {
  state: State = {
    mauIndex: startingStep,
  };
  lastSelectedPlanid?: string;

  render() {
    const mauIndex = this.state.mauIndex;
    const price = pricePoints[mauIndex];
    const min = 0;
    const max = pricePoints.length - 1;
    const sliderPercentage = `${mauIndex / (max - min) * 100}%`;

    return (
      <PricingPlan
        plan={this.props.plan}
        customPrice={(
          <div className={this.props.classes.container}>
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
                {/* <Typography component='div' variant='subtitle2' color='textSecondary'>Billed monthly</Typography> */}
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
        selected
        actionTitle={this.props.t('get-started')}
        remark={this.props.t('free-14-day-trial')}
        actionOnClick={() => {
          trackingBlock(() => {
            [ReactGA4, ReactGA].forEach(ga =>
              ga.event({
                category: 'pricing',
                action: 'click-plan',
                label: this.props.plan.basePlanId,
                value: price,
              })
            );
          });
        }}
        actionTo={(SIGNUP_PROD_ENABLED || !isProd())
          ? {
            pathname: '/signup',
            state: {
              [PRE_SELECTED_BASE_PLAN_ID]: this.props.plan.basePlanId,
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
}

export default withStyles(styles, { withTheme: true })(withRouter(withTranslation('site', { withRef: true })(PricingSlider)));
