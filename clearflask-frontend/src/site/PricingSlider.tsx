import { Slider, Mark } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import * as Admin from '../api/admin';

const styles = (theme: Theme) => createStyles({
});
interface Props {
  plans: Admin.Plan[];
}
interface State {
  mauIndex: number;
  marks: Array<number>;
}
class PricingSlider extends Component<Props & WithStyles<typeof styles, true>, State> {
  state: State = {
    mauIndex: 1,
    marks: this.getMarks(),
  };

  render() {
    if(this.props.plans.length === 0) return null;

    const mau = this.state.marks[this.state.mauIndex] || 0;

    var plan: Admin.Plan | undefined;
    this.props.plans.forEach(p => {
      if(!plan
        || (p.pricing && p.pricing!.baseMau < mau && mau <= p.pricing.baseMau)) {
        plan = p;
      }
    });
    if(!plan) return null;
    const pricing: Admin.PlanPricing = plan.pricing!;

    const percMuMau = 0.01;

    const monthlyUsers = Math.round(mau / percMuMau);

    const addtPrice =  Math.ceil(Math.max(0, mau - pricing.baseMau) / pricing.unitMau) * pricing.unitPrice;
    const price = pricing.basePrice + addtPrice;

    return (
      <div>
        <div>
          {this.formatNumber(monthlyUsers)} x {percMuMau * 100}% = {this.formatNumber(mau)}
        </div>
        <div>
          ${pricing.basePrice} + ${addtPrice} = ${price}
        </div>
        <Slider
          // orientation='vertical'
          value={this.state.mauIndex}
          min={0}
          step={1}
          max={this.state.marks.length - 1}
          onChange={(e, val) => this.setState({ mauIndex: val as any as number })}
        />
      </div>
    );
  }

  formatNumber(val: number): string {
    return val.toLocaleString('en-US');
  }

  getMarks() {
    var fractionsToInclude = 2;
    var currMaxMau = 4001;
    const points = this.props.plans.slice().reverse().flatMap(plan => {
      const pts: Array<number> = [];
      if(!plan.pricing) return pts;

      // TODO
      var currPt: number = plan.pricing.baseMau;
      while(currPt < currMaxMau) {
        pts.push(currPt);
        currPt += plan.pricing.unitMau;
      }

      currMaxMau = plan.pricing.baseMau;
      return pts;
    });
    points.sort((l, r) => l - r);
    while(fractionsToInclude > 0) {
      points.unshift(points[0] / 2);
      fractionsToInclude--;
    }
    return points;
  }
}

export default withStyles(styles, { withTheme: true })(PricingSlider);
