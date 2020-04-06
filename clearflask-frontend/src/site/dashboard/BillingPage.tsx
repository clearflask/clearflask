
import { Grid } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import * as Admin from '../../api/admin';
import { Status } from '../../api/server';
import { ReduxStateAdmin } from '../../api/serverAdmin';
import DividerCorner from '../../app/utils/DividerCorner';
import PricingPlan from '../PricingPlan';

const styles = (theme: Theme) => createStyles({
  corner: {
    margin: theme.spacing(1),
  },
  planCorner: {
    margin: theme.spacing(4),
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'left',
  },
  plan: {
    // margin: theme.spacing(4),
  },
});

interface ConnectProps {
  accountStatus?: Status;
  account?: Admin.AccountAdmin;
}

class BillingPage extends Component<ConnectProps & WithStyles<typeof styles, true>> {
  render() {
    if (!this.props.account) {
      return 'Need to login to see this page';
    }
    return (
      <React.Fragment>
        <DividerCorner title='Plan' innerClassName={this.props.classes.planCorner}>
          <Grid container spacing={5} alignItems='stretch'>
            <Grid item key={this.props.account.plan.planid} xs={12} sm={6} md={4}
              className={this.props.classes.plan}>
              <PricingPlan
                plan={this.props.account.plan}
              />
            </Grid>
          </Grid>
        </DividerCorner>
        <DividerCorner title='Billing' className={this.props.classes.corner}>
          TODO
          {/* NOTE: Our terms refer to this page for renewal date info, cancellation instructions  */}
        </DividerCorner>
      </React.Fragment>
    );
  }
}

export default connect<ConnectProps, {}, {}, ReduxStateAdmin>((state, ownProps) => {
  const connectProps: ConnectProps = {
    accountStatus: state.account.account.status,
    account: state.account.account.account,
  };
  return connectProps;
}, null, null, { forwardRef: true })(withStyles(styles, { withTheme: true })(BillingPage));
