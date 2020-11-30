
import { Box, Button, Collapse, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography, withWidth, WithWidthProps } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import ActiveIcon from '@material-ui/icons/Check';
import ErrorIcon from '@material-ui/icons/Error';
import WarnIcon from '@material-ui/icons/Warning';
import { Color } from '@material-ui/lab';
import { CardNumberElement, ElementsConsumer } from '@stripe/react-stripe-js';
import { PaymentIntent, Stripe, StripeElements, StripeError } from '@stripe/stripe-js';
import classNames from 'classnames';
import React, { Component } from 'react';
import ReactGA from 'react-ga';
import { connect } from 'react-redux';
import { RouteComponentProps, withRouter } from 'react-router';
import { Link } from 'react-router-dom';
import TimeAgo from 'react-timeago';
import * as Admin from '../../api/admin';
import { Status } from '../../api/server';
import ServerAdmin, { ReduxStateAdmin } from '../../api/serverAdmin';
import LoadingPage from '../../app/LoadingPage';
import DividerCorner from '../../app/utils/DividerCorner';
import Loader from '../../app/utils/Loader';
import AcceptTerms from '../../common/AcceptTerms';
import CreditCard from '../../common/CreditCard';
import Message from '../../common/Message';
import StripeCreditCard from '../../common/StripeCreditCard';
import SubmitButton from '../../common/SubmitButton';
import { isTracking } from '../../common/util/detectEnv';
import { StopTrialAfterActiveUsersReaches } from '../PricingPage';
import PricingPlan from '../PricingPlan';
import BillingChangePlanDialog from './BillingChangePlanDialog';

/** If changed, also change in KillBilling.java */
interface PaymentStripeAction {
  actionType: 'stripe-next-action';
  actionData: {
    'paymentIntentClientSecret': string,
  };
}

export const BillingPaymentActionRedirectPath = 'billing-redirect';

