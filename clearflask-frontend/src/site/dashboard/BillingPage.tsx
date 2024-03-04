// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import {
  Box,
  Button,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControlLabel,
  FormHelperText,
  Link as MuiLink,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
  withWidth,
  WithWidthProps,
} from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import ActiveIcon from '@material-ui/icons/Check';
import ErrorIcon from '@material-ui/icons/Error';
import WarnIcon from '@material-ui/icons/Warning';
import { Color } from '@material-ui/lab';
import { CardNumberElement, ElementsConsumer } from '@stripe/react-stripe-js';
import { PaymentIntent, Stripe, StripeElements, StripeError } from '@stripe/stripe-js';
import { Component } from 'react';
import ReactGA from 'react-ga';
import ReactGA4 from 'react-ga4';
import { connect } from 'react-redux';
import { RouteComponentProps, withRouter } from 'react-router';
import PoweredByStripe from '../../../public/img/dashboard/PoweredByStripe.svg';
import * as Admin from '../../api/admin';
import { Status } from '../../api/server';
import ServerAdmin, { ReduxStateAdmin } from '../../api/serverAdmin';
import LoadingPage from '../../app/LoadingPage';
import Loader from '../../app/utils/Loader';
import TimeAgoI18n from '../../app/utils/TimeAgoI18n';
import { tourSetGuideState } from '../../common/ClearFlaskTourProvider';
import { PostsMaxCount, TeammatePlanId } from '../../common/config/settings/UpgradeWrapper';
import CreditCard from '../../common/CreditCard';
import ImgIso from '../../common/ImgIso';
import Message from '../../common/Message';
import StripeCreditCard from '../../common/StripeCreditCard';
import SubmitButton from '../../common/SubmitButton';
import { TourAnchor, TourDefinitionGuideState } from '../../common/tour';
import { initialWidth } from '../../common/util/screenUtil';
import { trackingBlock } from '../../common/util/trackingDelay';
import windowIso from '../../common/windowIso';
import PricingPlan from '../PricingPlan';
import BillingChangePlanDialog from './BillingChangePlanDialog';
import { ProjectSettingsBase, Section } from './ProjectSettings';
import { detectEnv, Environment } from '../../common/util/detectEnv';
import { Link } from 'react-router-dom';

/** If changed, also change in KillBilling.java */
interface PaymentStripeAction {
  actionType: 'stripe-next-action';
  actionData: {
    'paymentIntentClientSecret': string,
  };
}

/** If changed, also change in KillBillPlanStore.java */
export const AddonWhitelabel = 'whitelabel';
export const AddonPrivateProjects = 'private-projects';
export const AddonExtraProject = 'extra-project';
export const AddonExtraTeammate = 'extra-teammate';

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
  addPaymentDialogPaper: {
    margin: theme.spacing(2),
  },
  poweredByStripeImg: {
    width: '100%',
  },
  sectionSpacing: {
    marginTop: theme.spacing(2),
  },
  paymentActionMessage: {
    margin: theme.spacing(4, 0),
  },
  addonsContainer: {
    display: 'flex',
    flexDirection: 'column',
    rowGap: theme.spacing(1),
  },
});

interface Props {
  stripePromise: Promise<Stripe | null>;
}

interface ConnectProps {
  callOnMount?: () => void,
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
  showAddExtraTeammate?: boolean;
  addExtraTeammateCount?: number;
  invoices?: Admin.InvoiceItem[];
  invoicesCursor?: string;
  paymentActionOpen?: boolean;
  paymentActionUrl?: string;
  paymentActionMessage?: string;
  paymentActionMessageSeverity?: Color;
  showFlatYearlyChange?: boolean;
  flatYearlyPrice?: number;
  showSponsorMonthlyChange?: boolean;
  sponsorMonthlyPrice?: number;
  showAddonsChange?: boolean;
  whitelabel?: boolean;
  privateProjects?: boolean;
  extraProjects?: number;
  extraTeammates?: number;
  showCreditAdjustment?: boolean;
  creditAmount?: number;
  creditDescription?: string;
  showLicenseDialog?: boolean;
  license?: string;
}

class BillingPage extends Component<Props & ConnectProps & WithStyles<typeof styles, true> & RouteComponentProps & WithWidthProps, State> {
  state: State = {
    addExtraTeammateCount: 1,
  };
  refreshBillingAfterPaymentClose?: boolean;
  paymentActionMessageListener?: any;

  constructor(props) {
    super(props);

    props.callOnMount?.();
  }

  componentWillUnmount() {
    this.paymentActionMessageListener && !windowIso.isSsr && windowIso.removeEventListener('message', this.paymentActionMessageListener);
  }

