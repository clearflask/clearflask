// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import { Button, Collapse, Container, IconButton, InputAdornment, Paper, TextField, Typography } from '@material-ui/core';
import { createStyles, fade, makeStyles, Theme, useTheme, WithStyles } from '@material-ui/core/styles';
import BathtubIcon from '@material-ui/icons/Bathtub';
import EmailIcon from '@material-ui/icons/Email';
import GithubIcon from '@material-ui/icons/GitHub';
import VisibilityIcon from '@material-ui/icons/Visibility';
import VisibilityOffIcon from '@material-ui/icons/VisibilityOff';
import { Alert, AlertTitle } from '@material-ui/lab';
import { withStyles } from '@material-ui/styles';
import classNames from 'classnames';
import React, { Component } from 'react';
import ReactGA from 'react-ga';
import { withTranslation, WithTranslation } from 'react-i18next';
import LinkedInTag from 'react-linkedin-insight';
import { connect } from 'react-redux';
import { RouteComponentProps, StaticContext, withRouter } from 'react-router';
import { Link, NavLink } from 'react-router-dom';
import * as Admin from '../api/admin';
import { Status } from '../api/server';
import ServerAdmin, { ReduxStateAdmin } from '../api/serverAdmin';
import { SSO_TOKEN_PARAM_NAME } from '../app/App';
import ErrorPage from '../app/ErrorPage';
import LoadingPage from '../app/LoadingPage';
import Loading from '../app/utils/Loading';
import AcceptTerms from '../common/AcceptTerms';
import Hr from '../common/Hr';
import GoogleIcon from '../common/icon/GoogleIcon';
import Message from '../common/Message';
import SubmitButton from '../common/SubmitButton';
import { saltHashPassword } from '../common/util/auth';
import { detectEnv, Environment, isProd } from '../common/util/detectEnv';
import { OAuthFlow } from '../common/util/oauthUtil';
import { RedirectIso } from '../common/util/routerUtil';
import { trackingBlock } from '../common/util/trackingDelay';
import windowIso from '../common/windowIso';
import AnimBubble from './landing/AnimBubble';
import PricingPlan from './PricingPlan';

/** Toggle whether production has signups enabled. Test environments are unaffected. */
export const SIGNUP_PROD_ENABLED = true;

export const PRE_SELECTED_BASE_PLAN_ID = 'preSelectedPlanId';
export const ADMIN_LOGIN_REDIRECT_TO = 'ADMIN_LOGIN_REDIRECT_TO';
export const ADMIN_ENTER_INVITATION_ID = 'ADMIN_ENTER_INVITATION_ID';
export const ADMIN_ENTER_COUPON_ID = 'ADMIN_ENTER_COUPON_ID';
interface LocationState {
  [ADMIN_LOGIN_REDIRECT_TO]?: string;
  [PRE_SELECTED_BASE_PLAN_ID]?: string;
  [ADMIN_ENTER_INVITATION_ID]?: string;
  [ADMIN_ENTER_COUPON_ID]?: string;
}

export const urlAddCfJwt = (url: string, account?: Admin.AccountAdmin): string => {
  return !!account
    ? `${url}?${SSO_TOKEN_PARAM_NAME}=${account.cfJwt}`
    : url;
}

interface OauthExtraData {
  selectedPlanId?: string;
  invitationId?: string;
  couponId?: string;
  redirectTo?: string;
}

