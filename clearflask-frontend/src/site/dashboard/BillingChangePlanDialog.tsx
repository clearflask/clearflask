// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
import { Button, Container, Dialog, DialogActions, DialogTitle, Grid } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import * as Admin from '../../api/admin';
import { Status } from '../../api/server';
import ServerAdmin, { ReduxStateAdmin } from '../../api/serverAdmin';
import Loader from '../../app/utils/Loader';
import SubmitButton from '../../common/SubmitButton';
import { WithMediaQuery, withMediaQuery } from '../../common/util/MediaQuery';
import PricingPlan from '../PricingPlan';

const styles = (theme: Theme) => createStyles({
});
interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (basePlanId: string) => void;
  isSubmitting?: boolean;
}
interface ConnectProps {
  callOnMount?: () => void,
  accountPlanId?: string;
  plans?: Admin.Plan[];
  accountBillingStatus?: Status;
  accountStatus?: Status;
}
interface State {
  basePlanId?: string;
}

class BillingChangePlanDialog extends Component<Props & ConnectProps & WithMediaQuery & WithStyles<typeof styles, true>, State> {
  state: State = {};

  constructor(props) {
    super(props);

    props.callOnMount?.();
  }

  render() {
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
        <Loader status={this.props.accountStatus === Status.FULFILLED ? this.props.accountBillingStatus : this.props.accountStatus}>
          <Container maxWidth='md'>
            <Grid container spacing={5} alignItems='stretch' justify='center'>
              {this.props.plans && this.props.plans.map((plan, index) => (
                <Grid item key={plan.basePlanId} xs={12} sm={index === 2 ? 12 : 6} md={4}>
                  <PricingPlan
                    plan={plan}
                    selected={plan.basePlanId === this.props.accountPlanId ? (!this.state.basePlanId || this.state.basePlanId === this.props.accountPlanId) : this.state.basePlanId === plan.basePlanId}
                    actionTitle={plan.basePlanId === this.props.accountPlanId ? 'Current plan' : (this.state.basePlanId === plan.basePlanId ? 'Selected' : 'Select')}
                    actionType={plan.basePlanId === this.props.accountPlanId ? undefined : 'radio'}
                    actionOnClick={plan.basePlanId === this.props.accountPlanId ? undefined : () => this.setState({ basePlanId: plan.basePlanId })}
                  />
                </Grid>
              ))}
            </Grid>
          </Container>
        </Loader>
        <DialogActions>
          <Button onClick={this.props.onClose.bind(this)}
          >Cancel</Button>
          <SubmitButton
            isSubmitting={this.props.isSubmitting}
            disabled={!this.state.basePlanId || this.state.basePlanId === this.props.accountPlanId}
            color='primary'
            onClick={this.props.onSubmit.bind(this, this.state.basePlanId!)}
          >Switch</SubmitButton>
        </DialogActions>
      </Dialog>
    );
  }
}

export default connect<ConnectProps, {}, Props, ReduxStateAdmin>((state, ownProps) => {
  const newProps: ConnectProps = {
    accountPlanId: state.account.billing.billing?.plan.basePlanId,
    plans: state.account.billing.billing?.availablePlans,
    accountStatus: state.account.account.status,
    accountBillingStatus: state.account.billing.status,
  };
  if (state.account.billing.status === undefined) {
    newProps.callOnMount = () => {
      ServerAdmin.get().dispatchAdmin().then(d => d.accountBillingAdmin({}));
    };
  }
  return newProps;
})(withStyles(styles, { withTheme: true })(withMediaQuery(theme => theme.breakpoints.down('xs'))(BillingChangePlanDialog)));
