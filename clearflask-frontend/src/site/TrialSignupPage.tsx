import { Button, Collapse, Container, DialogActions, Grid, IconButton, InputAdornment, TextField, Typography } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import VisibilityIcon from '@material-ui/icons/Visibility';
import VisibilityOffIcon from '@material-ui/icons/VisibilityOff';
import React, { Component } from 'react';
import ReactGA from 'react-ga';
import { connect } from 'react-redux';
import { Link, NavLink, Redirect, RouteComponentProps } from 'react-router-dom';
import * as Admin from '../api/admin';
import { Status } from '../api/server';
import ServerAdmin, { ReduxStateAdmin } from '../api/serverAdmin';
import ErrorPage from '../app/ErrorPage';
import Loader from '../app/utils/Loader';
import AcceptTerms from '../common/AcceptTerms';
import Message from '../common/Message';
import SubmitButton from '../common/SubmitButton';
import notEmpty from '../common/util/arrayUtil';
import { saltHashPassword } from '../common/util/auth';
import { isProd, isTracking } from '../common/util/detectEnv';
import PlanPeriodSelect from './PlanPeriodSelect';
import PricingPlan from './PricingPlan';
import { ADMIN_LOGIN_REDIRECT_TO } from './SigninPage';

/** Toggle whether production has signups enabled. Test environments are unaffected. */
export const SIGNUP_PROD_ENABLED = false;
export const PRE_SELECTED_PLAN_ID = 'preSelectedPlanId';
export const REQUIRES_WORK_EMAIL_ABOVE_PRICE = 50;

const styles = (theme: Theme) => createStyles({
  page: {
    margin: theme.spacing(2),
  },
  item: {
    margin: theme.spacing(2),
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
  accountStatus?: Status;
  plans?: Admin.Plan[];
}
interface State {
  period?: Admin.PlanPricingPeriodEnum;
  planid?: string;
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

    this.state = {
      planid: props.location.state?.[PRE_SELECTED_PLAN_ID],
    };
  }

  render() {
    if (this.props.accountStatus === Status.FULFILLED) {
      return (<Redirect to={this.props.match.params[ADMIN_LOGIN_REDIRECT_TO] || '/dashboard'} />);
    }

    if (!SIGNUP_PROD_ENABLED && isProd() && new URL(window.location.href).searchParams.get('please') !== 'true') {
      return <ErrorPage variant='warning' msg={(
        <div style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', }} >
          Direct sign ups are currently disabled. Instead,&nbsp;
          <NavLink to='/contact/demo' className={this.props.classes.link}>schedule a demo</NavLink>
          &nbsp;with us.
        </div>
      )} />
    }

    const allPlans = this.props.plans || [];
    const periodsSet = new Set(allPlans
      .map(plan => plan.pricing?.period)
      .filter(notEmpty));
    const periods = Object.keys(Admin.PlanPricingPeriodEnum).filter(period => periodsSet.has(period as any as Admin.PlanPricingPeriodEnum));
    const selectedPeriod = this.state.period
      || (periods.length > 0 ? periods[periods.length - 1] as any as Admin.PlanPricingPeriodEnum : undefined);
    const plans = allPlans
      .filter(plan => plan.pricing && selectedPeriod === plan.pricing.period);
    const selectedPlanId = this.state.planid || plans[0]?.planid;
    const selectedPlan = !selectedPlanId ? undefined : allPlans
      .find(plan => plan.planid === selectedPlanId);

    const selectedPlanRequiresWorkEmail = !!selectedPlan
      && !!selectedPlan.pricing
      && (selectedPlan.pricing.basePrice > REQUIRES_WORK_EMAIL_ABOVE_PRICE || selectedPlan.pricing.unitPrice > REQUIRES_WORK_EMAIL_ABOVE_PRICE)
    const requiresWorkEmail = !!selectedPlanRequiresWorkEmail && !!this.state.emailIsFreeOrDisposable;

    const canSubmit = !!this.state.name
      && !!this.state.email
      && !requiresWorkEmail
      && !!this.state.pass;
    const emailDisposableList = import('../common/util/emailDisposableList');

    return (
      <div className={this.props.classes.page}>
        <Container maxWidth='md'>
          <Typography component="h1" variant="h2" color="textPrimary">Sign up</Typography>
          <Typography component="h2" variant="h4" color="textSecondary">Start your free 14-day trial</Typography>
          {periods.length > 1 && (
            <PlanPeriodSelect
              plans={this.props.plans}
              value={selectedPeriod}
              onChange={period => this.setState({ period, planid: undefined })}
            />
          )}
        </Container>
        <br />
        <br />
        <br />
        <Container maxWidth='md'>
          <Loader loaded={!!this.props.plans}>
            <Grid container spacing={5} alignItems='stretch' justify='center'>
              {plans.map((plan, index) => (
                <Grid item key={plan.planid} xs={12} sm={index === 2 ? 12 : 6} md={4}>
                  <PricingPlan
                    plan={plan}
                    selected={selectedPlanId === plan.planid}
                    actionTitle={selectedPlanId === plan.planid ? 'Selected' : 'Select'}
                    actionType='radio'
                    actionOnClick={() => this.setState({ planid: plan.planid })}
                  />
                </Grid>
              ))}
            </Grid>
          </Loader>
        </Container>
        <br />
        <br />
        <br />
        <Container maxWidth='xs'>
          <TextField
            className={this.props.classes.item}
            fullWidth
            id='name'
            label='Name'
            required
            value={this.state.name || ''}
            onChange={e => this.setState({ name: e.target.value })}
          />
          <TextField
            className={this.props.classes.item}
            fullWidth
            id='email'
            label='Work email'
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
            label='Password'
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
          <DialogActions>
            <Button
              component={Link}
              to='/dashboard'
            >Or Login</Button>
            <SubmitButton
              color='primary'
              isSubmitting={this.state.isSubmitting}
              disabled={!canSubmit}
              onClick={this.signUp.bind(this, selectedPlanId)}
            >Create account</SubmitButton>
          </DialogActions>
        </Container>
      </div>
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
          planid: selectedPlanId,
        }
      });
    } catch (err) {
      this.setState({ isSubmitting: false });
      return;
    }
    this.props.history.push('/dashboard');
  }
}

export default connect<ConnectProps, {}, Props, ReduxStateAdmin>((state, ownProps) => {
  if (state.plans.plans.status === undefined) {
    ServerAdmin.get().dispatchAdmin().then(d => d.plansGet());
  }
  return {
    accountStatus: state.account.account.status,
    plans: state.plans.plans.plans,
  };
})(withStyles(styles, { withTheme: true })(SignupPage));
