import { Button, Slider, Typography } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import classNames from 'classnames';
import React, { Component } from 'react';
import { RouteComponentProps, withRouter } from 'react-router';
import { Link } from 'react-router-dom';
import * as Admin from '../api/admin';

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
  plans: Admin.Plan[];
  estimatedPercUsersBecomeActive: number;
}
interface State {
  mauIndex: number;
  marks: Array<number>;
}
class PricingSlider extends Component<Props & RouteComponentProps & WithStyles<typeof styles, true>, State> {
  state: State = {
    mauIndex: 6,
    marks: this.getMarks(),
  };

  render() {
    if (this.props.plans.length === 0) return null;

    const mauIndex = this.state.mauIndex;

    const callForQuote = mauIndex >= this.state.marks.length;
    const mau = callForQuote
      ? this.state.marks[this.state.marks.length - 1]
      : this.state.marks[mauIndex];

    var plan: Admin.Plan | undefined;
    this.props.plans.forEach(p => {
      if (!plan
        || (p.pricing && p.pricing!.baseMau < mau && mau <= p.pricing.baseMau)) {
        plan = p;
      }
    });
    if (!plan) return null;
    const pricing: Admin.PlanPricing = plan.pricing!;

    const monthlyUsers = Math.round(mau / this.props.estimatedPercUsersBecomeActive);

    const addtPrice = Math.ceil(Math.max(0, mau - pricing.baseMau) / pricing.unitMau) * pricing.unitPrice;
    const price = pricing.basePrice + addtPrice;

    const min = 0;
    const max = this.state.marks.length;

    const bottom = `${mauIndex / (max - min) * 100}%`;
    return (
      <div className={this.props.classes.container}>
        <div className={this.props.classes.sliderContainer}>
          <div className={classNames(this.props.classes.floating, this.props.classes.info)} style={{ bottom }}>
            <div className={this.props.classes.valueHorizontal}>
              <Typography variant='h6' component='div' style={{ visibility: 'hidden' }}>+</Typography>
              <Typography variant='h6' component='div'>{this.formatNumber(monthlyUsers)}</Typography>
              <Typography variant='h6' component='div' style={{ visibility: callForQuote ? 'visible' : 'hidden' }}>+</Typography>
            </div>
            <div className={this.props.classes.valueHorizontal}>
              <Typography variant='caption' component='div'>Monthly Unique Visitors</Typography>
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
            onChange={(e, val) => this.setState({ mauIndex: (val as any as number) })}
          />
          <div className={classNames(this.props.classes.floating, this.props.classes.info)} style={{ bottom }}>
            {callForQuote ? (
              <Button
                color='primary'
                component={Link}
                to='/contact/sales'
              >Talk to us</Button>
            ) : (
                <React.Fragment>
                  <div className={this.props.classes.valueHorizontal}>
                    <Typography component='div' variant='subtitle2' color='textSecondary' style={{ alignSelf: 'flex-start' }}>{'$'}</Typography>
                    <Typography component='div' variant='h4'>{this.formatNumber(price)}</Typography>
                    <Typography component='div' variant='subtitle2' color='textSecondary'>/&nbsp;mo</Typography>
                  </div>
                  <Typography component='div' variant='subtitle2' color='textSecondary'>{this.formatNumber(mau)}&nbsp;MAU*</Typography>
                </React.Fragment>
              )}
          </div>
        </div>
        <div className={this.props.classes.disclaimer}>
          <Typography variant='caption' component='div' color='textSecondary'>*&nbsp;</Typography>
          <Typography variant='caption' component='div' color='textSecondary'>Typically about {this.props.estimatedPercUsersBecomeActive * 100}% of your monthly unique visitors will provide feedback every month</Typography>
        </div>
      </div>
    );
  }

  formatNumber(val: number): string {
    return val.toLocaleString('en-US');
  }

  getMarks() {
    var fractionsToInclude = 2;
    var currMaxMau = 2001;
    const points = this.props.plans.slice().reverse().flatMap(plan => {
      const pts: Array<number> = [];
      if (!plan.pricing) return pts;

      // TODO
      var currPt: number = plan.pricing.baseMau;
      while (currPt < currMaxMau) {
        pts.push(currPt);
        currPt += plan.pricing.unitMau;
      }

      currMaxMau = plan.pricing.baseMau;
      return pts;
    });
    points.sort((l, r) => l - r);
    while (fractionsToInclude > 0) {
      points.unshift(points[0] / 2);
      fractionsToInclude--;
    }
    return points;
  }
}

export default withStyles(styles, { withTheme: true })(withRouter(PricingSlider));
