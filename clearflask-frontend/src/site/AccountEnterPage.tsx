// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
import { Button, Collapse, Container, IconButton, InputAdornment, Paper, TextField, Typography } from '@material-ui/core';
import { createStyles, makeStyles, Theme, WithStyles } from '@material-ui/core/styles';
import BathtubIcon from '@material-ui/icons/Bathtub';
import EmailIcon from '@material-ui/icons/Email';
import GithubIcon from '@material-ui/icons/GitHub';
import VisibilityIcon from '@material-ui/icons/Visibility';
import VisibilityOffIcon from '@material-ui/icons/VisibilityOff';
import { withStyles } from '@material-ui/styles';
import classNames from 'classnames';
import React, { Component } from 'react';
import ReactGA from 'react-ga';
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
import { detectEnv, Environment, isProd, isTracking } from '../common/util/detectEnv';
import { OAuthFlow } from '../common/util/oauthUtil';
import { RedirectIso } from '../common/util/routerUtil';
import windowIso from '../common/windowIso';
import AnimBubble from './landing/AnimBubble';

/** Toggle whether production has signups enabled. Test environments are unaffected. */
export const SIGNUP_PROD_ENABLED = true;

export const PRE_SELECTED_BASE_PLAN_ID = 'preSelectedPlanId';
export const ADMIN_LOGIN_REDIRECT_TO = 'ADMIN_LOGIN_REDIRECT_TO';
export const ADMIN_ENTER_INVITATION_ID = 'ADMIN_ENTER_INVITATION_ID';
interface LocationState {
  [ADMIN_LOGIN_REDIRECT_TO]?: string;
  [PRE_SELECTED_BASE_PLAN_ID]?: string;
  [ADMIN_ENTER_INVITATION_ID]?: string;
}

export const urlAddCfJwt = (url: string, account?: Admin.AccountAdmin): string => {
  return !!account
    ? `${url}?${SSO_TOKEN_PARAM_NAME}=${account.cfJwt}`
    : url;
}

interface OauthExtraData {
  selectedPlanId?: string;
  invitationId?: string;
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
  type: 'login' | 'signup' | 'invitation';
  invitationId?: string;
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
  isSubmitting?: boolean;
  useEmail?: boolean; // login & signup
  email?: string; // login & signup
  pass?: string; // login & signup
  name?: string; // signup only
  emailIsFreeOrDisposable?: boolean; // signup only
  revealPassword?: boolean; // login & signup
}
class AccountEnterPage extends Component<Props & RouteComponentProps<{}, StaticContext, LocationState | undefined> & ConnectProps & WithStyles<typeof styles, true>, State> {
  state: State = {};
  readonly cfReturnUrl?: string;
  readonly oauthFlow = new OAuthFlow({ accountType: 'admin', redirectPath: '/login' });

