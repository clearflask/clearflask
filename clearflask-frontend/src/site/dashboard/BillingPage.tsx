
import { Box, Button, Collapse, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import ActiveIcon from '@material-ui/icons/Check';
import ErrorIcon from '@material-ui/icons/Error';
import WarnIcon from '@material-ui/icons/Warning';
import { CardNumberElement, ElementsConsumer } from '@stripe/react-stripe-js';
import { Stripe, StripeElements } from '@stripe/stripe-js';
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
import ErrorMsg from '../../app/ErrorMsg';
import DividerCorner from '../../app/utils/DividerCorner';
import Loader from '../../app/utils/Loader';
import AcceptTerms from '../../common/AcceptTerms';
import CreditCard from '../../common/CreditCard';
import StripeCreditCard from '../../common/StripeCreditCard';
import SubmitButton from '../../common/SubmitButton';
import { isTracking } from '../../common/util/detectEnv';
import PricingPlan from '../PricingPlan';
import BillingChangePlanDialog from './BillingChangePlanDialog';

const styles = (theme: Theme) => createStyles({
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
});
interface Props {
}
interface ConnectProps {
  accountStatus?: Status;
  account?: Admin.AccountAdmin;
  accountBillingStatus?: Status;
  accountBilling?: Admin.AccountBilling;
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
}
class BillingPage extends Component<Props & ConnectProps & WithStyles<typeof styles, true> & RouteComponentProps, State> {
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
    var hasAvailablePlansToSwitch: boolean = (this.props.accountBilling?.availablePlans || [])
      .filter(p => p.planid !== this.props.account?.plan.planid)
      .length > 0;
    var cardState: 'active' | 'warn' | 'error' = 'active';
    var paymentTitle, paymentDesc, showContactSupport, showSetPayment, setPaymentTitle, showCancelSubscription, showResumePlan, resumePlanDesc, planTitle, planDesc, showPlanChange;
    switch (this.props.account.subscriptionStatus) {
      case Admin.SubscriptionStatus.Active:
        paymentTitle = 'Automatic renewal is active';
        paymentDesc = 'You will be automatically billed at the next cycle and your plan will be renewed.';
        cardState = 'active';
        showSetPayment = true;
        setPaymentTitle = 'Update payment method';
        showCancelSubscription = true;
        planTitle = 'Your plan is active';
        planDesc = `You have full access to your ${this.props.account.plan.title} plan.`;
        if (hasAvailablePlansToSwitch) {
          planDesc += ' If you switch plans now, balance will be prorated.';
          showPlanChange = true;
        }
        break;
      case Admin.SubscriptionStatus.ActiveTrial:
        if (this.props.accountBilling?.payment) {
          paymentTitle = 'Automatic renewal is active';
          paymentDesc = 'Your first payment will be automatically billed at the end of the trial period.';
          cardState = 'active';
          showSetPayment = true;
          setPaymentTitle = 'Update payment method';
          showCancelSubscription = true;
          planTitle = 'Your plan is active';
          planDesc = `You have full access to your ${this.props.account.plan.title} plan.`;
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
          if (this.props.accountBilling?.billingPeriodEnd) {
            planTitle = (
              <React.Fragment>
                Your plan is active until your trial expires in&nbsp;<TimeAgo date={this.props.accountBilling?.billingPeriodEnd} />
              </React.Fragment>
            );
          } else {
            planTitle = 'Your plan is active until your trial expires';
          }
          planDesc = `You have full access to your ${this.props.account.plan.title} plan until your trial expires. Add a payment method to continue using our service beyond the trial period.`;
          if (hasAvailablePlansToSwitch) {
            showPlanChange = true;
          }
        }
        break;
      case Admin.SubscriptionStatus.ActivePaymentRetry:
        paymentTitle = 'Automatic renewal is having issues with your payment method';
        paymentDesc = 'We are having issues charging your payment method. We will retry your payment method again soon and we may cancel your service if unsuccessful.';
        cardState = 'error';
        showSetPayment = true;
        setPaymentTitle = 'Update payment method';
        showCancelSubscription = true;
        planTitle = 'Your plan is active';
        planDesc = `You have full access to your ${this.props.account.plan.title} plan; however, there is an issue with your payments. Please resolve all issues before you can change your plan.`;
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
        planDesc = `You have full access to your ${this.props.account.plan.title} plan until it cancels. Please resume your payments to continue using our service beyond next billing cycle.`;
        break;
      case Admin.SubscriptionStatus.TrialExpired:
        paymentTitle = 'Automatic renewal is inactive';
        paymentDesc = 'Your trial has expired. To continue using our service, add a payment method to enable automatic renewal.';
        cardState = 'error';
        showSetPayment = true;
        setPaymentTitle = 'Add payment method';
        planTitle = 'Your plan trial has expired';
        planDesc = `To continue your access to your ${this.props.account.plan.title} plan, please add a payment method.`;
        break;
      case Admin.SubscriptionStatus.Blocked:
        paymentTitle = 'Payments are blocked';
        paymentDesc = 'Contact support to reinstate your account.';
        showContactSupport = true;
        cardState = 'error';
        planTitle = 'Your plan is inactive';
        planDesc = `You have limited access to your ${this.props.account.plan.title} plan due to a payment issue. Please resolve all issues to continue using our service.`;
        break;
      case Admin.SubscriptionStatus.Pending:
        paymentTitle = 'Automatic renewal will commence soon';
        if (this.props.accountBilling?.billingPeriodEnd) {
          paymentDesc = (
            <React.Fragment>
              Automatic renewal is scheduled to be enabled in&nbsp;<TimeAgo date={this.props.accountBilling?.billingPeriodEnd} />
            </React.Fragment>
          );
        } else {
          paymentDesc = 'Automatic renewal is scheduled to be enabled in the future';
        }
        showSetPayment = true;
        if (this.props.accountBilling?.payment) {
          cardState = 'active';
          setPaymentTitle = 'Update payment method';
        } else {
          cardState = 'error';
          setPaymentTitle = 'Add payment method';
        }
        if (this.props.accountBilling?.payment) {
          showResumePlan = true;
          resumePlanDesc = 'Your subscription will no longer be cancelled. You will be automatically billed for our service starting now.';
        }
        planTitle = 'Your plan is scheduled to be active';
        if (this.props.accountBilling?.billingPeriodEnd) {
          planDesc = (
            <React.Fragment>
              You have limited access to your ${this.props.account.plan.title} plan until your plan starts in&nbsp;<TimeAgo date={this.props.accountBilling?.billingPeriodEnd} />
            </React.Fragment>
          );
        } else {
          planDesc = `You have limited access to your ${this.props.account.plan.title} plan until your plan starts.`;
        }
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
        planDesc = `You have limited access to your ${this.props.account.plan.title} plan since you cancelled your subscription. Please resume payment to continue using our service.`;
        break;
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
                        label: this.props.account?.plan.planid,
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
                <DialogTitle>Add payment method</DialogTitle>
                <DialogContent className={this.props.classes.center}>
                  <StripeCreditCard onFilledChanged={(isFilled) => this.setState({ stripePaymentFilled: isFilled })} />
                  <Collapse in={!!this.state.stripePaymentError}>
                    <ErrorMsg msg={this.state.stripePaymentError} />
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
                  <TableCell key='due'><Typography>invoiceItem.date</Typography></TableCell>
                  <TableCell key='status' align='center'><Typography>{invoiceItem.status}</Typography></TableCell>
                  <TableCell key='amount' align='right'><Typography>{invoiceItem.amount}</Typography></TableCell>
                  <TableCell key='desc'><Typography>{invoiceItem.description}</Typography></TableCell>
                  <TableCell key='invoiceLink'>
                    <Button onClick={() => this.onInvoiceClick(invoiceItem.invoiceNumber)}>View</Button>
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
              plan={this.props.account.plan}
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
            {showPlanChange && (
              <div className={this.props.classes.sectionButtons}>
                <Button
                  disabled={this.state.isSubmitting || this.state.showPlanChange}
                  onClick={() => {
                    if (isTracking()) {
                      ReactGA.event({
                        category: 'billing',
                        action: 'click-plan-switch-open',
                        label: this.props.account?.plan.planid,
                      });
                    }

                    this.setState({ showPlanChange: true });
                  }}
                >
                  Switch plan
                </Button>
              </div>
            )}
          </div>
        </div>
        <BillingChangePlanDialog
          open={!!this.state.showPlanChange}
          onClose={() => this.setState({ showPlanChange: undefined })}
          onSubmit={planid => {
            if (isTracking()) {
              ReactGA.event({
                category: 'billing',
                action: 'click-plan-switch-submit',
                label: planid,
              });
            }

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
        {plan}
        {payment}
        {invoices}
      </Loader>
    );
  }

  onInvoiceClick(invoiceNumber: number) {
    window.open(`${window.location.origin}/invoice/${invoiceNumber}`, '_blank')
  }

  async onPaymentSubmit(elements: StripeElements, stripe: Stripe) {
    if (isTracking()) {
      ReactGA.event({
        category: 'billing',
        action: this.props.accountBilling?.payment ? 'click-payment-update-submit' : 'click-payment-add-submit',
        label: this.props.account?.plan.planid,
        value: this.props.account?.plan.pricing?.basePrice,
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
        stripePaymentError: 'Unknown error: ' + JSON.stringify(er)
      });
      return;
    }

    try {
      await dispatcher.accountBillingAdmin();
    } catch (er) {
      this.setState({
        isSubmitting: false,
        stripePaymentError: 'Unknown error: ' + JSON.stringify(er)
      });
      return;
    }

    this.setState({ isSubmitting: false, showAddPayment: undefined });
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
}, null, null, { forwardRef: true })(withStyles(styles, { withTheme: true })(withRouter(BillingPage)));