const styles = (theme: Theme) => createStyles({
  link: {
    color: 'unset',
    borderBottom: '1px dashed',
    textDecoration: 'none',
    '&:hover': {
      borderBottomStyle: 'solid',
    },
  },
  reviewRowError: {
    color: theme.palette.error.main,
  },
  page: {
    padding: theme.spacing(2),
    minHeight: 800,
    height: '100vh',
    overflow: 'hidden',
  },
  titleClearFlask: {
    color: theme.palette.primary.main,
  },
  paperContainerContainer: {
    width: '100%',
    margin: theme.spacing(1),
    position: 'relative',
  },
  paperContainer: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    width: 'max-content',
    position: 'absolute',
    transition: theme.transitions.create(['left', 'transform']),
    left: 0,
    transform: 'translate(0, -50%)',
  },
  paperContainerCenter: {
    left: '50%',
    transform: 'translate(-50%, -50%)',
  },
  paperContainerRight: {
    left: '100%',
    transform: 'translate(-100%, -50%)',
  },
  paper: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    textAlign: 'center',
    zIndex: 5,
    position: 'relative',
    boxShadow: '-10px -10px 40px 0 rgba(0,0,0,0.1)',
    padding: theme.spacing(8),
    maxWidth: 260,
    boxSizing: 'content-box',
    marginLeft: 'auto',
    [theme.breakpoints.only('xs')]: {
      padding: theme.spacing(4),
    },
  },
  submitButton: {
    margin: theme.spacing(2, 0),
    display: 'block',
  },
  welcomeBack: {
    fontWeight: 'bold',
    marginBottom: theme.spacing(2),
  },
  signUpHere: {
    textDecoration: 'none',
  },
  oauthEnter: {
    margin: theme.spacing(1, 0),
    display: 'flex',
    alignItems: 'center',
    textTransform: 'none',
  },
  alert: {
    margin: theme.spacing(1, 0),
  },
  enterTemplate: {
    height: '100%',
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  expired: {
    color: theme.palette.error.dark,
  },
  inviteeName: {
    fontWeight: 'bold',
  },
  bold: {
    fontWeight: 'bold',
  },
});
const useStyles = makeStyles(styles);
interface Props {
  type: 'login' | 'signup' | 'invitation' | 'coupon';
  invitationId?: string;
  couponId?: string;
}
interface ConnectProps {
  accountStatus?: Status;
  account?: Admin.AccountAdmin;
  plansStatus?: Status;
  plans?: Admin.Plan[];
  cfJwt?: string;
  invitationStatus?: Status;
  invitation?: Admin.InvitationResult;
}
interface State {
  redirectTo?: string; // Used when redirecting back from OAuth provider
  accountWasCreated?: boolean; // Used for determining redirection page
  invitationType?: 'login' | 'signup';
  couponId?: string;
  couponPlan?: Admin.Plan;
  couponRedeemedByYou?: boolean;
  couponError?: string;
  isSubmitting?: boolean;
  useEmail?: boolean; // login & signup
  email?: string; // login & signup
  pass?: string; // login & signup
  name?: string; // signup only
  emailIsFreeOrDisposable?: boolean; // signup only
  revealPassword?: boolean; // login & signup
}
class AccountEnterPage extends Component<Props & WithTranslation<'site'> & RouteComponentProps<{}, StaticContext, LocationState | undefined> & ConnectProps & WithStyles<typeof styles, true>, State> {
  readonly cfReturnUrl?: string;
  readonly oauthFlow = new OAuthFlow({ accountType: 'admin', redirectPath: '/login' });

  constructor(props) {
    super(props);

    this.state = {
      couponId: this.props.couponId,
    };

    try {
      const paramCfr = new URL(windowIso.location.href).searchParams.get('cfr');
      if (paramCfr && new URL(paramCfr).host.endsWith(windowIso.location.host)) {
        this.cfReturnUrl = paramCfr;
      }
    } catch (er) { }
  }

