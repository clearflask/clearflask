import { Collapse, Container, DialogActions, IconButton, InputAdornment, TextField, Typography } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import VisibilityIcon from '@material-ui/icons/Visibility';
import VisibilityOffIcon from '@material-ui/icons/VisibilityOff';
import React, { Component } from 'react';
import ReactGA from 'react-ga';
import { connect } from 'react-redux';
import { NavLink, RouteComponentProps, withRouter } from 'react-router-dom';
import * as Admin from '../api/admin';
import { Status } from '../api/server';
import ServerAdmin, { ReduxStateAdmin } from '../api/serverAdmin';
import ErrorPage from '../app/ErrorPage';
import AcceptTerms from '../common/AcceptTerms';
import Message from '../common/Message';
import SubmitButton from '../common/SubmitButton';
import { saltHashPassword } from '../common/util/auth';
import { isProd, isTracking } from '../common/util/detectEnv';
import preloadImage from '../common/util/imageUtil';
import { RedirectIso } from '../common/util/routerUtil';
import windowIso from '../common/windowIso';
import { WelcomeImagePath } from './dashboard/WelcomePage';
import { ADMIN_LOGIN_REDIRECT_TO } from './SigninPage';

/** Toggle whether production has signups enabled. Test environments are unaffected. */
export const SIGNUP_PROD_ENABLED = true;
export const PRE_SELECTED_BASE_PLAN_ID = 'preSelectedPlanId';
export const REQUIRES_WORK_EMAIL_ABOVE_PRICE = 50;

const styles = (theme: Theme) => createStyles({
  page: {
    flex: '0 1',
    margin: theme.spacing(2),
    marginLeft: 'auto',
    marginRight: 'auto',
    display: 'flex',
    [theme.breakpoints.down('sm')]: {
      flexWrap: 'wrap',
    },
  },
  itemContainer: {
    margin: theme.spacing(2),
    minWidth: 300,
    maxWidth: 300,
  },
  item: {
    margin: theme.spacing(1, 2),
  },
  image: {
    width: '100%',
    [theme.breakpoints.up('md')]: {
      marginTop: 300,
    },
    [theme.breakpoints.down('sm')]: {
      margin: theme.spacing(0, 8),
    },
  },
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
});
interface Props {
}
interface ConnectProps {
  callOnMount?: () => void,
  accountStatus?: Status;
  plans?: Admin.Plan[];
}
interface State {
  isSubmitting?: boolean;
  name?: string;
  email?: string;
  emailIsFreeOrDisposable?: boolean;
  pass?: string;
  revealPassword?: boolean;
}

class SignupPage extends Component<Props & ConnectProps & RouteComponentProps & WithStyles<typeof styles, true>, State> {
  state: State = {};

  constructor(props) {
    super(props);

    props.callOnMount?.();

    preloadImage(WelcomeImagePath);
  }

  render() {
    if (this.props.accountStatus === Status.FULFILLED) {
      return (<RedirectIso to={this.props.match.params[ADMIN_LOGIN_REDIRECT_TO] || '/dashboard'} />);
    }

    if (!SIGNUP_PROD_ENABLED && isProd() && new URL(windowIso.location.href).searchParams.get('please') !== 'true') {
      return <ErrorPage variant='warning' msg={(
        <div style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', }} >
          Direct sign ups are currently disabled. Instead,&nbsp;
          <NavLink to='/contact/demo' className={this.props.classes.link}>schedule a demo</NavLink>
          &nbsp;with us.
        </div>
      )} />
    }

    const selectedPlanId = (this.props.location.state as any)?.[PRE_SELECTED_BASE_PLAN_ID]
      || (this.props.plans ? this.props.plans[0].basePlanId : undefined);
    const selectedPlan = !selectedPlanId ? undefined : this.props.plans?.find(plan => plan.basePlanId === selectedPlanId);

    const selectedPlanRequiresWorkEmail = !!selectedPlan
      && !!selectedPlan.pricing
      && (selectedPlan.pricing.basePrice > REQUIRES_WORK_EMAIL_ABOVE_PRICE || selectedPlan.pricing.unitPrice > REQUIRES_WORK_EMAIL_ABOVE_PRICE)
    const requiresWorkEmail = !!selectedPlanRequiresWorkEmail && !!this.state.emailIsFreeOrDisposable;

    const canSubmit = !!this.state.name
      && !!this.state.email
      && !requiresWorkEmail
      && !!this.state.pass;
    const emailDisposableList = import(/* webpackChunkName: "emailDisposableList" */'../common/util/emailDisposableList');

    return (
      <Container maxWidth='md' className={this.props.classes.page}>
        <div className={this.props.classes.itemContainer}>
          <Typography component="h1" variant="h2" color="textPrimary">Sign up</Typography>
          <Typography component="h2" variant="h5" color="textSecondary">Start gathering feedback</Typography>
          <br />
          <TextField
            className={this.props.classes.item}
            fullWidth
            id='name'
            placeholder='Your name / organization'
            required
            value={this.state.name || ''}
            onChange={e => this.setState({ name: e.target.value })}
          />
          <TextField
            className={this.props.classes.item}
            fullWidth
            id='email'
            placeholder='Work email'
            required
            value={this.state.email || ''}
            onChange={e => {
              const newEmail = e.target.value;
              this.setState({ email: newEmail });
              emailDisposableList.then(eu => this.setState({ emailIsFreeOrDisposable: eu.isFreeOrDisposable(newEmail) }));
            }}
          />
          <Collapse in={!!requiresWorkEmail}>
            <Message variant='warning' message={(
              <div style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', }} >
                Please enter your work email. Don't have one?&nbsp;
                <NavLink to='/contact/demo' className={this.props.classes.link}>Schedule a demo</NavLink>
                  &nbsp;with us.
              </div>
            )} />
          </Collapse>
          <TextField
            className={this.props.classes.item}
            fullWidth
            id='pass'
            placeholder='Password'
            required
            value={this.state.pass || ''}
            onChange={e => this.setState({ pass: e.target.value })}
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
              ),
            }}
          />
          <AcceptTerms />
          <br />
          <DialogActions>
            <SubmitButton
              color='primary'
              isSubmitting={this.state.isSubmitting}
              disabled={!canSubmit}
              onClick={this.signUp.bind(this, selectedPlanId)}
            >Create account</SubmitButton>
          </DialogActions>
        </div>
        <img
          alt='signup'
          className={this.props.classes.image}
          src='/img/dashboard/enter.svg'
        />
      </Container>
    );
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

export default connect<ConnectProps, {}, Props, ReduxStateAdmin>((state, ownProps) => {
  const newProps: ConnectProps = {
    accountStatus: state.account.account.status,
    plans: state.plans.plans.plans,
  };
  if (state.plans.plans.status === undefined) {
    newProps.callOnMount = () => {
      ServerAdmin.get().dispatchAdmin({ ssr: true }).then(d => d.plansGet());
    };
  }
  return newProps;
})(withStyles(styles, { withTheme: true })(withRouter(SignupPage)));
