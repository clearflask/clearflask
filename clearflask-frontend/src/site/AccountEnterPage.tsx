// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
import { Button, Collapse, Container, IconButton, InputAdornment, Paper, TextField, Typography } from '@material-ui/core';
import { createStyles, makeStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import EmailIcon from '@material-ui/icons/Email';
import GithubIcon from '@material-ui/icons/GitHub';
import VisibilityIcon from '@material-ui/icons/Visibility';
import VisibilityOffIcon from '@material-ui/icons/VisibilityOff';
import classNames from 'classnames';
import React, { Component } from 'react';
import ReactGA from 'react-ga';
import { connect } from 'react-redux';
import { RouteComponentProps, withRouter } from 'react-router';
import { Link, NavLink } from 'react-router-dom';
import * as Admin from '../api/admin';
import { Status } from '../api/server';
import ServerAdmin, { ReduxStateAdmin } from '../api/serverAdmin';
import { SSO_TOKEN_PARAM_NAME } from '../app/App';
import ErrorPage from '../app/ErrorPage';
import LoadingPage from '../app/LoadingPage';
import AcceptTerms from '../common/AcceptTerms';
import Hr from '../common/Hr';
import GoogleIcon from '../common/icon/GoogleIcon';
import Message from '../common/Message';
import SubmitButton from '../common/SubmitButton';
import { saltHashPassword } from '../common/util/auth';
import { detectEnv, Environment, isProd, isTracking } from '../common/util/detectEnv';
import { OAuthFlow } from '../common/util/oauthUtil';
import { RedirectIso } from '../common/util/routerUtil';
import { vh } from '../common/util/screenUtil';
import windowIso from '../common/windowIso';
import AnimBubble from './landing/AnimBubble';

export const ADMIN_LOGIN_REDIRECT_TO = 'ADMIN_LOGIN_REDIRECT_TO';
/** Toggle whether production has signups enabled. Test environments are unaffected. */
export const SIGNUP_PROD_ENABLED = true;
export const PRE_SELECTED_BASE_PLAN_ID = 'preSelectedPlanId';

export const urlAddCfJwt = (url: string, account?: Admin.AccountAdmin): string => {
  return !!account
    ? `${url}?${SSO_TOKEN_PARAM_NAME}=${account.cfJwt}`
    : url;
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
    minHeight: '100vh',
    overflow: 'hidden',
  },
  titleClearFlask: {
    color: theme.palette.primary.main,
  },
  paperContainerContainer: {
    width: '100%',
    display: 'flex',
    margin: theme.spacing(1),
  },
  paperContainer: {
    flex: 1,
    transition: theme.transitions.create(['flex', 'margin']),
  },
  paperContainerAlternateLayout: {
    flex: 'none',
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
    minHeight: vh(100),
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
});
const useStyles = makeStyles(styles);
interface Props {
  type: 'login' | 'signup';
}
interface ConnectProps {
  callOnMount?: () => void,
  accountStatus?: Status;
  account?: Admin.AccountAdmin;
  cfJwt?: string;
  plans?: Admin.Plan[];
}
interface State {
  isSubmitting?: boolean;
  useEmail?: boolean; // login & signup
  email?: string; // login & signup
  pass?: string; // login & signup
  name?: string; // signup only
  emailIsFreeOrDisposable?: boolean; // signup only
  revealPassword?: boolean; // login & signup
}
class AccountEnterPage extends Component<Props & RouteComponentProps & ConnectProps & WithStyles<typeof styles, true>, State> {
  state: State = {};
  readonly cfReturnUrl?: string;
  readonly oauthFlow = new OAuthFlow({ accountType: 'admin', redirectPath: '/login' });
  bindCausedAccountCreation: boolean = false;

  constructor(props) {
    super(props);

    try {
      const paramCfr = new URL(windowIso.location.href).searchParams.get('cfr');
      if (paramCfr && new URL(paramCfr).host.endsWith(windowIso.location.host)) {
        this.cfReturnUrl = paramCfr;
      }
    } catch (er) { }
  }

  componentDidMount() {
    const oauthToken = this.oauthFlow.checkResult();

    if (this.props.accountStatus === undefined) {
      ServerAdmin.get().dispatchAdmin().then(d => d.accountBindAdmin({
        accountBindAdmin: {
          oauthToken: !oauthToken ? undefined : {
            id: oauthToken.id,
            code: oauthToken.code,
            basePlanId: oauthToken?.extraData,
          },
        },
      })).then(result => {
        this.bindCausedAccountCreation = !!result.created;
        !!result.account && this.oauthFlow.broadcastSuccess();
      });
    }

    this.props.callOnMount?.();
  }

