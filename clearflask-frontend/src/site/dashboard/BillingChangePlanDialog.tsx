import { Button, DialogActions, Grid, Dialog, DialogTitle, DialogContent, Container } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import * as Admin from '../../api/admin';
import ServerAdmin, { ReduxStateAdmin } from '../../api/serverAdmin';
import AcceptTerms from '../../common/AcceptTerms';
import notEmpty from '../../common/util/arrayUtil';
import PlanPeriodSelect from '../PlanPeriodSelect';
import PricingPlan from '../PricingPlan';
import { WithMediaQuery, withMediaQuery } from '../../common/util/MediaQuery';
import Loader from '../../app/utils/Loader';
import { Status } from '../../api/server';

const styles = (theme: Theme) => createStyles({
});
interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (planid: string) => void;
  isSubmitting?: boolean;
}
interface ConnectProps {
  accountPlanId?: string;
  currentPlan?: Admin.Plan;
  plans?: Admin.Plan[];
  accountBillingStatus?: Status;
  accountStatus?: Status;
}
interface State {
  period?: Admin.PlanPricingPeriodEnum;
  planid?: string;
}

class BillingChangePlanDialog extends Component<Props & ConnectProps & WithMediaQuery & WithStyles<typeof styles, true>, State> {
  state: State = {};

  render() {
    const allPlans = this.props.plans || [];
    const periodsSet = new Set(allPlans
      .map(plan => plan.pricing?.period)
      .filter(notEmpty));
    const periods = Object.keys(Admin.PlanPricingPeriodEnum).filter(period => periodsSet.has(period as any as Admin.PlanPricingPeriodEnum));
    const selectedPeriod = this.state.period
      || (periods.length > 0 ? periods[periods.length - 1] as any as Admin.PlanPricingPeriodEnum : undefined);
    const plans = allPlans
      .filter(plan => plan.pricing && selectedPeriod === plan.pricing.period)
    const selectedPlanId = this.state.planid;
    const plansWithCurrentPlan = this.props.currentPlan
      ? [this.props.currentPlan, ...plans]
      : plans;

    return (
      <Dialog
        open={!!this.props.open}
        onClose={this.props.onClose.bind(this)}
        fullScreen={this.props.mediaQuery}
        scroll='body'
        maxWidth='md'
        fullWidth
      >
        <DialogTitle>Switch plan</DialogTitle>
        {periods.length > 1 && (
          <PlanPeriodSelect
            plans={plansWithCurrentPlan}
            value={selectedPeriod}
            onChange={period => this.setState({ period, planid: undefined })}
          />
        )}
        <Loader status={this.props.accountStatus === Status.FULFILLED ? this.props.accountBillingStatus : this.props.accountStatus}>
          <Container maxWidth='md'>
            <Grid container spacing={5} alignItems='stretch' justify='center'>
              {plansWithCurrentPlan.map((plan, index) => (
                <Grid item key={plan.planid} xs={12} sm={index === 2 ? 12 : 6} md={4}>
                  <PricingPlan
                    plan={plan}
                    selected={plan.planid === this.props.accountPlanId ? (!selectedPlanId || selectedPlanId === this.props.accountPlanId) : selectedPlanId === plan.planid}
                    actionTitle={plan.planid === this.props.accountPlanId ? 'Current plan' : (selectedPlanId === plan.planid ? 'Selected' : 'Select')}
                    actionType={plan.planid === this.props.accountPlanId ? undefined : 'radio'}
                    actionOnClick={plan.planid === this.props.accountPlanId ? undefined : () => this.setState({planid: plan.planid})}
                  />
                </Grid>
              ))}
            </Grid>
          </Container>
        </Loader>
        <AcceptTerms />
        <DialogActions>
          <Button onClick={this.props.onClose.bind(this)}
          >Cancel</Button>
          <Button disabled={this.props.isSubmitting || !this.state.planid || this.state.planid === this.props.accountPlanId} color="primary" onClick={this.props.onSubmit.bind(this, this.state.planid!)}
          >Switch</Button>
        </DialogActions>
      </Dialog>
    );
  }
}

export default connect<ConnectProps, {}, Props, ReduxStateAdmin>((state, ownProps) => {
  if (state.plans.plans.status === undefined) {
    ServerAdmin.get().dispatchAdmin().then(d => d.plansGet());
  }
  if (state.account.billing.status === undefined) {
    ServerAdmin.get().dispatchAdmin().then(d => d.accountBillingAdmin());
  }
  return {
    accountPlanId: state.account.account.account?.plan.planid,
    currentPlan: state.account.account.account?.plan,
    plans: state.account.billing.billing?.availablePlans,
    accountStatus: state.account.account.status,
    accountBillingStatus: state.account.billing.status,
  };
})(withStyles(styles, { withTheme: true })(withMediaQuery(theme => theme.breakpoints.down('xs'))(BillingChangePlanDialog)));