  async componentDidMount() {
    const oauthToken = this.oauthFlow.checkResult();
    if (!!oauthToken) {
      this.setState({ isSubmitting: true });
      var basePlanId: string | undefined;
      var couponId: string | undefined;
      var invitationId: string | undefined;
      var redirectTo: string | undefined;
      if (oauthToken?.extraData) {
        try {
          const oauthExtraData = JSON.parse(oauthToken?.extraData) as OauthExtraData;
          couponId = oauthExtraData?.couponId;
          invitationId = oauthExtraData?.invitationId;
          basePlanId = oauthExtraData?.selectedPlanId;
          redirectTo = oauthExtraData?.redirectTo;
        } catch (e) { }
      }
      try {
        const result = await (await ServerAdmin.get().dispatchAdmin()).accountBindAdmin({
          accountBindAdmin: {
            oauthToken: !oauthToken ? undefined : {
              id: oauthToken.id,
              code: oauthToken.code,
              basePlanId,
              invitationId,
              couponId,
            },
          },
        });
        if (result.account) {
          this.setState({
            accountWasCreated: !!result.created,
            redirectTo,
            isSubmitting: false,
          });
        } else {
          this.setState({ isSubmitting: false });
        }
      } catch (e) {
        this.setState({ isSubmitting: false });
        throw e;
      }
    } else if (this.props.type === 'coupon' || this.props.type === 'invitation') {
      if (this.props.accountStatus === undefined && !this.props.account) {
        ServerAdmin.get().dispatchAdmin().then(d => d.accountBindAdmin({ accountBindAdmin: {} }));
      }
    }

    if (!!this.props.couponId) {
      this.onCouponCheck(this.props.couponId);
    }
  }