  render() {
    if (this.props.accountStatus === Status.FULFILLED && !!this.props.account) {
      if (this.props.cfJwt && this.cfReturnUrl) {
        windowIso.location.href = `${this.cfReturnUrl}?${SSO_TOKEN_PARAM_NAME}=${this.props.cfJwt}`;
        return (<ErrorPage msg='Redirecting you back...' variant='success' />);
      }
      return (<RedirectIso to={this.props.match.params[ADMIN_LOGIN_REDIRECT_TO] ||
        (this.bindCausedAccountCreation ? '/welcome' : '/dashboard')} />);
    }

    const selectedPlanId = ((this.props.location.state as any)?.[PRE_SELECTED_BASE_PLAN_ID] as string | undefined)
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
    const signUpOrLogIn = this.props.type === 'signup' ? 'Sign up ' : 'Log in ';

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
                >
                  <GoogleIcon />
                  &nbsp;&nbsp;{signUpOrLogIn}with Google
                </Button>
                <Button
                  className={this.props.classes.oauthEnter}
                  variant='outlined'
                  fullWidth
                  size='large'
                  onClick={e => !!selectedPlanId && this.onOauth('github', selectedPlanId)}
                >
                  <GithubIcon />
                  &nbsp;&nbsp;{signUpOrLogIn}with GitHub
                </Button>
              </>
            )}
            <Collapse in={!this.state.useEmail}>
              <Button
                className={this.props.classes.oauthEnter}
                variant='outlined'
                fullWidth
                size='large'
                onClick={e => this.setState({ useEmail: true })}
              >
                <EmailIcon />
                &nbsp;&nbsp;{signUpOrLogIn}with Email
              </Button>
            </Collapse>
            <Collapse in={this.state.useEmail}>
              <div>
                <Hr isInsidePaper length={120} margins={15}>OR</Hr>
                <Collapse in={this.props.type === 'signup'}>
                  <TextField
                    variant='outlined'
                    fullWidth
                    margin='normal'
                    placeholder='Your name / organization'
                    required
                    value={this.state.name || ''}
                    onChange={e => this.setState({ name: e.target.value })}
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
        footerText={this.props.type === 'signup' ? 'Have an account?' : 'No account?'}
        footerActionText={this.props.type === 'signup' ? 'Log in Here!' : 'Sign up Here!'}
        footerLinkTo={this.props.type === 'signup' ? '/login' : 'signup'}
        alternateLayout={this.props.type === 'signup'}
      />
    );
  }

  onOauth(type: 'google' | 'github', selectedPlanId: string) {
    this.oauthFlow.listenForSuccess(() => {
      ServerAdmin.get().dispatchAdmin().then(d => d.accountBindAdmin({ accountBindAdmin: {} }));
    });
    this.oauthFlow.openForAccount(type, selectedPlanId);
  }

  onLogin() {
    this.setState({ isSubmitting: true });
    ServerAdmin.get().dispatchAdmin().then(d => d.accountLoginAdmin({
      accountLogin: {
        email: this.state.email || '',
        password: saltHashPassword(this.state.pass || ''),
      }
    })).then((result) => {
      this.setState({ isSubmitting: false });
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
    }

    this.setState({ isSubmitting: true });
    const dispatchAdmin = await ServerAdmin.get().dispatchAdmin();
    try {
      await dispatchAdmin.accountSignupAdmin({
        accountSignupAdmin: {
          name: this.state.name!,
          email: this.state.email!,
          password: saltHashPassword(this.state.pass!),
          basePlanId: selectedPlanId,
        }
      });
    } catch (err) {
      this.setState({ isSubmitting: false });
      return;
    }
    this.props.history.push('/dashboard/welcome');
  }
}

const EnterTemplate = (props: {
  title: React.ReactNode;
  renderContent: (submitButton: React.ReactNode) => React.ReactNode;
  submitTitle: React.ReactNode;
  submitDisabled?: boolean;
  isSubmitting?: boolean;
  onSubmit: () => void;
  footerText: string;
  footerActionText: string;
  footerLinkTo: string;
  alternateLayout?: boolean;
}) => {
  const classes = useStyles();
  const a = !!props.alternateLayout;
  return (
    <div className={classes.page}>
      <Container maxWidth='md' className={classes.enterTemplate}>
        <AnimBubble delay='0ms' duration='400ms' size={a ? 350 : 100} x={a ? 420 : 50} y={a ? 70 : 210} />
        <AnimBubble delay='20ms' duration='200ms' size={a ? 100 : 300} x={a ? 800 : 400} y={a ? 130 : 50} />
        <AnimBubble delay='40ms' duration='300ms' size={a ? 150 : 500} x={a ? 520 : -200} y={a ? 470 : 700} />
        <AnimBubble delay='100ms' duration='500ms' size={a ? 300 : 150} x={a ? 900 : 350} y={a ? 700 : 500} />
        <AnimBubble delay='100ms' duration='500ms' size={a ? 500 : 300} x={a ? 1300 : 900} y={a ? 450 : 700} />
        <div className={classes.paperContainerContainer}>
          <div className={classNames(
            classes.paperContainer,
            !!props.alternateLayout && classes.paperContainerAlternateLayout,
          )}>
            <Paper className={classes.paper}>
              <Typography component='h1' variant='h4' color='textPrimary' className={classes.welcomeBack}>
                {props.title}
              </Typography>
              {props.renderContent((
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
              <div>
                <Typography component="span" variant="caption" color="textPrimary">
                  {props.footerText}&nbsp;
                </Typography>
                <Link to={props.footerLinkTo} className={classes.signUpHere}>
                  <Typography component="span" variant="caption" color="primary">
                    {props.footerActionText}
                  </Typography>
                </Link>
              </div>
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
    plans: state.plans.plans.plans,
    cfJwt: state.account.account.account?.cfJwt,
  };
  if (state.plans.plans.status === undefined) {
    connectProps.callOnMount = () => {
      ServerAdmin.get().dispatchAdmin({ ssr: true }).then(d => d.plansGet());
    };
  }
  return connectProps;
}, null, null, { forwardRef: true })(withStyles(styles, { withTheme: true })(withRouter(AccountEnterPage)));
