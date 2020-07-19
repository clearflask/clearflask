
import { Typography, Button, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Container, Table, TableBody, TableRow, TableCell, TableHead } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import * as Admin from '../../api/admin';
import { Status } from '../../api/server';
import ServerAdmin, { ReduxStateAdmin } from '../../api/serverAdmin';
import DividerCorner from '../../app/utils/DividerCorner';
import PricingPlan from '../PricingPlan';
import StripeCreditCard from '../../common/StripeCreditCard';
import CreditCard from '../../common/CreditCard';
import AcceptTerms from '../../common/AcceptTerms';
import ActiveIcon from '@material-ui/icons/Check';
import WarnIcon from '@material-ui/icons/Warning';
import ErrorIcon from '@material-ui/icons/Error';
import classNames from 'classnames';
import TimeAgo from 'react-timeago';
import BillingChangePlanDialog from './BillingChangePlanDialog';
import Loader from '../../app/utils/Loader';
import SubmitButton from '../../common/SubmitButton';

const styles = (theme: Theme) => createStyles({
  plan: {
    margin: theme.spacing(2, 6, 2),
    alignSelf: 'flex-start',
  },
  spacing: {
    margin: theme.spacing(2),
  },
  creditCard: {
    margin: theme.spacing(2, 6, 2),
    alignSelf: 'flex-start',
  },
  sectionContainer: {
    display: 'inline-flex',
    flexDirection: 'column',
  },
  billingContainer: {
    display: 'flex',
    flexWrap: 'wrap',
  },
  sectionInvoices: {
    width: 'min-content',
  },
  billingHistoryTable: {
    whiteSpace: 'nowrap',
  },
  sectionButtons: {
    alignSelf: 'flex-end',
  },
  blurry: {
    color: 'transparent',
    textShadow: '0px 0px 6px rgba(0,0,0,0.8)',
  },
  center: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
});
interface ConnectProps {
  accountStatus?: Status;
  account?: Admin.AccountAdmin;
  accountBillingStatus?: Status;
  accountBilling?: Admin.AccountBilling;
}
interface State {
  isSubmitting?: boolean;
  showAddPayment?: boolean;
  showCancelSubscription?: boolean;
  showResumePlan?: boolean;
  showPlanChange?: boolean;
  invoices?: Admin.InvoiceItem[];
  invoicesCursor?: string;
}
class BillingPage extends Component<ConnectProps & WithStyles<typeof styles, true>, State> {
  state: State = {};
  render() {
    if (!this.props.account) {
      return 'Need to login to see this page';
    }

    var cardNumber, cardExpiry, cardStateIcon;
    if (!!this.props.accountBilling?.payment) {
      cardNumber = (
        <React.Fragment>
          <span className={this.props.classes.blurry}>5200&nbsp;8282&nbsp;8282&nbsp;</span>
          {this.props.accountBilling.payment.last4}
        </React.Fragment>
      );
      var expiryColor;
      if (new Date().getFullYear() % 100 >= this.props.accountBilling.payment.expiryYear % 100) {
        if (new Date().getMonth() + 1 === this.props.accountBilling.payment.expiryMonth) {
          expiryColor = this.props.theme.palette.warning.main;
        } else if (new Date().getMonth() + 1 > this.props.accountBilling.payment.expiryMonth) {
          expiryColor = this.props.theme.palette.error.main;
        }
      }
      cardExpiry = (
        <span style={expiryColor && { color: expiryColor }}>
          {this.props.accountBilling.payment.expiryMonth}
          &nbsp;/&nbsp;
          {this.props.accountBilling.payment.expiryYear % 100}
        </span>
      );
    } else {
      cardNumber = (<span className={this.props.classes.blurry}>5200&nbsp;8282&nbsp;8282&nbsp;8210</span>);
      cardExpiry = (<span className={this.props.classes.blurry}>06 / 32</span>);
    }
    switch (this.props.account.subscriptionStatus) {
      case Admin.AccountAdminSubscriptionStatusEnum.Active:
        cardStateIcon = (<ActiveIcon color='primary' />);
        break;
      case Admin.AccountAdminSubscriptionStatusEnum.ActiveTrial:
      case Admin.AccountAdminSubscriptionStatusEnum.ActivePaymentRetry:
      case Admin.AccountAdminSubscriptionStatusEnum.ActiveNoRenewal:
        cardStateIcon = (<WarnIcon style={{ color: this.props.theme.palette.warning.main }} />);
        break;
      case Admin.AccountAdminSubscriptionStatusEnum.TrialExpired:
      case Admin.AccountAdminSubscriptionStatusEnum.PaymentFailed:
      case Admin.AccountAdminSubscriptionStatusEnum.Cancelled:
        cardStateIcon = (<ErrorIcon color='error' />);
        break;
    }
    const creditCard = (
      <CreditCard
        className={this.props.classes.creditCard}
        brand={cardStateIcon}
        numberInput={cardNumber}
        expiryInput={cardExpiry}
        cvcInput={(<span className={this.props.classes.blurry}>642</span>)}
      />
    );

    var paymentTitle, paymentDesc, showSetPayment, setPaymentTitle, showCancelSubscription, showResumePlan, resumePlanDesc;
    switch (this.props.account.subscriptionStatus) {
      case Admin.AccountAdminSubscriptionStatusEnum.Active:
        paymentTitle = 'Automatic renewal is active';
        paymentDesc = 'You will be automatically billed at the next cycle and your plan will be renewed.';
        showSetPayment = true;
        setPaymentTitle = 'Update payment method';
        showCancelSubscription = true;
        break;
      case Admin.AccountAdminSubscriptionStatusEnum.ActiveTrial:
        paymentTitle = 'Automatic renewal requires a payment method';
        paymentDesc = 'To continue using our service beyond the trial period, add a payment method to enable automatic renewal.';
        showSetPayment = true;
        setPaymentTitle = 'Add payment method';
        break;
      case Admin.AccountAdminSubscriptionStatusEnum.ActivePaymentRetry:
        paymentTitle = 'Automatic renewal is having issues with your payment method';
        paymentDesc = 'We are having issues charging your payment method. We will retry your payment method again soon and we may cancel your service if unsuccessful.';
        showSetPayment = true;
        setPaymentTitle = 'Update payment method';
        showCancelSubscription = true;
        break;
      case Admin.AccountAdminSubscriptionStatusEnum.ActiveNoRenewal:
        paymentTitle = 'Automatic renewal is inactive';
        paymentDesc = 'Resume automatic renewal to continue using our service beyond the next billing cycle.';
        showSetPayment = true;
        setPaymentTitle = 'Resume with new payment method';
        showResumePlan = true;
        resumePlanDesc = 'Your subscription will no longer be cancelled. You will be automatically billed for our service at the next billing cycle.';
        break;
      case Admin.AccountAdminSubscriptionStatusEnum.TrialExpired:
        paymentTitle = 'Automatic renewal is inactive';
        paymentDesc = 'To continue using our service, add a payment method to enable automatic renewal.';
        showSetPayment = true;
        setPaymentTitle = 'Add payment method';
        break;
      case Admin.AccountAdminSubscriptionStatusEnum.PaymentFailed:
        paymentTitle = 'Automatic renewal is inactive';
        paymentDesc = 'We had issues charging your payment method and we cancelled your service. Update your payment method to continue using our service.';
        showSetPayment = true;
        setPaymentTitle = 'Update payment method';
        break;
      case Admin.AccountAdminSubscriptionStatusEnum.Cancelled:
        paymentTitle = 'Automatic renewal is inactive';
        paymentDesc = 'Resume automatic renewal to continue using our service.';
        showSetPayment = true;
        setPaymentTitle = 'Update payment method';
        showResumePlan = true;
        resumePlanDesc = 'Your subscription will no longer be cancelled. You will be automatically billed for our service starting now.';
        break;
    }

    var planTitle, planDesc, showPlanChange;
    switch (this.props.account.subscriptionStatus) {
      case Admin.AccountAdminSubscriptionStatusEnum.Active:
        planTitle = 'Your plan is active';
        planDesc = `You have full access to your ${this.props.account.plan.title} plan. If you switch plans now, balance will be prorated.`;
        showPlanChange = true;
        break;
      case Admin.AccountAdminSubscriptionStatusEnum.ActiveTrial:
        if (this.props.accountBilling?.billingPeriodEnd) {
          planTitle = (
            <React.Fragment>
              Your trial is active and will expire in&nbsp;<TimeAgo date={this.props.accountBilling?.billingPeriodEnd} />
            </React.Fragment>
          );
        } else {
          planTitle = 'Your trial is active';
        }
        planDesc = `You have full access to your ${this.props.account.plan.title} plan until your trial expires. Add a payment method to continue using our service beyond the trial period.`;
        showPlanChange = true;
        break;
      case Admin.AccountAdminSubscriptionStatusEnum.ActivePaymentRetry:
        planTitle = 'Your plan is active';
        planDesc = `You have full access to your ${this.props.account.plan.title} plan; however, there is an issue with your payments. Please resolve all issues before changing your plan.`;
        break;
      case Admin.AccountAdminSubscriptionStatusEnum.ActiveNoRenewal:
        if (this.props.accountBilling?.billingPeriodEnd) {
          planTitle = (
            <React.Fragment>
              Your plan is active until&nbsp;<TimeAgo date={this.props.accountBilling?.billingPeriodEnd} />
            </React.Fragment>
          );
        } else {
          planTitle = 'Your plan is active';
        }
        planDesc = `You have full access to your ${this.props.account.plan.title} plan until it cancels. Please resume your payments to continue using our service beyond next billing cycle.`;
        break;
      case Admin.AccountAdminSubscriptionStatusEnum.TrialExpired:
        planTitle = 'Your trial has expired';
        planDesc = `You have limited access to your ${this.props.account.plan.title} plan. Please add a payment method to continue using our service.`;
        break;
      case Admin.AccountAdminSubscriptionStatusEnum.PaymentFailed:
        planTitle = 'Your plan is inactive';
        planDesc = `You have limited access to your ${this.props.account.plan.title} plan due to a payment issue. Please resolve all issues to continue using our service.`;
        break;
      case Admin.AccountAdminSubscriptionStatusEnum.Cancelled:
        planTitle = 'Your plan is inactive';
        planDesc = `You have limited access to your ${this.props.account.plan.title} plan since you cancelled your subscription. Please resume payment to continue using our service.`;
        break;
    }

    const payment = (
      <DividerCorner title='Payment' height='90%' className={this.props.classes.spacing}>
        <Container maxWidth='sm' className={classNames(this.props.classes.sectionContainer, this.props.classes.spacing)}>
          {creditCard}
          <Typography variant='h6' component='div'>{paymentTitle}</Typography>
          <Typography>{paymentDesc}</Typography>
          <div className={this.props.classes.sectionButtons}>
            {showSetPayment && (
              <SubmitButton
                isSubmitting={this.state.isSubmitting}
                disabled={this.state.showAddPayment}
                onClick={() => this.setState({ showAddPayment: true })}
              >
                {setPaymentTitle}
              </SubmitButton>
            )}
            {showCancelSubscription && (
              <SubmitButton
                isSubmitting={this.state.isSubmitting}
                disabled={this.state.showCancelSubscription}
                onClick={() => this.setState({ showCancelSubscription: true })}
              >
                Cancel payments
              </SubmitButton>
            )}
            {showResumePlan && (
              <SubmitButton
                isSubmitting={this.state.isSubmitting}
                disabled={this.state.showResumePlan}
                onClick={() => this.setState({ showResumePlan: true })}
              >
                Resume payments
              </SubmitButton>
            )}
          </div>
        </Container>
        <Dialog
          open={!!this.state.showAddPayment}
          keepMounted
          onClose={() => this.setState({ showAddPayment: undefined })}
        >
          <DialogTitle>Add payment method</DialogTitle>
          <DialogContent className={this.props.classes.center}>
            <StripeCreditCard />
          </DialogContent>
          <AcceptTerms />
          <DialogActions>
            <Button onClick={() => this.setState({ showAddPayment: undefined })}>
              Cancel
            </Button>
            <SubmitButton
              isSubmitting={this.state.isSubmitting}
              color='primary'
              onClick={() => {
                this.setState({ isSubmitting: true });
                ServerAdmin.get().dispatchAdmin().then(d => d.accountUpdateAdmin({
                  accountUpdateAdmin: {
                    paymentToken: {
                      type: 'blah',
                      token: 'TODO' // TODO add stripe token
                    },
                    renewAutomatically: true,
                  },
                }).then(() => d.accountBillingAdmin()))
                  .then(() => this.setState({ isSubmitting: false, showAddPayment: undefined }))
                  .catch(er => this.setState({ isSubmitting: false }));
              }}
            >Add</SubmitButton>
          </DialogActions>
        </Dialog>
        <Dialog
          open={!!this.state.showCancelSubscription}
          keepMounted
          onClose={() => this.setState({ showCancelSubscription: undefined })}
        >
          <DialogTitle>Stop subscription</DialogTitle>
          <DialogContent className={this.props.classes.center}>
            <DialogContentText>Stops automatic renewal of subscription. You will continue to </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => this.setState({ showCancelSubscription: undefined })}>
              Cancel
            </Button>
            <SubmitButton
              isSubmitting={this.state.isSubmitting}
              color='primary'
              onClick={() => {
                this.setState({ isSubmitting: true });
                ServerAdmin.get().dispatchAdmin().then(d => d.accountUpdateAdmin({
                  accountUpdateAdmin: {
                    cancelEndOfTerm: true,
                  },
                }).then(() => d.accountBillingAdmin()))
                  .then(() => this.setState({ isSubmitting: false, showCancelSubscription: undefined }))
                  .catch(er => this.setState({ isSubmitting: false }));
              }}
            >Stop subscription</SubmitButton>
          </DialogActions>
        </Dialog>
        <Dialog
          open={!!this.state.showResumePlan}
          keepMounted
          onClose={() => this.setState({ showResumePlan: undefined })}
        >
          <DialogTitle>Resume subscription</DialogTitle>
          <DialogContent className={this.props.classes.center}>
            <DialogContentText>{resumePlanDesc}</DialogContentText>
          </DialogContent>
          <AcceptTerms />
          <DialogActions>
            <Button onClick={() => this.setState({ showResumePlan: undefined })}>
              Cancel
            </Button>
            <SubmitButton
              isSubmitting={this.state.isSubmitting}
              color='primary'
              onClick={() => {
                this.setState({ isSubmitting: true });
                ServerAdmin.get().dispatchAdmin().then(d => d.accountUpdateAdmin({
                  accountUpdateAdmin: {
                    cancelEndOfTerm: false,
                  },
                }).then(() => d.accountBillingAdmin()))
                  .then(() => this.setState({ isSubmitting: false, showResumePlan: undefined }))
                  .catch(er => this.setState({ isSubmitting: false }));
              }}
            >Resume subscription</SubmitButton>
          </DialogActions>
        </Dialog>
      </DividerCorner>
    );

