import { Slider, Mark } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import * as Admin from '../api/admin';

const expectedActivePercValues :Array<{
 perc: number;
 desc: string; 
}> = [
  {perc: 0, desc: 'No longer share feedback with users'},
  {perc: 0.01, desc: 'Feedback hidden away or shared'},
  {perc: 0.02, desc: 'Typical user response'},
  {perc: 0.03, desc: ''},
];
const expectedActivePercMarks: Mark[] = expectedActivePercValues.map((e, index) => ({
  value: index,
  label: `${e.perc * 100}%`,
}));

const styles = (theme: Theme) => createStyles({
});
interface Props {
  plans: Admin.Plan[];
}
interface State {
  mau: number;
  expectedActivePercIndex: number;
}
class PricingSlider extends Component<Props & WithStyles<typeof styles, true>, State> {
  state: State = {
    mau: 50,
    expectedActivePercIndex: 2,
  };
  render() {
    if(this.props.plans.length === 0) return null;

    const lowestUnit = 25;
    const mau = this.state.mau - (this.state.mau % lowestUnit);

    var plan: Admin.Plan | undefined;
    this.props.plans.forEach(p => {
      if(!plan
        || (p.pricing && p.pricing!.baseMau < mau && mau <= p.pricing.baseMau)) {
        plan = p;
      }
    });
    if(!plan) return null;
    const pricing: Admin.PlanPricing = plan.pricing!;

    const percMuMau = expectedActivePercValues[this.state.expectedActivePercIndex].perc;

    const monthlyUsers = Math.round(mau / percMuMau);

    const addtPrice =  Math.ceil(Math.max(0, mau - pricing.baseMau) / pricing.unitMau) * pricing.unitPrice;
    const price = pricing.basePrice + addtPrice;

    return (
      <div>
        <div>
          {monthlyUsers} x {percMuMau * 100}% = {mau}
        </div>
        <div>
          ${pricing.basePrice} + ${addtPrice} = ${price}
        </div>
        <Slider
          value={this.state.mau}
          min={0}
          max={1000}
          onChange={(e, val) => this.setState({ mau: val as any as number })}
        />
        <Slider
          value={this.state.expectedActivePercIndex}
          min={0}
          max={expectedActivePercMarks.length - 1}
          marks={expectedActivePercMarks}
          onChange={(e, val) => this.setState({ expectedActivePercIndex: val as any as number })}
        />
      </div>
    );
  }
}

export default withStyles(styles, { withTheme: true })(PricingSlider);