const styles = (theme: Theme) => createStyles({
  page: {
    maxWidth: 1024,
    width: 'fit-content',
  },
  plan: {
    margin: theme.spacing(2, 6, 2),
  },
  planContainer: {
    alignSelf: 'flex-start',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    width: 350,
  },
  spacing: {
    margin: theme.spacing(2),
  },
  creditCard: {
    margin: theme.spacing(2, 6, 2),
  },
  creditCardContainer: {
    alignSelf: 'flex-start',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    width: 350,
  },
  actionContainer: {
    display: 'flex',
    flexDirection: 'column',
    maxWidth: 400,
    width: '100%',
  },
  sectionContainer: {
    display: 'flex',
    [theme.breakpoints.up('md')]: {
      alignItems: 'center',
    },
    [theme.breakpoints.down('sm')]: {
      flexDirection: 'column',
    },
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
  sectionSpacing: {
    marginTop: theme.spacing(2),
  },
  paymentActionMessage: {
    margin: theme.spacing(4),
  },
});
interface Props {
  stripePromise: Promise<Stripe | null>;
}
interface ConnectProps {
  accountStatus?: Status;
  account?: Admin.AccountAdmin;
  accountBillingStatus?: Status;
  accountBilling?: Admin.AccountBilling;
  isSuperAdmin: boolean;
}
interface State {
  isSubmitting?: boolean;
  showAddPayment?: boolean;
  stripePaymentFilled?: boolean;
  stripePaymentError?: string;
  showCancelSubscription?: boolean;
  showResumePlan?: boolean;
  showPlanChange?: boolean;
  invoices?: Admin.InvoiceItem[];
  invoicesCursor?: string;
  paymentActionOpen?: boolean;
  paymentActionUrl?: string;
  paymentActionMessage?: string;
  paymentActionMessageSeverity?: Color;
  showFlatYearlyChange?: boolean;
  flatYearlyPrice?: number;
}
class BillingPage extends Component<Props & ConnectProps & WithStyles<typeof styles, true> & RouteComponentProps & WithWidthProps, State> {
  state: State = {};
  refreshBillingAfterPaymentClose?: boolean;
  paymentActionMessageListener?: any;

  componentWillUnmount() {
    this.paymentActionMessageListener && window.removeEventListener('message', this.paymentActionMessageListener);
  }

  render() {
    if (!this.props.account) {
      return 'Need to login to see this page';
    }

    const status = this.props.accountStatus === Status.FULFILLED ? this.props.accountBillingStatus : this.props.accountStatus;
    if (!this.props.accountBilling || status !== Status.FULFILLED) {
      return (
        <Loader
          inline
          status={status}
        />
      );
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
    var hasAvailablePlansToSwitch: boolean = (this.props.accountBilling?.availablePlans || [])
      .filter(p => p.basePlanId !== this.props.accountBilling?.plan.basePlanId)
      .length > 0;
    var cardState: 'active' | 'warn' | 'error' = 'active';
    var paymentTitle, paymentDesc, showContactSupport, showSetPayment, setPaymentTitle, showCancelSubscription, showResumePlan, resumePlanDesc, planTitle, planDesc, showPlanChange, endOfTermChangeToPlanTitle, endOfTermChangeToPlanDesc;
    switch (this.props.account.subscriptionStatus) {
      case Admin.SubscriptionStatus.Active:
        paymentTitle = 'Automatic renewal is active';
        paymentDesc = 'You will be automatically billed at the next cycle and your plan will be renewed.';
        cardState = 'active';
        showSetPayment = true;
        setPaymentTitle = 'Update payment method';
        showCancelSubscription = true;
        planTitle = 'Your plan is active';
        planDesc = `You have full access to your ${this.props.accountBilling.plan.title} plan.`;
        if (hasAvailablePlansToSwitch) {
          planDesc += ' If you switch plans now, balance will be prorated.';
          showPlanChange = true;
        }
        break;
      case Admin.SubscriptionStatus.ActiveTrial:
        if (this.props.accountBilling?.payment) {
          paymentTitle = 'Automatic renewal is active';
          paymentDesc = `Your first payment will be automatically billed at the end of the trial period when you reach ${StopTrialAfterActiveUsersReaches} MAU.`;
          cardState = 'active';
          showSetPayment = true;
          setPaymentTitle = 'Update payment method';
          planTitle = 'Your plan is active';
          planDesc = `You have full access to your ${this.props.accountBilling.plan.title} plan.`;
          if (hasAvailablePlansToSwitch) {
            planDesc += ' If you switch plans now, your first payment will reflect your new plan.';
            showPlanChange = true;
          }
        } else {
          paymentTitle = 'Automatic renewal requires a payment method';
          paymentDesc = 'To continue using our service beyond the trial period, add a payment method to enable automatic renewal.';
          cardState = 'warn';
          showSetPayment = true;
          setPaymentTitle = 'Add payment method';
          planTitle = 'Your plan is active until your trial expires';
          if (this.props.accountBilling?.billingPeriodEnd) {
            planDesc = (
              <React.Fragment>
                You have full access to your ${this.props.accountBilling.plan.title} plan until your trial expires in&nbsp;<TimeAgo date={this.props.accountBilling?.billingPeriodEnd} />. Add a payment method to continue using our service beyond the trial period.
              </React.Fragment>
            );
          } else {
            planDesc = `You have full access to your ${this.props.accountBilling.plan.title} plan until your trial expires when you reach ${StopTrialAfterActiveUsersReaches} MAU. Add a payment method to continue using our service beyond the trial period.`;
          }
          if (hasAvailablePlansToSwitch) {
            showPlanChange = true;
          }
        }
        break;
      case Admin.SubscriptionStatus.ActivePaymentRetry:
        paymentTitle = 'Automatic renewal is having issues with your payment method';
        paymentDesc = 'We are having issues charging your payment method. We will retry your payment method again soon and we may block your service if we are unsuccessful.';
        cardState = 'error';
        showSetPayment = true;
        if (this.props.accountBilling?.payment) {
          setPaymentTitle = 'Update payment method';
        } else {
          setPaymentTitle = 'Add payment method';
        }
        showCancelSubscription = true;
        planTitle = 'Your plan is active';
        planDesc = `You have full access to your ${this.props.accountBilling.plan.title} plan; however, there is an issue with your payment. Please resolve it before you can change your plan.`;
        break;
      case Admin.SubscriptionStatus.ActiveNoRenewal:
        paymentTitle = 'Automatic renewal is inactive';
        paymentDesc = 'Resume automatic renewal to continue using our service beyond the next billing cycle.';
        cardState = 'warn';
        showSetPayment = true;
        setPaymentTitle = 'Resume with new payment method';
        showResumePlan = true;
        resumePlanDesc = 'Your subscription will no longer be cancelled. You will be automatically billed for our service at the next billing cycle.';
        if (this.props.accountBilling?.billingPeriodEnd) {
          planTitle = (
            <React.Fragment>
              Your plan is active until&nbsp;<TimeAgo date={this.props.accountBilling?.billingPeriodEnd} />
            </React.Fragment>
          );
        } else {
          planTitle = 'Your plan is active until the end of the billing cycle';
        }
        planDesc = `You have full access to your ${this.props.accountBilling.plan.title} plan until it cancels. Please resume your payments to continue using our service beyond next billing cycle.`;
        break;
      case Admin.SubscriptionStatus.NoPaymentMethod:
        paymentTitle = 'Automatic renewal is inactive';
        paymentDesc = 'Your trial has expired. To continue using our service, add a payment method to enable automatic renewal.';
        cardState = 'error';
        showSetPayment = true;
        setPaymentTitle = 'Add payment method';
        planTitle = 'Your trial plan has expired';
        planDesc = `To continue using your ${this.props.accountBilling.plan.title} plan, please add a payment method.`;
        break;
      case Admin.SubscriptionStatus.Blocked:
        paymentTitle = 'Payments are blocked';
        paymentDesc = 'Contact support to reinstate your account.';
        showContactSupport = true;
        cardState = 'error';
        planTitle = 'Your plan is inactive';
        planDesc = `You have limited access to your ${this.props.accountBilling.plan.title} plan due to a payment issue. Please resolve all issues to continue using our service.`;
        break;
      case Admin.SubscriptionStatus.Cancelled:
        paymentTitle = 'Automatic renewal is inactive';
        paymentDesc = 'Resume automatic renewal to continue using our service.';
        cardState = 'error';
        showSetPayment = true;
        setPaymentTitle = 'Update payment method';
        if (this.props.accountBilling?.payment) {
          showResumePlan = true;
          resumePlanDesc = 'Your subscription will no longer be cancelled. You will be automatically billed for our service starting now.';
        }
        planTitle = 'Your plan is cancelled';
        planDesc = `You have limited access to your ${this.props.accountBilling.plan.title} plan since you cancelled your subscription. Please resume payment to continue using our service.`;
        break;
    }
    if (this.props.accountBilling?.endOfTermChangeToPlan) {
      endOfTermChangeToPlanTitle = `Pending plan change to ${this.props.accountBilling.endOfTermChangeToPlan.title}`;
      endOfTermChangeToPlanDesc = `Your requested change of plans to ${this.props.accountBilling.endOfTermChangeToPlan.title} plan will take effect at the end of the term.`;
    }
    switch (cardState) {
      case 'active':
        cardStateIcon = (<ActiveIcon color='primary' />);
        break;
      case 'warn':
        cardStateIcon = (<WarnIcon style={{ color: this.props.theme.palette.warning.main }} />);
        break;
      case 'error':
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

    const paymentStripeAction: PaymentStripeAction | undefined = this.props.accountBilling?.paymentActionRequired?.actionType === 'stripe-next-action'
      ? this.props.accountBilling?.paymentActionRequired as PaymentStripeAction : undefined;
    const paymentActionOnClose = () => {
      this.setState({
        paymentActionOpen: undefined,
        paymentActionUrl: undefined,
        paymentActionMessage: undefined,
        paymentActionMessageSeverity: undefined,
      });
      if (this.refreshBillingAfterPaymentClose) {
        ServerAdmin.get().dispatchAdmin().then(d => d.accountBillingAdmin({
          refreshPayments: true,
        }));
      }
    };
    const paymentAction = paymentStripeAction ? (
      <React.Fragment>
        <Message
          className={this.props.classes.paymentActionMessage}
          message='One of your payments requires additional information'
          severity='error'
          action={(
            <SubmitButton
              isSubmitting={!!this.state.paymentActionOpen && !this.state.paymentActionUrl && !this.state.paymentActionMessage}
              onClick={() => {
                this.setState({ paymentActionOpen: true });
                this.loadActionIframe(paymentStripeAction);
              }}
            >Open</SubmitButton>
          )}
        />
        <Dialog
          open={!!this.state.paymentActionOpen}
          keepMounted
          onClose={paymentActionOnClose}
        >
          {this.state.paymentActionMessage ? (
            <React.Fragment>
              <DialogContent>
                <Message
                  message={this.state.paymentActionMessage}
                  severity={this.state.paymentActionMessageSeverity || 'info'}
                />
              </DialogContent>
              <DialogActions>
                <Button onClick={paymentActionOnClose}>Dismiss</Button>
              </DialogActions>
            </React.Fragment>
          ) : (this.state.paymentActionUrl ? (
            <iframe
              title='Complete outstanding payment action'
              width={this.getFrameActionWidth()}
              height={400}
              src={this.state.paymentActionUrl}
            />
          ) : (
              <div style={{
                minWidth: this.getFrameActionWidth(),
                minHeight: 400,
              }}>
                <LoadingPage />
              </div>
            ))}
        </Dialog>
      </React.Fragment>
    ) : undefined;

    const hasPayable = (this.props.accountBilling?.accountPayable || 0) > 0;
    const hasReceivable = (this.props.accountBilling?.accountReceivable || 0) > 0;
    const payment = (
      <DividerCorner title='Payment' height='90%' className={this.props.classes.spacing}>
        <div className={classNames(this.props.classes.sectionContainer, this.props.classes.spacing)}>
          <div className={this.props.classes.creditCardContainer}>
            {creditCard}
            <Box display='grid' gridTemplateAreas='"payTtl payAmt" "rcvTtl rcvAmt"' alignItems='center' gridGap='10px 10px'>
              {hasPayable && (
                <React.Fragment>
                  <Box gridArea='payTtl'><Typography component='div'>Credits:</Typography></Box>
                  <Box gridArea='payAmt' display='flex'>
                    <Typography component='div' variant='h6' color='textSecondary' style={{ alignSelf: 'flex-start' }}>{'$'}</Typography>
                    <Typography component='div' variant='h4' color={hasPayable ? 'primary' : undefined}>
                      {this.props.accountBilling?.accountPayable || 0}
                    </Typography>
                  </Box>
                </React.Fragment>
              )}
              {(hasReceivable || !hasPayable) && (
                <React.Fragment>
                  <Box gridArea='rcvTtl'><Typography component='div'>Overdue:</Typography></Box>
                  <Box gridArea='rcvAmt' display='flex'>
                    <Typography component='div' variant='h6' color='textSecondary' style={{ alignSelf: 'flex-start' }}>{'$'}</Typography>
                    <Typography component='div' variant='h4' color={hasReceivable ? 'error' : undefined}>
                      {this.props.accountBilling?.accountReceivable || 0}
                    </Typography>
                  </Box>
                </React.Fragment>
              )}
            </Box>
          </div>
          <div className={this.props.classes.actionContainer}>
            <Typography variant='h6' component='div'>{paymentTitle}</Typography>
            <Typography>{paymentDesc}</Typography>
            <div className={this.props.classes.sectionButtons}>
              {showContactSupport && (
                <Button
                  disabled={this.state.isSubmitting || this.state.showAddPayment}
                  component={Link}
                  to='/contact/support'
                >Contact support</Button>
              )}
              {showSetPayment && (
                <SubmitButton
                  isSubmitting={this.state.isSubmitting}
                  disabled={this.state.showAddPayment}
                  onClick={() => {
                    if (isTracking()) {
                      ReactGA.event({
                        category: 'billing',
                        action: this.props.accountBilling?.payment ? 'click-payment-update-open' : 'click-payment-add-open',
                        label: this.props.accountBilling?.plan.basePlanId,
                      });
                    }
                    this.setState({ showAddPayment: true })
                  }}
                >
                  {setPaymentTitle}
                </SubmitButton>
              )}
              {showCancelSubscription && (
                <SubmitButton
                  isSubmitting={this.state.isSubmitting}
                  disabled={this.state.showCancelSubscription}
                  style={{ color: this.props.theme.palette.error.main }}
                  onClick={() => this.setState({ showCancelSubscription: true })}
                >
                  Cancel payments
                </SubmitButton>
              )}
              {showResumePlan && (
                <SubmitButton
                  isSubmitting={this.state.isSubmitting}
                  disabled={this.state.showResumePlan}
                  color='primary'
                  onClick={() => this.setState({ showResumePlan: true })}
                >
                  Resume payments
                </SubmitButton>
              )}
            </div>
            {paymentAction}
          </div>
        </div>
        <Dialog
          open={!!this.state.showAddPayment}
          keepMounted
          onClose={() => this.setState({ showAddPayment: undefined })}
        >
          <ElementsConsumer>
            {({ elements, stripe }) => (
              <React.Fragment>
                <DialogTitle>{setPaymentTitle || 'Add new payment method'}</DialogTitle>
                <DialogContent className={this.props.classes.center}>
                  <StripeCreditCard onFilledChanged={(isFilled) => this.setState({ stripePaymentFilled: isFilled })} />
                  <Collapse in={!!this.state.stripePaymentError}>
                    <Message message={this.state.stripePaymentError} severity='error' />
                  </Collapse>
                </DialogContent>
                <AcceptTerms />
                <DialogActions>
                  <Button onClick={() => this.setState({ showAddPayment: undefined })}>
                    Cancel
                  </Button>
                  <SubmitButton
                    isSubmitting={this.state.isSubmitting}
                    disabled={!this.state.stripePaymentFilled || !elements || !stripe}
                    color='primary'
                    onClick={() => this.onPaymentSubmit(elements!, stripe!)}
                  >Add</SubmitButton>
                </DialogActions>
              </React.Fragment>
            )}
          </ElementsConsumer>
        </Dialog>
        <Dialog
          open={!!this.state.showCancelSubscription}
          keepMounted
          onClose={() => this.setState({ showCancelSubscription: undefined })}
        >
          <DialogTitle>Stop subscription</DialogTitle>
          <DialogContent className={this.props.classes.center}>
            <DialogContentText>Stop automatic billing of your subscription. Any ongoing subscription will continue to work until it expires.</DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => this.setState({ showCancelSubscription: undefined })}>
              Cancel
            </Button>
            <SubmitButton
              isSubmitting={this.state.isSubmitting}
              style={{ color: this.props.theme.palette.error.main }}
              onClick={() => {
                this.setState({ isSubmitting: true });
                ServerAdmin.get().dispatchAdmin().then(d => d.accountUpdateAdmin({
                  accountUpdateAdmin: {
                    cancelEndOfTerm: true,
                  },
                }).then(() => d.accountBillingAdmin({})))
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
                    resume: true,
                  },
                }).then(() => d.accountBillingAdmin({})))
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
        <DividerCorner title='Invoices' height='100%' className={classNames(this.props.classes.billingHistoryTable, this.props.classes.spacing)}>
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
                  <TableCell key='due'><Typography>{new Date(invoiceItem.date).toLocaleDateString()}</Typography></TableCell>
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
        <div className={classNames(this.props.classes.sectionContainer, this.props.classes.spacing)}>
          <div className={this.props.classes.planContainer}>
            <PricingPlan
              selected
              className={this.props.classes.plan}
              plan={this.props.accountBilling.plan}
            />
            {(this.props.accountBilling?.billingPeriodMau !== undefined) && (
              <Box display='grid' gridTemplateAreas='"mauLbl mauAmt"' alignItems='baseline' gridGap='10px 10px'>
                <Box gridArea='mauLbl'><Typography component='div'>Current MAU:</Typography></Box>
                <Box gridArea='mauAmt' display='flex'>
                  <Typography component='div' variant='h5'>
                    {this.props.accountBilling.billingPeriodMau}
                  </Typography>
                </Box>
              </Box>
            )}
          </div>
          <div className={this.props.classes.actionContainer}>
            <Typography variant='h6' component='div'>{planTitle}</Typography>
            <Typography>{planDesc}</Typography>
            {(endOfTermChangeToPlanTitle || endOfTermChangeToPlanDesc) && (
              <React.Fragment>
                <Typography variant='h6' component='div' className={this.props.classes.sectionSpacing}>{endOfTermChangeToPlanTitle}</Typography>
                <Typography>{endOfTermChangeToPlanDesc}</Typography>
              </React.Fragment>
            )}
            {showPlanChange && (
              <div className={this.props.classes.sectionButtons}>
                <Button
                  disabled={this.state.isSubmitting || this.state.showPlanChange}
                  onClick={() => {
                    if (isTracking()) {
                      ReactGA.event({
                        category: 'billing',
                        action: 'click-plan-switch-open',
                        label: this.props.accountBilling?.plan.basePlanId,
                      });
                    }

                    this.setState({ showPlanChange: true });
                  }}
                >
                  Switch plan
                </Button>
              </div>
            )}
            {this.props.isSuperAdmin && (
              <React.Fragment>
                <Dialog
                  open={!!this.state.showFlatYearlyChange}
                  onClose={() => this.setState({ showFlatYearlyChange: undefined })}
                  scroll='body'
                  maxWidth='md'
                >
                  <DialogTitle>Switch to yearly plan</DialogTitle>
                  <DialogContent>
                    <TextField
                      variant='outlined'
                      type='number'
                      label='Yearly flat price'
                      value={this.state.flatYearlyPrice !== undefined ? this.state.flatYearlyPrice : ''}
                      onChange={e => this.setState({ flatYearlyPrice: parseInt(e.target.value) >= 0 ? parseInt(e.target.value) : undefined })}
                    />
                  </DialogContent>
                  <DialogActions>
                    <Button onClick={() => this.setState({ showFlatYearlyChange: undefined })}
                    >Cancel</Button>
                    <SubmitButton
                      isSubmitting={this.state.isSubmitting}
                      disabled={this.state.flatYearlyPrice === undefined}
                      color='primary'
                      onClick={() => {

                        this.setState({ isSubmitting: true });
                        ServerAdmin.get().dispatchAdmin().then(d => d.accountUpdateSuperAdmin({
                          accountUpdateSuperAdmin: {
                            changeToFlatPlanWithYearlyPrice: this.state.flatYearlyPrice || 0,
                          },
                        }).then(() => d.accountBillingAdmin({})))
                          .then(() => this.setState({ isSubmitting: false, showFlatYearlyChange: undefined }))
                          .catch(er => this.setState({ isSubmitting: false }));
                      }}
                    >Change</SubmitButton>
                  </DialogActions>
                </Dialog>
                <div className={this.props.classes.sectionButtons}>
                  <Button
                    disabled={this.state.isSubmitting}
                    onClick={() => this.setState({ showFlatYearlyChange: true })}
                  >
                    To flat
                </Button>
                </div>
              </React.Fragment>
            )}
          </div>
        </div>
        <BillingChangePlanDialog
          open={!!this.state.showPlanChange}
          onClose={() => this.setState({ showPlanChange: undefined })}
          onSubmit={basePlanId => {
            if (isTracking()) {
              ReactGA.event({
                category: 'billing',
                action: 'click-plan-switch-submit',
                label: basePlanId,
              });
            }

            this.setState({ isSubmitting: true });
            ServerAdmin.get().dispatchAdmin().then(d => d.accountUpdateAdmin({
              accountUpdateAdmin: {
                basePlanId,
              },
            }).then(() => d.accountBillingAdmin({})))
              .then(() => this.setState({ isSubmitting: false, showPlanChange: undefined }))
              .catch(er => this.setState({ isSubmitting: false }));
          }}
          isSubmitting={!!this.state.isSubmitting}
        />
      </DividerCorner>
    );

    return (
      <div className={this.props.classes.page}>
        {plan}
        {payment}
        {invoices}
      </div>
    );
  }

  onInvoiceClick(invoiceId: string) {
    window.open(`${window.location.origin}/invoice/${invoiceId}`, '_blank')
  }

  async onPaymentSubmit(elements: StripeElements, stripe: Stripe) {
    if (isTracking()) {
      ReactGA.event({
        category: 'billing',
        action: this.props.accountBilling?.payment ? 'click-payment-update-submit' : 'click-payment-add-submit',
        label: this.props.accountBilling?.plan.basePlanId,
        value: this.props.accountBilling?.plan.pricing?.basePrice,
      });
    }

    this.setState({ isSubmitting: true, stripePaymentError: undefined });

    const cardNumberElement = elements.getElement(CardNumberElement);
    if (cardNumberElement === null) {
      this.setState({
        stripePaymentError: 'Payment processor not initialized yet',
        isSubmitting: false,
      });
      return;
    }

    const tokenResult = await stripe.createToken(cardNumberElement);
    if (!tokenResult.token) {
      this.setState({
        stripePaymentError: tokenResult.error
          ? `${tokenResult.error.message} (${tokenResult.error.code || tokenResult.error.decline_code || tokenResult.error.type})`
          : 'Payment processor failed for unknown reason',
        isSubmitting: false,
      });
      return;
    }

    const dispatcher = await ServerAdmin.get().dispatchAdmin();
    try {
      await dispatcher.accountUpdateAdmin({
        accountUpdateAdmin: {
          paymentToken: {
            type: 'killbill-stripe',
            token: tokenResult.token.id,
          },
          renewAutomatically: true,
        },
      });
    } catch (er) {
      this.setState({
        isSubmitting: false,
        stripePaymentError: 'Failed to add payment',
      });
      return;
    }

    try {
      await dispatcher.accountBillingAdmin({});
    } catch (er) {
      this.setState({
        isSubmitting: false,
        stripePaymentError: 'Failed to add payment',
      });
      return;
    }

    this.setState({ isSubmitting: false, showAddPayment: undefined });
  }

  getFrameActionWidth(): number {
    // https://stripe.com/docs/payments/3d-secure#render-iframe
    if (!this.props.width) return 250;
    switch (this.props.width) {
      case 'xs':
        return 250;
      case 'sm':
        return 390;
      case 'md':
      case 'lg':
      case 'xl':
      default:
        return 600;
    }
  }

  async loadActionIframe(paymentStripeAction: PaymentStripeAction) {
    var stripe: Stripe | null = null;
    try {
      stripe = await this.props.stripePromise;
    } catch (e) {
      // Handle below
    }
    if (!stripe) {
      this.refreshBillingAfterPaymentClose = true;
      this.setState({
        paymentActionMessage: 'Payment gateway unavailable',
        paymentActionMessageSeverity: 'error',
      })
      return;
    }

    var result: { paymentIntent?: PaymentIntent, error?: StripeError } | undefined;
    try {
      result = await stripe.confirmCardPayment(
        paymentStripeAction.actionData.paymentIntentClientSecret,
        { return_url: `${window.location.protocol}//${window.location.host}/dashboard/${BillingPaymentActionRedirectPath}` },
        { handleActions: false });
    } catch (e) {
      this.refreshBillingAfterPaymentClose = true;
      this.setState({
        paymentActionMessage: 'Failed to load payment gateway',
        paymentActionMessageSeverity: 'error',
      })
      return;
    }

    if (result.error || !result.paymentIntent) {
      this.refreshBillingAfterPaymentClose = true;
      this.setState({
        paymentActionMessage: result.error?.message || 'Unknown payment failure',
        paymentActionMessageSeverity: 'error',
      })
      return;
    }

    if (result.paymentIntent.status === 'succeeded') {
      this.refreshBillingAfterPaymentClose = true;
      this.setState({
        paymentActionMessage: 'No action necessary',
        paymentActionMessageSeverity: 'success',
      })
      return;
    }

    if (result.paymentIntent.status === 'canceled') {
      this.refreshBillingAfterPaymentClose = true;
      this.setState({
        paymentActionMessage: 'Payment already canceled',
        paymentActionMessageSeverity: 'error',
      })
      return;
    }

    if (result.paymentIntent.status !== 'requires_action'
      || !result.paymentIntent.next_action?.redirect_to_url?.url) {
      this.refreshBillingAfterPaymentClose = true;
      this.setState({
        paymentActionMessage: `Unexpected payment status: ${result.paymentIntent.status}`,
        paymentActionMessageSeverity: 'error',
      })
      return;
    }

    // Setup iframe message listener
    this.paymentActionMessageListener = (ev: MessageEvent) => {
      if (ev.origin !== window.location.origin) return;
      if (typeof ev.data !== 'string' || ev.data !== BillingPaymentActionRedirectPath) return;
      this.refreshBillingAfterPaymentClose = true;
      this.setState({
        paymentActionMessage: 'Action completed',
        paymentActionMessageSeverity: 'info',
      })
    };
    window.addEventListener('message', this.paymentActionMessageListener);

    this.setState({ paymentActionUrl: result.paymentIntent.next_action.redirect_to_url.url });
  }
}

export const BillingPaymentActionRedirect = () => {
  window.top.postMessage(BillingPaymentActionRedirectPath, window.location.origin);
  return (
    <Message message='Please wait...' severity='info' />
  );
};

export default connect<ConnectProps, {}, {}, ReduxStateAdmin>((state, ownProps) => {
  if (state.account.billing.status === undefined) {
    ServerAdmin.get().dispatchAdmin().then(d => d.accountBillingAdmin({}));
  }
  const connectProps: ConnectProps = {
    accountStatus: state.account.account.status,
    account: state.account.account.account,
    accountBillingStatus: state.account.billing.status,
    accountBilling: state.account.billing.billing,
    isSuperAdmin: state.account.isSuperAdmin,
  };
  return connectProps;
}, null, null, { forwardRef: true })(withStyles(styles, { withTheme: true })(withRouter(withWidth()(BillingPage))));