  constructor(props) {
    super(props);

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
      var invitationId: string | undefined;
      var redirectTo: string | undefined;
      if (oauthToken?.extraData) {
        try {
          const oauthExtraData = JSON.parse(oauthToken?.extraData) as OauthExtraData;
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
    }
  }

  render() {
    if (this.props.plansStatus === undefined) {
      ServerAdmin.get().dispatchAdmin({ debounce: true, ssr: true }).then(d => d
        .plansGet());
    }
    if (this.props.type === 'invitation') {
      return this.renderInvitation();
    }

    if (this.props.accountStatus === Status.FULFILLED && !!this.props.account
      // Only redirect once submission is over (and redirectTo and accountWasCreated is set appropriately)
      && !this.state.isSubmitting) {
      if (this.props.cfJwt && this.cfReturnUrl) {
        windowIso.location.href = `${this.cfReturnUrl}?${SSO_TOKEN_PARAM_NAME}=${this.props.cfJwt}`;
        return (<ErrorPage msg='Redirecting you back...' variant='success' />);
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

    const isSingleCustomer = detectEnv() == Environment.PRODUCTION_SELF_HOST;
    const isOauthEnabled = !isSingleCustomer;
    const signUpOrLogIn = this.props.type === 'signup' ? 'Sign up with' : 'Log in with';

    return (
      <EnterTemplate
        title={(
          <>
            {this.props.type === 'signup' ? 'Get started with ' : 'Welcome back to '}
            <span className={this.props.classes.titleClearFlask}>ClearFlask</span>
          </>
        )}
        renderContent={submitButton => (
          <>
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
                &nbsp;&nbsp;{signUpOrLogIn}&nbsp;Email
              </Button>
            </Collapse>
            <Collapse in={this.state.useEmail}>
              <div>
                {isOauthEnabled && (
                  <Hr isInsidePaper length={120} margins={15}>OR</Hr>
                )}
                <Collapse in={this.props.type === 'signup'}>
                  <TextField
                    variant='outlined'
                    fullWidth
                    margin='normal'
                    placeholder='Your name / organization'
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
                  placeholder={this.props.type === 'login' ? 'Email' : 'Business email'}
                  type='email'
                  margin='normal'
                  disabled={this.state.isSubmitting}
                />
                <Collapse in={this.props.type === 'signup' && !!this.state.emailIsFreeOrDisposable}>
                  <Message severity='warning' message={(
                    <div style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', }} >
                      Cannot use a disposable email. Is this a mistake?&nbsp;
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
                  placeholder='Password'
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
        submitTitle={this.props.type === 'signup' ? 'Create account' : 'Continue'}
        submitDisabled={
          !this.state.email || !this.state.pass
          || this.props.type === 'signup' && (
            !this.state.name
            || !!this.state.emailIsFreeOrDisposable)}
        isSubmitting={this.state.isSubmitting}
        onSubmit={this.props.type === 'signup' ? this.signUp.bind(this, selectedPlanId!) : this.onLogin.bind(this)}
        footer={this.props.type === 'signup' ? {
          text: 'Have an account?',
          actionText: 'Log in Here!',
          linkTo: {
            pathname: '/login',
            state: this.props.location.state,
          },
        } : {
          text: 'No account?',
          actionText: 'Sign up Here!',
          linkTo: {
            pathname: '/signup',
            state: this.props.location.state,
          },
        }}
        layout={this.props.type}
      />
    );
  }

  renderInvitation() {
    // Only load invitation if we are on /invitation/...
    // We want to make sure a user is not tricked into accepting an invitation
    if (this.props.invitationId && this.props.invitationStatus === undefined) {
      const invitationId = this.props.invitationId;
      ServerAdmin.get().dispatchAdmin({ debounce: true, ssr: true, ssrStatusPassthrough: true }).then(dispatcher => dispatcher
        .accountViewInvitationAdmin({ invitationId }));
    }

    const isLoggedIn = this.props.accountStatus === Status.FULFILLED && !!this.props.account;
    const expired = !this.props.invitationId || this.props.invitationStatus === Status.REJECTED || (this.props.invitationStatus === Status.FULFILLED && !this.props.invitation);
    const loading = !this.props.invitation && !expired;
    const accepted = this.props.invitation?.isAcceptedByYou;
    return (
      <EnterTemplate
        title={!!this.props.invitation ? (accepted ? (
          'Invitation accepted'
        ) : (
          <>
            {'Invitation from '}
            <span className={this.props.classes.titleClearFlask}>{this.props.invitation?.inviteeName}</span>
          </>
        )) : (expired ? (
          <span className={this.props.classes.expired}>Invitation expired</span>
        ) : 'Invitation loading...')}
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
        submitTitle={expired ? undefined : (!isLoggedIn ? 'Sign up' : (!accepted ? 'Accept' : 'Open'))}
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
          text: 'Have an account?',
          actionText: 'Log in Here!',
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

  onOauth(type: 'google' | 'github' | 'bathtub', selectedPlanId: string) {
    const extraData: OauthExtraData = {
      selectedPlanId,
      invitationId: this.props.location.state?.[ADMIN_ENTER_INVITATION_ID],
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
    if (isTracking()) {
      ReactGA.event({
        category: 'account-signup',
        action: 'click-create',
        label: selectedPlanId,
      });
      LinkedInTag.track('5353172');
    }

    this.setState({ isSubmitting: true });
    const dispatchAdmin = await ServerAdmin.get().dispatchAdmin();
    try {
      const result = await dispatchAdmin.accountSignupAdmin({
        accountSignupAdmin: {
          name: this.state.name!,
          email: this.state.email!,
          password: saltHashPassword(this.state.pass!),
          basePlanId: selectedPlanId,
          invitationId: this.props.location.state?.[ADMIN_ENTER_INVITATION_ID],
        }
      });
      this.setState({
        isSubmitting: false,
        accountWasCreated: true,
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
  const a = props.layout === 'signup';
  return (
    <div className={classes.page}>
      <Container maxWidth='md' className={classes.enterTemplate}>
        <AnimBubble delay='0ms' duration='400ms' size={props.layout === 'signup' ? 350 : (props.layout === 'login' ? 100 : 400)} x={props.layout === 'signup' ? 420 : (props.layout === 'login' ? 50 : 100)} y={props.layout === 'signup' ? 70 : (props.layout === 'login' ? 210 : 0)} />
        <AnimBubble delay='20ms' duration='200ms' size={props.layout === 'signup' ? 100 : (props.layout === 'login' ? 300 : 200)} x={props.layout === 'signup' ? 800 : (props.layout === 'login' ? 400 : 650)} y={props.layout === 'signup' ? 130 : (props.layout === 'login' ? 50 : 250)} />
        <AnimBubble delay='40ms' duration='300ms' size={props.layout === 'signup' ? 150 : (props.layout === 'login' ? 500 : 100)} x={props.layout === 'signup' ? 520 : (props.layout === 'login' ? -200 : 100)} y={props.layout === 'signup' ? 470 : (props.layout === 'login' ? 700 : 500)} />
        <AnimBubble delay='100ms' duration='500ms' size={props.layout === 'signup' ? 300 : (props.layout === 'login' ? 150 : 700)} x={props.layout === 'signup' ? 900 : (props.layout === 'login' ? 350 : 800)} y={props.layout === 'signup' ? 700 : (props.layout === 'login' ? 500 : 950)} />
        <AnimBubble delay='100ms' duration='500ms' size={props.layout === 'signup' ? 500 : (props.layout === 'login' ? 300 : 400)} x={props.layout === 'signup' ? 1300 : (props.layout === 'login' ? 900 : 1100)} y={props.layout === 'signup' ? 450 : (props.layout === 'login' ? 700 : 150)} />
        <div className={classes.paperContainerContainer}>
          <div className={classNames(
            classes.paperContainer,
            props.layout === 'login' && classes.paperContainerRight,
            props.layout === 'invitation' && classes.paperContainerCenter,
          )}>
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
}, null, null, { forwardRef: true })(withStyles(styles, { withTheme: true })(withRouter(AccountEnterPage)));
