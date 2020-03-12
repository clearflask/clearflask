import { MenuItem, Select } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import * as Admin from '../api/admin';
import notEmpty from '../common/util/arrayUtil';

const styles = (theme: Theme) => createStyles({
  billingSelect: {
    margin: theme.spacing(3),
  },
});

interface Props {
  plans?: Admin.Plan[];
  value?: Admin.PlanPricingPeriodEnum;
  onChange?: (period: Admin.PlanPricingPeriodEnum) => void;
}

class PlanPeriodSelect extends Component<Props & WithStyles<typeof styles, true>> {
  render() {
    const allPlans = this.props.plans || [];
    const periodsSet = new Set(allPlans
      .map(plan => plan.pricing?.period)
      .filter(notEmpty));
    const periods = Object.keys(Admin.PlanPricingPeriodEnum).filter(period => periodsSet.has(period as any as Admin.PlanPricingPeriodEnum));
    return (
      <Select
        className={this.props.classes.billingSelect}
        value={this.props.value || ''}
        onChange={e => this.props.onChange && this.props.onChange(e.target.value as Admin.PlanPricingPeriodEnum)}
      >
        {periods.map(period => (
          <MenuItem key={period} value={period}>{period} billing</MenuItem>
        ))}
      </Select>
    );
  }
}

export default withStyles(styles, { withTheme: true })(PlanPeriodSelect);