    const nextInvoicesCursor = this.state.invoices === undefined
      ? this.props.accountBilling?.invoices.cursor
      : this.state.invoicesCursor;
    const invoicesItems = [
      ...(this.props.accountBilling?.invoices.results || []),
      ...(this.state.invoices || []),
    ];
    const invoices = invoicesItems.length <= 0 ? undefined : (
      <div className={this.props.classes.sectionInvoices}>
        <DividerCorner title='History' height='100%' className={classNames(this.props.classes.billingHistoryTable, this.props.classes.spacing)}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell key='due'>Due</TableCell>
                <TableCell key='status'>Status</TableCell>
                <TableCell key='amount'>Amount</TableCell>
                <TableCell key='desc'>Description</TableCell>
                <TableCell key='invoiceLink'>Invoice</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {invoicesItems.map((invoiceItem, index) => (
                <TableRow key={index}>
                  <TableCell key='due'><Typography><TimeAgo date={invoiceItem.date} /></Typography></TableCell>
                  <TableCell key='status' align='center'><Typography>{invoiceItem.status}</Typography></TableCell>
                  <TableCell key='amount' align='right'><Typography>{invoiceItem.amount}</Typography></TableCell>
                  <TableCell key='desc'><Typography>{invoiceItem.description}</Typography></TableCell>
                  <TableCell key='invoiceLink'>
                    <Button onClick={() => this.onInvoiceClick(invoiceItem.invoiceId)}>View</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DividerCorner>
        {nextInvoicesCursor && (
          <Button
            style={{ margin: 'auto', display: 'block' }}
            onClick={() => ServerAdmin.get().dispatchAdmin()
              .then(d => d.invoicesSearchAdmin({ cursor: nextInvoicesCursor }))
              .then(results => this.setState({
                invoices: [
                  ...(this.state.invoices || []),
                  ...results.results,
                ],
                invoicesCursor: results.cursor,
              }))}
          >
            Show more
          </Button>
        )}
      </div>
    );

    const plan = (
      <DividerCorner title='Plan' height='90%' className={this.props.classes.spacing}>
        <Container maxWidth='sm' className={classNames(this.props.classes.sectionContainer, this.props.classes.spacing)}>
          <PricingPlan
            selected
            className={this.props.classes.plan}
            plan={this.props.account.plan}
          />
          <Typography variant='h6' component='div'>{planTitle}</Typography>
          <Typography>{planDesc}</Typography>
          {showPlanChange && (
            <div className={this.props.classes.sectionButtons}>
              <Button disabled={this.state.isSubmitting || this.state.showPlanChange} onClick={() => this.setState({ showPlanChange: true })}>Switch plan</Button>
            </div>
          )}
        </Container>
        <BillingChangePlanDialog
          open={!!this.state.showPlanChange}
          onClose={() => this.setState({ showPlanChange: undefined })}
          onSubmit={planid => {
            this.setState({ isSubmitting: true });
            ServerAdmin.get().dispatchAdmin().then(d => d.accountUpdateAdmin({
              accountUpdateAdmin: {
                planid,
              },
            }).then(() => d.accountBillingAdmin()))
              .then(() => this.setState({ isSubmitting: false, showPlanChange: undefined }))
              .catch(er => this.setState({ isSubmitting: false }));
          }}
          isSubmitting={!!this.state.isSubmitting}
        />
      </DividerCorner>
    );

    return (
      <Loader status={this.props.accountStatus === Status.FULFILLED ? this.props.accountBillingStatus : this.props.accountStatus}>
        {/* NOTE: Our terms refer to this page for renewal date info, cancellation instructions  */}
        {plan}
        <div className={this.props.classes.billingContainer}>
          {payment}
          {invoices}
        </div>
      </Loader>
    );
  }

  onInvoiceClick(invoiceId:string) {
    window.open(`${window.location.origin}/invoice/${invoiceId}`, '_blank')
  }
}

export default connect<ConnectProps, {}, {}, ReduxStateAdmin>((state, ownProps) => {
  if (state.account.billing.status === undefined) {
    ServerAdmin.get().dispatchAdmin().then(d => d.accountBillingAdmin());
  }
  const connectProps: ConnectProps = {
    accountStatus: state.account.account.status,
    account: state.account.account.account,
    accountBillingStatus: state.account.billing.status,
    accountBilling: state.account.billing.billing,
  };
  return connectProps;
}, null, null, { forwardRef: true })(withStyles(styles, { withTheme: true })(BillingPage));