  render() {
    if (this.props.plansStatus === undefined) {
      ServerAdmin.get().dispatchAdmin({ debounce: true, ssr: true }).then(d => d
        .plansGet());
    }
    const isLoggedIn = this.props.accountStatus === Status.FULFILLED && !!this.props.account;
    if (this.props.type === 'invitation') {
      return this.renderInvitation(isLoggedIn);
    }
    if (this.props.type === 'coupon') {
      return this.renderCoupon(isLoggedIn);
    }

    if (this.props.accountStatus === Status.FULFILLED && !!this.props.account
      // Only redirect once submission is over (and redirectTo and accountWasCreated is set appropriately)
      && !this.state.isSubmitting) {
      if (this.props.cfJwt && this.cfReturnUrl) {
        windowIso.location.href = `${this.cfReturnUrl}?${SSO_TOKEN_PARAM_NAME}=${this.props.cfJwt}`;
        return (<ErrorPage msg={this.props.t('redirecting-you-back')} variant='success' />);
      }
      return (<RedirectIso to={this.state.redirectTo
        || this.props.location.state?.[ADMIN_LOGIN_REDIRECT_TO]
        || (this.state.accountWasCreated
          ? '/dashboard/welcome' :
          '/dashboard')} />);
    }

    const selectedPlanId = this.props.location.state?.[PRE_SELECTED_BASE_PLAN_ID]
      || (this.props.plans ? this.props.plans[0].basePlanId : undefined);

    if (this.props.type === 'signup') {
      if (!selectedPlanId && !this.props.plans) {
        return <LoadingPage />
      }
      if (!selectedPlanId || !SIGNUP_PROD_ENABLED && isProd() && new URL(windowIso.location.href).searchParams.get('please') !== undefined) {
        return <ErrorPage variant='warning' msg={(
          <div style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', }} >
            Direct sign ups are currently disabled. Instead,&nbsp;
            <NavLink to='/contact/demo' className={this.props.classes.link}>schedule a demo</NavLink>
            &nbsp;with us.
          </div>
        )} />
      }
    }

    const isSingleCustomer = detectEnv() === Environment.PRODUCTION_SELF_HOST;
    const isOauthEnabled = !isSingleCustomer;
    const signUpOrLogIn = this.props.type === 'signup' ? this.props.t('sign-up-with') : this.props.t('log-in-with');

    return (
      <EnterTemplate
        title={(
          <>
            {(this.props.type === 'signup' ? this.props.t('get-started-with') : this.props.t('welcome-back-to')) + ' '}
            <span className={this.props.classes.titleClearFlask}>ClearFlask</span>
          </>
        )}
        renderContent={submitButton => (
          <>
            {this.state.couponPlan && (
              <Alert className={this.props.classes.alert} severity='info'>
                Redeeming <span className={this.props.classes.bold}>{this.state.couponPlan.title}</span> plan.
              </Alert>
            )}
            {this.props.invitation?.projectName && (
              <Alert className={this.props.classes.alert} severity='info'>
                Invitation to <span className={this.props.classes.bold}>{this.props.invitation?.projectName}</span>.
              </Alert>
            )}
            {isOauthEnabled && (
              <>
                <Button
                  className={this.props.classes.oauthEnter}
                  variant='outlined'
                  fullWidth
                  size='large'
                  onClick={e => !!selectedPlanId && this.onOauth('google', selectedPlanId)}
                  disabled={this.state.isSubmitting}
                >
                  <GoogleIcon />
                  &nbsp;&nbsp;{signUpOrLogIn}&nbsp;Google
                </Button>
                <Button
                  className={this.props.classes.oauthEnter}
                  variant='outlined'
                  fullWidth
                  size='large'
                  onClick={e => !!selectedPlanId && this.onOauth('github', selectedPlanId)}
                  disabled={this.state.isSubmitting}
                >
                  <GithubIcon />
                  &nbsp;&nbsp;{signUpOrLogIn}&nbsp;GitHub
                </Button>
                {!isProd() && (
                  <Button
                    className={this.props.classes.oauthEnter}
                    variant='outlined'
                    fullWidth
                    size='large'
                    onClick={e => !!selectedPlanId && this.onOauth('bathtub', selectedPlanId)}
                    disabled={this.state.isSubmitting}
                  >
                    <BathtubIcon />
                    &nbsp;&nbsp;{signUpOrLogIn}&nbsp;Bathtub
                  </Button>
                )}
              </>
            )}
            <Collapse in={!this.state.useEmail}>
              <Button
                className={this.props.classes.oauthEnter}
                variant='outlined'
                fullWidth
                size='large'
                onClick={e => this.setState({ useEmail: true })}
                disabled={this.state.isSubmitting}
              >
                <EmailIcon />
                &nbsp;&nbsp;{signUpOrLogIn}&nbsp;{this.props.t('email')}
              </Button>
            </Collapse>
            <Collapse in={this.state.useEmail}>
              <div>
                {isOauthEnabled && (
                  <Hr isInsidePaper length={120} margins={15}>{this.props.t('or')}</Hr>
                )}
                <Collapse in={this.props.type === 'signup'}>
                  <TextField
                    variant='outlined'
                    fullWidth
                    margin='normal'
                    placeholder={this.props.t('your-name-organization')}
                    required
                    value={this.state.name || ''}
                    onChange={e => this.setState({ name: e.target.value })}
                    disabled={this.state.isSubmitting}
                  />
                </Collapse>
                <TextField
                  variant='outlined'
                  fullWidth
                  required
                  value={this.state.email || ''}
                  onChange={e => {
                    const newEmail = e.target.value;
                    this.setState({ email: newEmail });
                    if (this.props.type === 'signup') {
                      import(/* webpackChunkName: "emailDisposableList" */'../common/util/emailDisposableList')
                        .then(eu => this.setState({
                          emailIsFreeOrDisposable: eu.isDisposable(newEmail),
                        }));
                    }
                  }}
                  placeholder={this.props.type === 'login' ? this.props.t('email') : this.props.t('business-email')}
                  type='email'
                  margin='normal'
                  disabled={this.state.isSubmitting}
                />
                <Collapse in={this.props.type === 'signup' && !!this.state.emailIsFreeOrDisposable}>
                  <Message severity='warning' message={(
                    <div style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', }} >
                      {this.props.t('cannot-use-a-disposable-email')} Is this a mistake?&nbsp;
                      <NavLink to='/contact/demo' className={this.props.classes.link}>Schedule a demo</NavLink>
                      &nbsp;with us.
                    </div>
                  )} />
                </Collapse>
                <TextField
                  variant='outlined'
                  fullWidth
                  required
                  value={this.state.pass || ''}
                  onChange={e => this.setState({ pass: e.target.value })}
                  placeholder={this.props.t('password')}
                  type={this.state.revealPassword ? 'text' : 'password'}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position='end'>
                        <IconButton
                          aria-label='Toggle password visibility'
                          onClick={() => this.setState({ revealPassword: !this.state.revealPassword })}
                        >
                          {this.state.revealPassword ? <VisibilityIcon fontSize='small' /> : <VisibilityOffIcon fontSize='small' />}
                        </IconButton>
                      </InputAdornment>
                    )
                  }}
                  margin='normal'
                  disabled={this.state.isSubmitting}
                />
                {this.props.type === 'signup' && (
                  <AcceptTerms />
                )}
                {submitButton}
              </div>
            </Collapse>
          </>
        )}
        submitTitle={this.props.type === 'signup' ? this.props.t('create-account') : this.props.t('continue')}
        submitDisabled={
          !this.state.email || !this.state.pass
          || this.props.type === 'signup' && (
            !this.state.name
            || !!this.state.emailIsFreeOrDisposable)}
        isSubmitting={this.state.isSubmitting}
        onSubmit={this.props.type === 'signup' ? this.signUp.bind(this, selectedPlanId!) : this.onLogin.bind(this)}
        footer={this.props.type === 'signup' ? {
          text: this.props.t('have-an-account'),
          actionText: this.props.t('log-in-here'),
          linkTo: {
            pathname: '/login',
            state: this.props.location.state,
          },
        } : {
          text: this.props.t('no-account'),
          actionText: this.props.t('sign-up-here'),
          linkTo: {
            pathname: '/signup',
            state: this.props.location.state,
          },
        }}
        layout={this.props.type}
      />
    );
  }

  renderInvitation(isLoggedIn: boolean) {
    // Only load invitation if we are on /invitation/...
    // We want to make sure a user is not tricked into accepting an invitation
    if (this.props.invitationId && this.props.invitationStatus === undefined) {
      const invitationId = this.props.invitationId;
      ServerAdmin.get().dispatchAdmin({ debounce: true, ssr: true, ssrStatusPassthrough: true }).then(dispatcher => dispatcher
        .accountViewInvitationAdmin({ invitationId }));
    }

    const expired = !this.props.invitationId || this.props.invitationStatus === Status.REJECTED || (this.props.invitationStatus === Status.FULFILLED && !this.props.invitation);
    const accepted = this.props.invitation?.isAcceptedByYou;
    return (
      <EnterTemplate
        title={!!this.props.invitation ? (accepted ? (
          this.props.t('invitation-accepted')
        ) : (
          <>
            {this.props.t('invitation-from')}
            <span className={this.props.classes.titleClearFlask}>{this.props.invitation?.inviteeName}</span>
          </>
        )) : (expired ? (
          <span className={this.props.classes.expired}>Invitation expired</span>
        ) : this.props.t('invitation-loading'))}
        renderContent={submitButton => (
          <>
            {!!this.props.invitation ? (
              <div>
                {!!accepted && (
                  <p>You have successfully joined <span className={this.props.classes.bold}>{this.props.invitation?.inviteeName || 'friend'}</span>'s project&nbsp;<span className={this.props.classes.bold}>{this.props.invitation.projectName}</span> on&nbsp;{windowIso.parentDomain}.</p>
                )}
                {!accepted && (
                  <p>You have been invited to join the project&nbsp;<span className={this.props.classes.bold}>{this.props.invitation.projectName}</span> on&nbsp;{windowIso.parentDomain}.</p>
                )}
                {!isLoggedIn && (
                  <p>Please sign up or log in to accept this invitation.</p>
                )}
              </div>
            ) : (expired ? (
              'Please let your friend know to send you another invitation by email.'
            ) : (
              <Loading />
            ))}
            {submitButton}
          </>
        )}
        submitTitle={expired ? undefined : (!isLoggedIn ? this.props.t('sign-up') : (!accepted ? this.props.t('accept') : this.props.t('open')))}
        submitDisabled={!this.props.invitation}
        isSubmitting={this.state.isSubmitting}
        onSubmit={async () => {
          if (!isLoggedIn) {
            this.props.history.push('/signup/', {
              [ADMIN_ENTER_INVITATION_ID]: this.props.invitationId,
              [ADMIN_LOGIN_REDIRECT_TO]: `/invitation/${this.props.invitationId}`,
            })
          } else if (!!this.props.invitationId && !!this.props.invitation?.isAcceptedByYou) {
            this.props.history.push('/dashboard');
          } else if (!!this.props.invitationId) {
            this.setState({ isSubmitting: true });
            try {
              const acceptedInvitation = await (await ServerAdmin.get().dispatchAdmin()).accountAcceptInvitationAdmin({
                invitationId: this.props.invitationId,
              });
              // Refresh projects
              await (await ServerAdmin.get().dispatchAdmin()).configGetAllAndUserBindAllAdmin();
              this.props.history.push(`/dashboard?projectId=${acceptedInvitation.projectId}`)
            } finally {
              this.setState({ isSubmitting: false });
            }
          }
        }}
        footer={!isLoggedIn && !expired ? {
          text: this.props.t('have-an-account'),
          actionText: this.props.t('log-in-here'),
          linkTo: {
            pathname: '/login',
            state: {
              [ADMIN_ENTER_INVITATION_ID]: this.props.invitationId,
              [ADMIN_LOGIN_REDIRECT_TO]: `/invitation/${this.props.invitationId}`,
            },
          },
        } : undefined}
        layout={this.props.type}
      />
    );
  }

  renderCoupon(isLoggedIn: boolean) {
    const couponId = this.state.couponId !== undefined ? this.state.couponId : this.props.couponId || '';
    return (
      <EnterTemplate
        title={this.props.t('redeem-coupon')}
        renderContent={submitButton => (
          <>
            <TextField
              variant='outlined'
              fullWidth
              margin='normal'
              label={this.props.t('coupon-code')}
              placeholder='XXXXXXXX'
              value={couponId}
              onChange={e => this.setState({ couponId: e.target.value })}
              disabled={this.state.isSubmitting || !!this.state.couponPlan || !!this.state.couponRedeemedByYou}
            />
            <Collapse in={!!this.state.couponRedeemedByYou}>
              <Alert className={this.props.classes.alert} severity='success'>
                <AlertTitle>Success!</AlertTitle>
                This coupon has already been applied to your account.
              </Alert>
            </Collapse>
            <Collapse in={!!this.state.couponPlan && !this.state.couponRedeemedByYou}>
              {!!this.state.couponPlan && (
                <PricingPlan plan={this.state.couponPlan} />
              )}
            </Collapse>
            <Collapse in={!this.state.couponRedeemedByYou && !!this.state.couponPlan}>
              <Alert className={this.props.classes.alert} severity='info'>
                {!isLoggedIn ? 'This plan will be applied upon sign-up or login' : 'This plan will replace your current plan on your account.'}
              </Alert>
            </Collapse>
            {submitButton}
            <Collapse in={!!this.state.couponError}>
              <Alert className={this.props.classes.alert} severity='warning'>
                {this.state.couponError}
              </Alert>
            </Collapse>
          </>
        )}
        submitTitle={!!this.state.couponRedeemedByYou
          ? this.props.t('continue')
          : (!this.state.couponPlan
            ? this.props.t('check')
            : (!isLoggedIn
              ? this.props.t('continue')
              : this.props.t('redeem')))}
        submitDisabled={!couponId}
        isSubmitting={this.state.isSubmitting}
        onSubmit={async () => {
          if (!couponId) return;
          if (!!this.state.couponRedeemedByYou) {
            // Already redeemed by you
            this.props.history.push('/dashboard');
          } else if (!this.state.couponPlan) {
            // Need to check couponn
            await this.onCouponCheck(couponId);
          } else if (!isLoggedIn) {
            // Redirect to signup for a valid code
            this.props.history.push('/signup/', {
              [ADMIN_ENTER_COUPON_ID]: couponId,
              [ADMIN_LOGIN_REDIRECT_TO]: `/coupon/${couponId}`,
            })
          } else {
            // Accept code on own account
            this.setState({ isSubmitting: true });
            try {
              await (await ServerAdmin.get().dispatchAdmin()).accountAcceptCouponAdmin({
                couponId,
              });
              this.setState({
                couponRedeemedByYou: true,
                couponError: undefined,
              });
            } finally {
              this.setState({ isSubmitting: false });
            }
          }
        }}
        footer={(!this.state.couponRedeemedByYou && !!this.state.couponPlan && !isLoggedIn) ? {
          text: this.props.t('have-an-account'),
          actionText: this.props.t('log-in-here'),
          linkTo: {
            pathname: '/login',
            state: {
              [ADMIN_ENTER_COUPON_ID]: couponId,
              [ADMIN_LOGIN_REDIRECT_TO]: `/coupon/${couponId}`,
            },
          },
        } : undefined}
        layout={this.props.type}
      />
    );
  }

  async onCouponCheck(couponId: string) {
    this.setState({ isSubmitting: true });
    try {
      const result = await (await ServerAdmin.get().dispatchAdmin()).accountViewCouponAdmin({
        couponId,
      });
      this.setState({
        couponPlan: result.plan,
        couponRedeemedByYou: !!result.redeemedByYou,
        couponError: (!result.plan && !result.redeemedByYou) ? 'Coupon expired or invalid.' : undefined
      });
    } finally {
      this.setState({ isSubmitting: false });
    }
  }

  onOauth(type: 'google' | 'github' | 'bathtub', selectedPlanId: string) {
    const extraData: OauthExtraData = {
      selectedPlanId,
      invitationId: this.props.location.state?.[ADMIN_ENTER_INVITATION_ID],
      couponId: this.props.location.state?.[ADMIN_ENTER_COUPON_ID],
      redirectTo: this.props.location.state?.[ADMIN_LOGIN_REDIRECT_TO],
    };
    this.oauthFlow.openForAccount(type, 'self', JSON.stringify(extraData));
  }

  onLogin() {
    this.setState({ isSubmitting: true });
    ServerAdmin.get().dispatchAdmin().then(d => d.accountLoginAdmin({
      accountLogin: {
        email: this.state.email || '',
        password: saltHashPassword(this.state.pass || ''),
      }
    })).then((result) => {
      this.setState({
        accountWasCreated: false,
        isSubmitting: false,
      });
    }).catch((e) => {
      if (e && e.status && e.status === 403) {
        this.setState({ isSubmitting: false });
      } else {
        this.setState({ isSubmitting: false });
      }
    });
  }

  async signUp(selectedPlanId: string) {
    trackingBlock(() => {
      ReactGA.event({
        category: 'account-signup',
        action: 'click-create',
        label: selectedPlanId,
      });
      LinkedInTag.track('5353172');
    });

    this.setState({ isSubmitting: true });
    const dispatchAdmin = await ServerAdmin.get().dispatchAdmin();
    try {
      const couponId = this.props.location.state?.[ADMIN_ENTER_COUPON_ID];
      await dispatchAdmin.accountSignupAdmin({
        accountSignupAdmin: {
          name: this.state.name!,
          email: this.state.email!,
          password: saltHashPassword(this.state.pass!),
          basePlanId: selectedPlanId,
          invitationId: this.props.location.state?.[ADMIN_ENTER_INVITATION_ID],
          couponId,
        }
      });
      this.setState({
        isSubmitting: false,
        accountWasCreated: true,
        ...(!!couponId ? {
          couponId,
          couponRedeemedByYou: true,
        } : {}),
      });
    } catch (e) {
      this.setState({ isSubmitting: false });
      throw e;
    }
  }
}