  render() {
    if (!this.props.account) {
      return 'Need to login to see this page';
    }

    const status = this.props.accountStatus === Status.FULFILLED ? this.props.accountBillingStatus : this.props.accountStatus;
    if (!this.props.accountBilling || status !== Status.FULFILLED) {
      return (
        <Loader skipFade status={status} />
      );
    }

    var cardNumber, cardExpiry, cardStateIcon;
    if (!!this.props.accountBilling?.payment) {
      cardNumber = (
        <>
          <span className={this.props.classes.blurry}>5200&nbsp;8282&nbsp;8282&nbsp;</span>
          {this.props.accountBilling.payment.last4}
        </>
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
    const isSelfhost = detectEnv() === Environment.PRODUCTION_SELF_HOST;
    var hasAvailablePlansToSwitch: boolean = (this.props.accountBilling?.availablePlans || [])
      .filter(p => p.basePlanId !== this.props.accountBilling?.plan.basePlanId)
      .length > 0;
    var cardState: 'active' | 'warn' | 'error' = 'active';
    var showAddExtraTeammate = !!this.props.accountBilling?.teammateMax;
    var paymentTitle, paymentDesc, showContactSupport, showSetPayment, setPaymentTitle, setPaymentAction,
      showCancelSubscription, showResumePlan, resumePlanDesc, planTitle, planDesc, showPlanChange,
      endOfTermChangeToPlanTitle, endOfTermChangeToPlanDesc, switchPlanTitle;
    switch (this.props.account.subscriptionStatus) {
      case Admin.SubscriptionStatus.Active:
        if (this.props.accountBilling?.plan.basePlanId === TeammatePlanId) {
          paymentTitle = 'No payment required';
          paymentDesc = 'While you only access external projects, payments are made by the project owner. No payment is required from you at this time.';
          cardState = 'active';
          showSetPayment = false;
          showCancelSubscription = false;
          planTitle = 'You are not on a plan';
          planDesc = 'While you only access external projects, you are not required to be on a plan. If you decide to create a project under your account, you will be able to choose a plan and your trial will begin.';
          if (hasAvailablePlansToSwitch) {
            showPlanChange = true;
            switchPlanTitle = 'Choose plan';
          }
        } else if (isSelfhost) {
          if (this.props.accountBilling?.plan.basePlanId === 'selfhost-free') {
            planTitle = 'Your free plan is active';
            planDesc = 'You have full access within your free plan. To get more benefits, purchase and provide a license.';
          } else if (this.props.accountBilling?.plan.basePlanId === 'self-host') {
            planTitle = 'Your plan is active';
            planDesc = 'You have full access within your plan. You have been grandfathered into this plan without a license.';
          } else {
            planTitle = 'Your licensed plan is active';
            planDesc = 'Your license will be validated periodically.';
          }
          if (hasAvailablePlansToSwitch) {
            showPlanChange = true;
          }
        } else {
          paymentTitle = 'Automatic renewal is active';
          paymentDesc = 'You will be automatically billed at the next cycle and your plan will be renewed.';
          cardState = 'active';
          showSetPayment = true;
          setPaymentTitle = 'Update payment method';
          showCancelSubscription = true;
          planTitle = 'Your plan is active';
          planDesc = `You have full access to your ${this.props.accountBilling.plan.title} plan.`;
          if (hasAvailablePlansToSwitch) {
            planDesc += ' If you upgrade your plan, changes will reflect immediately. If you downgrade your plan, changes will take effect at the end of the term.';
            showPlanChange = true;
          }
        }
        break;
      case Admin.SubscriptionStatus.ActiveTrial:
        if (this.props.accountBilling?.payment) {
          paymentTitle = 'Automatic payment is active';
          if (this.props.accountBilling?.billingPeriodEnd) {
            paymentDesc = (
              <>
                A payment will be automatically billed at the end of the trial period in&nbsp;<TimeAgoI18n
                date={this.props.accountBilling?.billingPeriodEnd} />.
              </>
            );
          } else {
            paymentDesc = `A payment will be automatically billed at the end of the trial period.`;
          }
          cardState = 'active';
          showSetPayment = true;
          setPaymentTitle = 'Update payment method';
          planTitle = 'Your plan is active';
          planDesc = `You have full access to your ${this.props.accountBilling.plan.title} plan.`;
          if (hasAvailablePlansToSwitch) {
            planDesc += ' If you switch plans now, your first payment at the end of your trial will reflect your new plan.';
            showPlanChange = true;
          }
        } else {
          paymentTitle = 'Automatic payment requires a payment method';
          paymentDesc = 'To continue using our service beyond the trial period, add a payment method to enable automatic payment.';
          cardState = 'warn';
          showSetPayment = true;
          setPaymentTitle = 'Add payment method';
          planTitle = 'Your plan is active until your trial ends';
          if (this.props.accountBilling?.billingPeriodEnd) {
            planDesc = (
              <>
                You have full access to your {this.props.accountBilling.plan.title} plan until your
                trial expires in&nbsp;<TimeAgoI18n date={this.props.accountBilling?.billingPeriodEnd} />. Add
                a payment method to continue using our service beyond the trial period.
              </>
            );
          } else {
            planDesc = `You have full access to your ${this.props.accountBilling.plan.title} plan until your trial expires. Add a payment method to continue using our service beyond the trial period.`;
          }
          if (hasAvailablePlansToSwitch) {
            showPlanChange = true;
          }
        }
        break;
      case Admin.SubscriptionStatus.ActivePaymentRetry:
        paymentTitle = 'Automatic renewal is having issues with your payment method';
        paymentDesc = 'We are having issues charging your payment method. We will retry your payment method again soon and we may block your service if unsuccessful.';
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
        setPaymentAction = 'Add and resume subscription';
        showResumePlan = true;
        resumePlanDesc = 'Your subscription will no longer be cancelled. You will be automatically billed for our service at the next billing cycle.';
        if (this.props.accountBilling?.billingPeriodEnd) {
          planTitle = (
            <>
              Your plan is active until&nbsp;<TimeAgoI18n date={this.props.accountBilling?.billingPeriodEnd} />
            </>
          );
        } else {
          planTitle = 'Your plan is active until the end of the billing cycle';
        }
        planDesc = `You have full access to your ${this.props.accountBilling.plan.title} plan until it cancels. Please resume your payments to continue using our service beyond next billing cycle.`;
        break;
      case Admin.SubscriptionStatus.Limited:
        if (isSelfhost) {
          planTitle = 'Your activity is limited';
          planDesc = 'Your license is invalid, you need to purchase an extension or provide another license.';
          if (hasAvailablePlansToSwitch) {
            showPlanChange = true;
          }
        } else {
          paymentTitle = 'Automatic renewal is active';
          paymentDesc = 'You will be automatically billed at the next cycle and your plan will be renewed.';
          cardState = 'active';
          showSetPayment = true;
          setPaymentTitle = 'Update payment method';
          showCancelSubscription = true;
          planTitle = 'Your plan is limited';
          planDesc = `You have limited access to your ${this.props.accountBilling.plan.title} plan due to going over your plan limits. Please resolve all issues to continue using our service.`;
          if (hasAvailablePlansToSwitch) {
            planDesc += ' If you upgrade your plan, changes will reflect immediately. If you downgrade your plan, changes will take effect at the end of the term.';
            showPlanChange = true;
          }
        }
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
        if (isSelfhost) {
          planTitle = 'Your activity is blocked';
          planDesc = 'You need to provide a license to resume your project.';
          if (hasAvailablePlansToSwitch) {
            showPlanChange = true;
          }
        } else {
          paymentTitle = 'Payments are blocked';
          paymentDesc = 'Contact support to reinstate your account.';
          showContactSupport = true;
          cardState = 'error';
          planTitle = 'Your plan is inactive';
          planDesc = `You have limited access to your ${this.props.accountBilling.plan.title} plan due to a payment issue. Please resolve all issues to continue using our service.`;
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
        planDesc = `You have limited access to your ${this.props.accountBilling.plan.title} plan since you cancelled your subscription. Please resume payment to continue using our service.`;
        break;
    }
    if (this.props.accountBilling?.endOfTermChangeToPlan) {
      endOfTermChangeToPlanTitle = `Pending plan change to ${this.props.accountBilling.endOfTermChangeToPlan.title}`;
      endOfTermChangeToPlanDesc = `Your requested change of plans to ${this.props.accountBilling.endOfTermChangeToPlan.title} plan will take effect at the end of the term.`;
    }
    switch (cardState) {
      case 'active':
        cardStateIcon = (<ActiveIcon color="primary" />);
        break;
      case 'warn':
        cardStateIcon = (<WarnIcon style={{ color: this.props.theme.palette.warning.main }} />);
        break;
      case 'error':
        cardStateIcon = (<ErrorIcon color="error" />);
        break;
    }
    const creditCard = (
      <TourAnchor anchorId="settings-credit-card" placement="bottom">
        <CreditCard
          className={this.props.classes.creditCard}
          brand={cardStateIcon}
          numberInput={cardNumber}
          expiryInput={cardExpiry}
          cvcInput={(<span className={this.props.classes.blurry}>642</span>)}
        />
      </TourAnchor>
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
      <>
        <Message
          className={this.props.classes.paymentActionMessage}
          message="One of your payments requires additional information"
          severity="error"
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
          onClose={paymentActionOnClose}
        >
          {this.state.paymentActionMessage ? (
            <>
              <DialogContent>
                <Message
                  message={this.state.paymentActionMessage}
                  severity={this.state.paymentActionMessageSeverity || 'info'}
                />
              </DialogContent>
              <DialogActions>
                <Button onClick={paymentActionOnClose}>Dismiss</Button>
              </DialogActions>
            </>
          ) : (this.state.paymentActionUrl ? (
            <iframe
              title="Complete outstanding payment action"
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
      </>
    ) : undefined;

    const plan = (
      <Section
        title="Plan"
        preview={(
          <div className={this.props.classes.planContainer}>
            <TourAnchor anchorId="settings-billing-plan" placement="bottom" disablePortal>
              <PricingPlan
                selected
                className={this.props.classes.plan}
                plan={this.props.accountBilling.plan}
              />
            </TourAnchor>
            {(this.props.accountBilling?.trackedUsers !== undefined) && (
              <Box display="grid" gridTemplateAreas='"mauLbl mauAmt"' alignItems="baseline"
                   gridGap="10px 10px">
                <Box gridArea="mauLbl"><Typography component="div">Tracked users:</Typography></Box>
                <Box gridArea="mauAmt" display="flex">
                  <Typography component="div" variant="h5">
                    {this.props.accountBilling.trackedUsers}
                  </Typography>
                </Box>
              </Box>
            )}
            {(this.props.accountBilling?.postCount !== undefined) && (
              <Box display="grid" gridTemplateAreas='"postCountLbl postCountAmt"' alignItems="baseline"
                   gridGap="10px 10px">
                <Box gridArea="postCountLbl"><Typography component="div">Post count:</Typography></Box>
                <Box gridArea="postCountAmt" display="flex">
                  <Typography component="div" variant="h5" color={
                    this.props.accountBilling.postCount > (PostsMaxCount[this.props.accountBilling.plan.basePlanId] || Infinity)
                      ? 'error' : undefined}>
                    {this.props.accountBilling.postCount}
                  </Typography>
                </Box>
              </Box>
            )}
            {(this.props.accountBilling?.teammateCount !== undefined) && (
              <Box display="grid" gridTemplateAreas='"teammateCountLbl teammateCountAmt"'
                   alignItems="baseline" gridGap="10px 10px">
                <Box gridArea="teammateCountLbl"><Typography component="div">Teammate
                  count:</Typography></Box>
                <Box gridArea="teammateCountAmt" display="flex">
                  <Typography component="div" variant="h5">
                    {this.props.accountBilling.teammateCount}
                    {this.props.accountBilling.teammateMax && (
                      <>
                        &nbsp;/&nbsp;{this.props.accountBilling.teammateMax}
                      </>
                    )}
                  </Typography>
                </Box>
              </Box>
            )}
          </div>
        )}
        content={(
          <div className={this.props.classes.actionContainer}>
            <p><Typography variant="h6" component="div" color="textPrimary">{planTitle}</Typography></p>
            <Typography color="textSecondary">{planDesc}</Typography>
            {(endOfTermChangeToPlanTitle || endOfTermChangeToPlanDesc) && (
              <>
                <p><Typography variant="h6" component="div" color="textPrimary"
                               className={this.props.classes.sectionSpacing}>{endOfTermChangeToPlanTitle}</Typography>
                </p>
                <Typography color="textSecondary">{endOfTermChangeToPlanDesc}</Typography>
              </>
            )}
            {!!isSelfhost && (
              <>
                <Dialog
                  open={!!this.state.showLicenseDialog}
                  onClose={() => this.setState({ showLicenseDialog: undefined })}
                  scroll="body"
                  maxWidth="md"
                >
                  <DialogTitle>License</DialogTitle>
                  <DialogContent className={this.props.classes.addonsContainer}>
                    <div>
                      Purchase a Self-hosted license <MuiLink target="_blank" rel="noreferrer"
                                                              href="https://clearflask.com/pricing">here</MuiLink> to
                      unlock more functionality.
                    </div>
                    <br />
                    <TextField
                      label="License"
                      variant="outlined"
                      value={(this.state.license !== undefined ? this.state.license : this.props.accountBilling?.appliedLicenseKey) || ''}
                      onChange={e => this.setState({ license: e.target.value })}
                    />
                  </DialogContent>
                  <DialogActions>
                    <Button onClick={() => this.setState({ showLicenseDialog: undefined })}
                    >Cancel</Button>
                    <SubmitButton
                      isSubmitting={this.state.isSubmitting}
                      disabled={!this.props.accountBilling?.appliedLicenseKey}
                      color="secondary"
                      onClick={() => {
                        this.setState({ isSubmitting: true });
                        ServerAdmin.get().dispatchAdmin().then(d => d.accountUpdateAdmin({
                          accountUpdateAdmin: {
                            applyLicenseKey: '', // Empty string removes license
                          },
                        }).then(() => d.accountBillingAdmin({})))
                          .then(() => this.setState({
                            isSubmitting: false,
                            showLicenseDialog: undefined,
                            license: undefined,
                          }))
                          .catch(er => this.setState({ isSubmitting: false }));
                      }}
                    >Remove</SubmitButton>
                    <SubmitButton
                      isSubmitting={this.state.isSubmitting}
                      disabled={!this.state.license}
                      color="primary"
                      onClick={() => {
                        if (!this.state.license) return;
                        this.setState({ isSubmitting: true });
                        ServerAdmin.get().dispatchAdmin().then(d => d.accountUpdateAdmin({
                          accountUpdateAdmin: {
                            applyLicenseKey: this.state.license,
                          },
                        }).then(() => d.accountBillingAdmin({})))
                          .then(() => this.setState({
                            isSubmitting: false,
                            showLicenseDialog: undefined,
                            license: undefined,
                          }))
                          .catch(er => this.setState({ isSubmitting: false }));
                      }}
                    >Apply</SubmitButton>
                  </DialogActions>
                </Dialog>
                <div className={this.props.classes.sectionButtons}>
                  <Button
                    disabled={this.state.isSubmitting}
                    onClick={() => this.setState({ showLicenseDialog: true })}
                  >{!this.props.accountBilling?.appliedLicenseKey ? 'Add License' : 'Change License'}</Button>
                </div>
              </>
            )}
            {showPlanChange && (
              <div className={this.props.classes.sectionButtons}>
                <Button
                  disabled={this.state.isSubmitting || this.state.showPlanChange}
                  onClick={() => {
                    trackingBlock(() => {
                      [ReactGA4, ReactGA].forEach(ga =>
                        ga.event({
                          category: 'billing',
                          action: 'click-plan-switch-open',
                          label: this.props.accountBilling?.plan.basePlanId,
                        }),
                      );
                    });

                    this.setState({ showPlanChange: true });
                  }}
                >
                  {switchPlanTitle || 'Switch plan'}
                </Button>
              </div>
            )}
            {showPlanChange && !isSelfhost && (
              <div className={this.props.classes.sectionButtons}>
                <Button
                  disabled={this.state.isSubmitting || this.state.showPlanChange}
                  onClick={() => this.props.history.push('/coupon')}
                >
                  Redeem coupon
                </Button>
              </div>
            )}
            {showAddExtraTeammate && (
              <div className={this.props.classes.sectionButtons}>
                <Button
                  disabled={this.state.isSubmitting || this.state.showAddExtraTeammate}
                  onClick={() => this.setState({ showAddExtraTeammate: true })}
                >
                  {switchPlanTitle || 'Add Teammate'}
                </Button>
                <Dialog
                  open={!!this.state.showAddExtraTeammate}
                  onClose={() => this.setState({ showAddExtraTeammate: undefined })}
                  scroll="body"
                  maxWidth="md"
                >
                  <DialogTitle>Add teammate</DialogTitle>
                  <DialogContent>
                    Add additional teammate slots to your plan.
                    <p />
                    <TextField
                      variant="outlined"
                      type="number"
                      label="Number of extra teammates"
                      value={this.state.addExtraTeammateCount !== undefined ? this.state.addExtraTeammateCount : 0}
                      onChange={e => {
                        var addExtraTeammateCount = parseInt(e.target.value);
                        if (addExtraTeammateCount < 0) {
                          addExtraTeammateCount = 0;
                        } else if (addExtraTeammateCount > 10) {
                          addExtraTeammateCount = 10;
                        }
                        this.setState({ addExtraTeammateCount: addExtraTeammateCount });
                      }}
                    />
                    <p />
                    You will be invoiced the following amount:
                    <br />
                    <Box display="flex" justifyContent="center">
                      <Typography component="div" variant="h6" color="textSecondary"
                                  style={{ alignSelf: 'flex-start' }}>{'$'}</Typography>
                      <Typography component="div" variant="h4">
                        {(this.state.addExtraTeammateCount || 0)
                          * (this.props.accountBilling?.plan.pricing?.admins?.additionalPrice || 0)}
                      </Typography>
                    </Box>
                  </DialogContent>
                  <DialogActions>
                    <Button onClick={() => this.setState({ showAddExtraTeammate: undefined })}
                    >Cancel</Button>
                    <SubmitButton
                      isSubmitting={this.state.isSubmitting}
                      disabled={!this.state.addExtraTeammateCount}
                      color="primary"
                      onClick={() => {
                        this.setState({ isSubmitting: true });
                        ServerAdmin.get().dispatchAdmin().then(d => d.accountUpdateAdmin({
                          accountUpdateAdmin: {
                            addExtraTeammates: this.state.addExtraTeammateCount,
                          },
                        }).then(() => d.accountBillingAdmin({})))
                          .then(() => this.setState({
                            isSubmitting: false,
                            showAddExtraTeammate: undefined,
                            addExtraTeammateCount: 1,
                          }))
                          .catch(er => this.setState({ isSubmitting: false }));
                      }}
                    >Purchase</SubmitButton>
                  </DialogActions>
                </Dialog>
              </div>
            )}
            {this.props.isSuperAdmin && !isSelfhost && (
              <>
                <Dialog
                  open={!!this.state.showSponsorMonthlyChange}
                  onClose={() => this.setState({ showSponsorMonthlyChange: undefined })}
                  scroll="body"
                  maxWidth="md"
                >
                  <DialogTitle>Switch to sponsor plan</DialogTitle>
                  <DialogContent>
                    <TextField
                      variant="outlined"
                      type="number"
                      label="Monthly price"
                      value={this.state.sponsorMonthlyPrice !== undefined ? this.state.sponsorMonthlyPrice : ''}
                      onChange={e => this.setState({ sponsorMonthlyPrice: parseInt(e.target.value) >= 0 ? parseInt(e.target.value) : undefined })}
                    />
                  </DialogContent>
                  <DialogActions>
                    <Button onClick={() => this.setState({ showSponsorMonthlyChange: undefined })}
                    >Cancel</Button>
                    <SubmitButton
                      isSubmitting={this.state.isSubmitting}
                      disabled={this.state.sponsorMonthlyPrice === undefined}
                      color="primary"
                      onClick={() => {
                        this.setState({ isSubmitting: true });
                        ServerAdmin.get().dispatchAdmin().then(d => d.accountUpdateSuperAdmin({
                          accountUpdateSuperAdmin: {
                            changeToSponsorPlanWithMonthlyPrice: this.state.sponsorMonthlyPrice,
                          },
                        }).then(() => d.accountBillingAdmin({})))
                          .then(() => this.setState({
                            isSubmitting: false,
                            showSponsorMonthlyChange: undefined,
                          }))
                          .catch(er => this.setState({ isSubmitting: false }));
                      }}
                    >Change</SubmitButton>
                  </DialogActions>
                </Dialog>
                <Dialog
                  open={!!this.state.showFlatYearlyChange}
                  onClose={() => this.setState({ showFlatYearlyChange: undefined })}
                  scroll="body"
                  maxWidth="md"
                >
                  <DialogTitle>Switch to yearly plan</DialogTitle>
                  <DialogContent>
                    <TextField
                      variant="outlined"
                      type="number"
                      label="Yearly flat price"
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
                      color="primary"
                      onClick={() => {
                        this.setState({ isSubmitting: true });
                        ServerAdmin.get().dispatchAdmin().then(d => d.accountUpdateSuperAdmin({
                          accountUpdateSuperAdmin: {
                            changeToFlatPlanWithYearlyPrice: this.state.flatYearlyPrice || 0,
                          },
                        }).then(() => d.accountBillingAdmin({})))
                          .then(() => this.setState({
                            isSubmitting: false,
                            showFlatYearlyChange: undefined,
                          }))
                          .catch(er => this.setState({ isSubmitting: false }));
                      }}
                    >Change</SubmitButton>
                  </DialogActions>
                </Dialog>
                <div className={this.props.classes.sectionButtons}>
                  <Button
                    disabled={this.state.isSubmitting}
                    onClick={() => this.setState({ showFlatYearlyChange: true })}
                  >Flatten</Button>
                </div>
                <div className={this.props.classes.sectionButtons}>
                  <Button
                    disabled={this.state.isSubmitting}
                    onClick={() => this.setState({ showSponsorMonthlyChange: true })}
                  >Sponsor</Button>
                </div>
              </>
            )}
            {this.props.isSuperAdmin && !isSelfhost && (
              <>
                <Dialog
                  open={!!this.state.showAddonsChange}
                  onClose={() => this.setState({ showAddonsChange: undefined })}
                  scroll="body"
                  maxWidth="md"
                >
                  <DialogTitle>Manage addons</DialogTitle>
                  <DialogContent className={this.props.classes.addonsContainer}>
                    <TextField
                      label="Extra projects"
                      variant="outlined"
                      type="number"
                      value={this.state.extraProjects !== undefined ? this.state.extraProjects : (this.props.account.addons?.[AddonExtraProject] || 0)}
                      onChange={e => this.setState({ extraProjects: parseInt(e.target.value) >= 0 ? parseInt(e.target.value) : undefined })}
                    />
                    <TextField
                      label="Extra teammates"
                      variant="outlined"
                      type="number"
                      value={this.state.extraTeammates !== undefined ? this.state.extraTeammates : (this.props.account.addons?.[AddonExtraTeammate] || 0)}
                      onChange={e => this.setState({ extraTeammates: parseInt(e.target.value) >= 0 ? parseInt(e.target.value) : undefined })}
                    />
                    <FormControlLabel
                      control={(
                        <Switch
                          checked={this.state.whitelabel !== undefined ? this.state.whitelabel : !!this.props.account.addons?.[AddonWhitelabel]}
                          onChange={(e, checked) => this.setState({ whitelabel: !!checked })}
                          color="default"
                        />
                      )}
                      label={(<FormHelperText>Whitelabel</FormHelperText>)}
                    />
                    <FormControlLabel
                      control={(
                        <Switch
                          checked={this.state.privateProjects !== undefined ? this.state.privateProjects : !!this.props.account.addons?.[AddonPrivateProjects]}
                          onChange={(e, checked) => this.setState({ privateProjects: !!checked })}
                          color="default"
                        />
                      )}
                      label={(<FormHelperText>Private projects</FormHelperText>)}
                    />
                  </DialogContent>
                  <DialogActions>
                    <Button onClick={() => this.setState({ showAddonsChange: undefined })}
                    >Cancel</Button>
                    <SubmitButton
                      isSubmitting={this.state.isSubmitting}
                      disabled={this.state.whitelabel === undefined
                        && this.state.privateProjects === undefined
                        && this.state.extraProjects === undefined
                        && this.state.extraTeammates === undefined}
                      color="primary"
                      onClick={() => {
                        if (this.state.whitelabel === undefined
                          && this.state.privateProjects === undefined
                          && this.state.extraProjects === undefined
                          && this.state.extraTeammates === undefined) return;

                        this.setState({ isSubmitting: true });
                        ServerAdmin.get().dispatchAdmin().then(d => d.accountUpdateSuperAdmin({
                          accountUpdateSuperAdmin: {
                            addons: {
                              ...(this.state.whitelabel === undefined ? {} : {
                                [AddonWhitelabel]: this.state.whitelabel ? 'true' : '',
                              }),
                              ...(this.state.privateProjects === undefined ? {} : {
                                [AddonPrivateProjects]: this.state.privateProjects ? 'true' : '',
                              }),
                              ...(this.state.extraProjects === undefined ? {} : {
                                [AddonExtraProject]: `${this.state.extraProjects}`,
                              }),
                              ...(this.state.extraTeammates === undefined ? {} : {
                                [AddonExtraTeammate]: `${this.state.extraTeammates}`,
                              }),
                            },
                          },
                        }).then(() => d.accountBillingAdmin({})))
                          .then(() => this.setState({
                            isSubmitting: false,
                            showAddonsChange: undefined,
                          }))
                          .catch(er => this.setState({ isSubmitting: false }));
                      }}
                    >Change</SubmitButton>
                  </DialogActions>
                </Dialog>
                <div className={this.props.classes.sectionButtons}>
                  <Button
                    disabled={this.state.isSubmitting}
                    onClick={() => this.setState({ showAddonsChange: true })}
                  >Addons</Button>
                </div>
              </>
            )}
            {this.props.isSuperAdmin && !isSelfhost && (
              <>
                <Dialog
                  open={!!this.state.showCreditAdjustment}
                  onClose={() => this.setState({ showCreditAdjustment: undefined })}
                  scroll="body"
                  maxWidth="md"
                >
                  <DialogTitle>Credit adjustment</DialogTitle>
                  <DialogContent className={this.props.classes.addonsContainer}>
                    Add the following amount to the account.
                    <br />
                    May be negative to add a charge on the account.
                    <br />
                    <TextField
                      label="Amount"
                      variant="outlined"
                      type="number"
                      value={this.state.creditAmount || 0}
                      onChange={e => this.setState({ creditAmount: parseInt(e.target.value) })}
                    />
                    <TextField
                      label="Description"
                      variant="outlined"
                      value={this.state.creditDescription || ''}
                      onChange={e => this.setState({ creditDescription: e.target.value })}
                    />
                  </DialogContent>
                  <DialogActions>
                    <Button onClick={() => this.setState({ showCreditAdjustment: undefined })}
                    >Cancel</Button>
                    <SubmitButton
                      isSubmitting={this.state.isSubmitting}
                      disabled={!this.props.account
                        || !this.state.creditAmount
                        || !this.state.creditDescription}
                      color="primary"
                      onClick={() => {
                        if (!this.props.account
                          || !this.state.creditAmount
                          || !this.state.creditDescription) return;

                        this.setState({ isSubmitting: true });
                        ServerAdmin.get().dispatchAdmin().then(d => d.accountCreditAdjustmentSuperAdmin({
                          accountCreditAdjustment: {
                            accountId: this.props.account!.accountId,
                            amount: this.state.creditAmount!,
                            description: this.state.creditDescription!,
                          },
                        }).then(() => d.accountBillingAdmin({})))
                          .then(() => this.setState({
                            isSubmitting: false,
                            showCreditAdjustment: undefined,
                            creditAmount: undefined,
                            creditDescription: undefined,
                          }))
                          .catch(er => this.setState({ isSubmitting: false }));
                      }}
                    >Change</SubmitButton>
                  </DialogActions>
                </Dialog>
                <div className={this.props.classes.sectionButtons}>
                  <Button
                    disabled={this.state.isSubmitting}
                    onClick={() => this.setState({ showCreditAdjustment: true })}
                  >Credit</Button>
                </div>
              </>
            )}
            <BillingChangePlanDialog
              open={!!this.state.showPlanChange}
              onClose={() => this.setState({ showPlanChange: undefined })}
              onSubmit={basePlanId => {
                trackingBlock(() => {
                  [ReactGA4, ReactGA].forEach(ga =>
                    ga.event({
                      category: 'billing',
                      action: 'click-plan-switch-submit',
                      label: basePlanId,
                    }),
                  );
                });

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
          </div>
        )}
      />
    );

    // No need to payment and invoices for selfhosting
    if (isSelfhost) {
      return (
        <ProjectSettingsBase title="Billing">
          {plan}
        </ProjectSettingsBase>
      );
    }

    const hasPayable = (this.props.accountBilling?.accountPayable || 0) > 0;
    const hasReceivable = (this.props.accountBilling?.accountReceivable || 0) > 0;
    const payment = (
      <Section
        title="Payment"
        preview={(
          <div className={this.props.classes.creditCardContainer}>
            {creditCard}
            <Box display="grid" gridTemplateAreas='"payTtl payAmt" "rcvTtl rcvAmt"' alignItems="center"
                 gridGap="10px 10px">
              {hasPayable && (
                <>
                  <Box gridArea="payTtl"><Typography component="div">Credits:</Typography></Box>
                  <Box gridArea="payAmt" display="flex">
                    <Typography component="div" variant="h6" color="textSecondary"
                                style={{ alignSelf: 'flex-start' }}>{'$'}</Typography>
                    <Typography component="div" variant="h4"
                                color={hasPayable ? 'primary' : undefined}>
                      {this.props.accountBilling?.accountPayable || 0}
                    </Typography>
                  </Box>
                </>
              )}
              {(hasReceivable || !hasPayable) && (
                <>
                  <Box gridArea="rcvTtl"><Typography component="div">Overdue:</Typography></Box>
                  <Box gridArea="rcvAmt" display="flex">
                    <Typography component="div" variant="h6" color="textSecondary"
                                style={{ alignSelf: 'flex-start' }}>{'$'}</Typography>
                    <Typography component="div" variant="h4"
                                color={hasReceivable ? 'error' : undefined}>
                      {this.props.accountBilling?.accountReceivable || 0}
                    </Typography>
                  </Box>
                </>
              )}
            </Box>
          </div>
        )}
        content={(
          <div className={this.props.classes.actionContainer}>
            <p><Typography variant="h6" color="textPrimary" component="div">{paymentTitle}</Typography></p>
            <Typography color="textSecondary">{paymentDesc}</Typography>
            <div className={this.props.classes.sectionButtons}>
              {showContactSupport && (
                <Button
                  disabled={this.state.isSubmitting || this.state.showAddPayment}
                  component={Link}
                  to="/contact/support"
                >Contact support</Button>
              )}
              {showSetPayment && (
                <TourAnchor anchorId="settings-add-payment-open" placement="bottom">
                  {(next, isActive, anchorRef) => (
                    <SubmitButton
                      buttonRef={anchorRef}
                      isSubmitting={this.state.isSubmitting}
                      disabled={this.state.showAddPayment}
                      onClick={() => {
                        trackingBlock(() => {
                          [ReactGA4, ReactGA].forEach(ga =>
                            ga.event({
                              category: 'billing',
                              action: this.props.accountBilling?.payment ? 'click-payment-update-open' : 'click-payment-add-open',
                              label: this.props.accountBilling?.plan.basePlanId,
                            }),
                          );
                        });
                        this.setState({ showAddPayment: true });
                        next();
                      }}
                    >
                      {setPaymentTitle}
                    </SubmitButton>
                  )}
                </TourAnchor>
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
                  color="primary"
                  onClick={() => this.setState({ showResumePlan: true })}
                >
                  Resume payments
                </SubmitButton>
              )}
            </div>
            {paymentAction}
            <Dialog
              open={!!this.state.showAddPayment}
              onClose={() => this.setState({ showAddPayment: undefined })}
              classes={{
                paper: this.props.classes.addPaymentDialogPaper,
              }}
            >
              <ElementsConsumer>
                {({ elements, stripe }) => (
                  <TourAnchor anchorId="settings-add-payment-popup" placement="top">
                    {(next, isActive, anchorRef) => (
                      <div ref={anchorRef}>
                        <DialogTitle>{setPaymentTitle || 'Add new payment method'}</DialogTitle>
                        <DialogContent className={this.props.classes.center}>
                          <StripeCreditCard
                            onFilledChanged={(isFilled) => this.setState({ stripePaymentFilled: isFilled })} />
                          <Collapse in={!!this.state.stripePaymentError}>
                            <Message message={this.state.stripePaymentError}
                                     severity="error" />
                          </Collapse>
                          <ImgIso
                            img={PoweredByStripe}
                            className={this.props.classes.poweredByStripeImg}
                            width={110}
                          />
                        </DialogContent>
                        <DialogActions>
                          <Button onClick={() => this.setState({ showAddPayment: undefined })}>
                            Cancel
                          </Button>
                          <SubmitButton
                            isSubmitting={this.state.isSubmitting}
                            disabled={!this.state.stripePaymentFilled || !elements || !stripe}
                            color="primary"
                            onClick={async () => {
                              const success = await this.onPaymentSubmit(elements!, stripe!);
                              if (success) {
                                next();
                                tourSetGuideState('add-payment', TourDefinitionGuideState.Completed);
                              }
                            }}
                          >{setPaymentAction || 'Add'}</SubmitButton>
                        </DialogActions>
                      </div>
                    )}
                  </TourAnchor>
                )}
              </ElementsConsumer>
            </Dialog>
            <Dialog
              open={!!this.state.showCancelSubscription}
              onClose={() => this.setState({ showCancelSubscription: undefined })}
            >
              <DialogTitle>Stop subscription</DialogTitle>
              <DialogContent className={this.props.classes.center}>
                <DialogContentText>Stop automatic billing of your subscription. Any ongoing subscription
                  will continue to work until it expires.</DialogContentText>
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
                      .then(() => this.setState({
                        isSubmitting: false,
                        showCancelSubscription: undefined,
                      }))
                      .catch(er => this.setState({ isSubmitting: false }));
                  }}
                >Stop subscription</SubmitButton>
              </DialogActions>
            </Dialog>
            <Dialog
              open={!!this.state.showResumePlan}
              onClose={() => this.setState({ showResumePlan: undefined })}
            >
              <DialogTitle>Resume subscription</DialogTitle>
              <DialogContent className={this.props.classes.center}>
                <DialogContentText>{resumePlanDesc}</DialogContentText>
              </DialogContent>
              <DialogActions>
                <Button onClick={() => this.setState({ showResumePlan: undefined })}>
                  Cancel
                </Button>
                <SubmitButton
                  isSubmitting={this.state.isSubmitting}
                  color="primary"
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
          </div>
        )}
      />
    );

    const nextInvoicesCursor = this.state.invoices === undefined
      ? this.props.accountBilling?.invoices.cursor
      : this.state.invoicesCursor;
    const invoicesItems = [
      ...(this.props.accountBilling?.invoices.results || []),
      ...(this.state.invoices || []),
    ];
    const invoices = invoicesItems.length <= 0 ? undefined : (
      <Section
        title="Invoices"
        content={(
          <>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell key="due">Due</TableCell>
                  <TableCell key="status">Status</TableCell>
                  <TableCell key="amount">Amount</TableCell>
                  <TableCell key="desc">Description</TableCell>
                  <TableCell key="invoiceLink">Invoice</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {invoicesItems.map((invoiceItem, index) => (
                  <TableRow key={index}>
                    <TableCell
                      key="due"><Typography>{new Date(invoiceItem.date).toLocaleDateString()}</Typography></TableCell>
                    <TableCell key="status"
                               align="center"><Typography>{invoiceItem.status}</Typography></TableCell>
                    <TableCell key="amount"
                               align="right"><Typography>{invoiceItem.amount}</Typography></TableCell>
                    <TableCell
                      key="desc"><Typography>{invoiceItem.description}</Typography></TableCell>
                    <TableCell key="invoiceLink">
                      <Button
                        onClick={() => this.onInvoiceClick(invoiceItem.invoiceId)}>View</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
          </>
        )}
      />
    );

    return (
      <ProjectSettingsBase title="Billing">
        {plan}
        {payment}
        {invoices}
      </ProjectSettingsBase>
    );
  }

  onInvoiceClick(invoiceId: string) {
    !windowIso.isSsr && windowIso.open(`${windowIso.location.origin}/invoice/${invoiceId}`, '_blank');
  }

  async onPaymentSubmit(elements: StripeElements, stripe: Stripe): Promise<boolean> {
    trackingBlock(() => {
      [ReactGA4, ReactGA].forEach(ga =>
        ga.event({
          category: 'billing',
          action: this.props.accountBilling?.payment ? 'click-payment-update-submit' : 'click-payment-add-submit',
          label: this.props.accountBilling?.plan.basePlanId,
          value: this.props.accountBilling?.plan.pricing?.basePrice,
        }),
      );
    });

    this.setState({ isSubmitting: true, stripePaymentError: undefined });

    const cardNumberElement = elements.getElement(CardNumberElement);
    if (cardNumberElement === null) {
      this.setState({
        stripePaymentError: 'Payment processor not initialized yet',
        isSubmitting: false,
      });
      return false;
    }

    const tokenResult = await stripe.createToken(cardNumberElement);
    if (!tokenResult.token) {
      this.setState({
        stripePaymentError: tokenResult.error
          ? `${tokenResult.error.message} (${tokenResult.error.code || tokenResult.error.decline_code || tokenResult.error.type})`
          : 'Payment processor failed for unknown reason',
        isSubmitting: false,
      });
      return false;
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
      return false;
    }

    try {
      await dispatcher.accountBillingAdmin({});
    } catch (er) {
      this.setState({
        isSubmitting: false,
        stripePaymentError: 'Failed to add payment',
      });
      return false;
    }

    this.setState({ isSubmitting: false, showAddPayment: undefined });
    return true;
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
      });
      return;
    }

    var result: { paymentIntent?: PaymentIntent, error?: StripeError } | undefined;
    try {
      result = await stripe.confirmCardPayment(
        paymentStripeAction.actionData.paymentIntentClientSecret,
        { return_url: `${windowIso.location.protocol}//${windowIso.location.host}/dashboard/${BillingPaymentActionRedirectPath}` },
        { handleActions: false });
    } catch (e) {
      this.refreshBillingAfterPaymentClose = true;
      this.setState({
        paymentActionMessage: 'Failed to load payment gateway',
        paymentActionMessageSeverity: 'error',
      });
      return;
    }

    if (result.error || !result.paymentIntent) {
      this.refreshBillingAfterPaymentClose = true;
      this.setState({
        paymentActionMessage: result.error?.message || 'Unknown payment failure',
        paymentActionMessageSeverity: 'error',
      });
      return;
    }

    if (result.paymentIntent.status === 'succeeded') {
      this.refreshBillingAfterPaymentClose = true;
      this.setState({
        paymentActionMessage: 'No action necessary',
        paymentActionMessageSeverity: 'success',
      });
      return;
    }

    if (result.paymentIntent.status === 'canceled') {
      this.refreshBillingAfterPaymentClose = true;
      this.setState({
        paymentActionMessage: 'Payment already canceled',
        paymentActionMessageSeverity: 'error',
      });
      return;
    }

    if (result.paymentIntent.status !== 'requires_action'
      || !result.paymentIntent.next_action?.redirect_to_url?.url) {
      this.refreshBillingAfterPaymentClose = true;
      this.setState({
        paymentActionMessage: `Unexpected payment status: ${result.paymentIntent.status}`,
        paymentActionMessageSeverity: 'error',
      });
      return;
    }

    // Setup iframe message listener
    this.paymentActionMessageListener = (ev: MessageEvent) => {
      if (ev.origin !== windowIso.location.origin) return;
      if (typeof ev.data !== 'string' || ev.data !== BillingPaymentActionRedirectPath) return;
      this.refreshBillingAfterPaymentClose = true;
      this.setState({
        paymentActionMessage: 'Action completed',
        paymentActionMessageSeverity: 'info',
      });
    };
    !windowIso.isSsr && windowIso.addEventListener('message', this.paymentActionMessageListener);

    this.setState({ paymentActionUrl: result.paymentIntent.next_action.redirect_to_url.url });
  }
}

export const BillingPaymentActionRedirect = () => {
  !windowIso.isSsr && windowIso.top?.postMessage(BillingPaymentActionRedirectPath, windowIso.location.origin);
  return (
    <Message message="Please wait..." severity="info" />
  );
};

export default connect<ConnectProps, {}, {}, ReduxStateAdmin>((state, ownProps) => {
  const newProps: ConnectProps = {
    accountStatus: state.account.account.status,
    account: state.account.account.account,
    accountBillingStatus: state.account.billing.status,
    accountBilling: state.account.billing.billing,
    isSuperAdmin: state.account.isSuperAdmin,
  };
  if (state.account.billing.status === undefined) {
    newProps.callOnMount = () => {
      ServerAdmin.get().dispatchAdmin().then(d => d.accountBillingAdmin({}));
    };
  }
  return newProps;
}, null, null, { forwardRef: true })(withStyles(styles, { withTheme: true })(withRouter(withWidth({ initialWidth })(BillingPage))));