const EnterTemplate = (props: {
  title: React.ReactNode;
  renderContent: (submitButton: React.ReactNode) => React.ReactNode;
  submitTitle?: React.ReactNode;
  submitDisabled?: boolean;
  isSubmitting?: boolean;
  onSubmit: () => void;
  footer?: {
    text: string;
    actionText: string;
    linkTo: React.ComponentProps<typeof Link>['to'];
  };
  layout?: Props['type'];
}) => {
  const classes = useStyles();
  const theme = useTheme();
  const bubbleColor = fade(theme.palette.primary.main, 0.15);
  return (
    <div className={classes.page}>
      <Container maxWidth='md' className={classes.enterTemplate}>
        <AnimBubble color={bubbleColor} delay='0ms' duration='400ms' size={props.layout === 'signup' ? 350 : (props.layout === 'login' ? 100 : 400)} x={props.layout === 'signup' ? 420 : (props.layout === 'login' ? 50 : 100)} y={props.layout === 'signup' ? 70 : (props.layout === 'login' ? 210 : 0)} />
        <AnimBubble color={bubbleColor} delay='20ms' duration='200ms' size={props.layout === 'signup' ? 100 : (props.layout === 'login' ? 300 : 200)} x={props.layout === 'signup' ? 800 : (props.layout === 'login' ? 400 : 650)} y={props.layout === 'signup' ? 130 : (props.layout === 'login' ? 50 : 250)} />
        <AnimBubble color={bubbleColor} delay='40ms' duration='300ms' size={props.layout === 'signup' ? 150 : (props.layout === 'login' ? 500 : 100)} x={props.layout === 'signup' ? 520 : (props.layout === 'login' ? -200 : 100)} y={props.layout === 'signup' ? 470 : (props.layout === 'login' ? 700 : 500)} />
        <AnimBubble color={bubbleColor} delay='100ms' duration='500ms' size={props.layout === 'signup' ? 300 : (props.layout === 'login' ? 150 : 700)} x={props.layout === 'signup' ? 900 : (props.layout === 'login' ? 350 : 800)} y={props.layout === 'signup' ? 700 : (props.layout === 'login' ? 500 : 950)} />
        <AnimBubble color={bubbleColor} delay='100ms' duration='500ms' size={props.layout === 'signup' ? 500 : (props.layout === 'login' ? 300 : 400)} x={props.layout === 'signup' ? 1300 : (props.layout === 'login' ? 900 : 1100)} y={props.layout === 'signup' ? 450 : (props.layout === 'login' ? 700 : 150)} />
        <div className={classes.paperContainerContainer}>
          <div className={classNames(
            classes.paperContainer,
            props.layout === 'login' && classes.paperContainerRight,
            (props.layout === 'invitation' || props.layout === 'coupon') && classes.paperContainerCenter,
          )}>
            {/* <CollapseV5 in={props.layout === 'login'} orientation='horizontal'>
              <Paper className={classes.paper}>
                sdfsdfasdffasd
              </Paper>
            </CollapseV5> */}
            <Paper className={classes.paper}>
              <Typography component='h1' variant='h4' color='textPrimary' className={classes.welcomeBack}>
                {props.title}
              </Typography>
              {props.renderContent(!props.submitTitle ? null : (
                <SubmitButton
                  className={classes.submitButton}
                  color='primary'
                  fullWidth
                  size='large'
                  variant='contained'
                  disableElevation
                  isSubmitting={props.isSubmitting}
                  disabled={props.submitDisabled}
                  onClick={props.onSubmit}
                >{props.submitTitle}</SubmitButton>
              ))}
              {props.footer && (
                <div>
                  <Typography component='span' variant='caption' color='textPrimary'>
                    {props.footer.text}&nbsp;
                  </Typography>
                  <Link to={props.footer.linkTo} className={classes.signUpHere}>
                    <Typography component='span' variant='caption' color='primary'>
                      {props.footer.actionText}
                    </Typography>
                  </Link>
                </div>
              )}
            </Paper>
            {/* <CollapseV5 in={props.layout === 'signup'} orientation='horizontal'>
              <Paper className={classes.paper}>
                sdfsdfasdffasd
              </Paper>
            </CollapseV5> */}
          </div>
        </div>
      </Container>
    </div>
  );
}


export default connect<ConnectProps, {}, Props, ReduxStateAdmin>((state, ownProps) => {
  const connectProps: ConnectProps = {
    accountStatus: state.account.account.status,
    account: state.account.account.account,
    plansStatus: state.plans.plans.status,
    plans: state.plans.plans.plans,
    cfJwt: state.account.account.account?.cfJwt,
    invitationStatus: ownProps.invitationId ? state.invitations.byId[ownProps.invitationId]?.status : undefined,
    invitation: ownProps.invitationId ? state.invitations.byId[ownProps.invitationId]?.invitation : undefined,
  };
  return connectProps;
}, null, null, { forwardRef: true })(withStyles(styles, { withTheme: true })(withRouter(withTranslation('site', { withRef: true })(AccountEnterPage))));
