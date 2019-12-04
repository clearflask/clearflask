import React, { Component } from 'react';
import { Typography, Grid, Button, Container, Card, CardHeader, CardContent, CardActions, Stepper, StepLabel, StepContent, Step, Box, TextField, Link, InputAdornment, IconButton, Table, TableBody, TableRow, TableCell, FormHelperText, FormControlLabel, Switch } from '@material-ui/core';
import { withStyles, Theme, createStyles, WithStyles } from '@material-ui/core/styles';
import CheckIcon from '@material-ui/icons/CheckRounded';
import { History, Location } from 'history';
import VisibilityIcon from '@material-ui/icons/Visibility';
import VisibilityOffIcon from '@material-ui/icons/VisibilityOff';
import StripeProviderProvider from '../common/stripe/StripeProviderProvider';
import { CardNumberElement, CardExpiryElement, CardCVCElement, ReactStripeElements } from 'react-stripe-elements';
import Loader from '../app/utils/Loader';
import StripeElementWrapper from '../common/stripe/StripeElementWrapper';
import Message from '../app/comps/Message';
import ServerAdmin, { ReduxStateAdmin } from '../api/serverAdmin';
import { connect } from 'react-redux';
import * as Admin from '../api/admin';
import { saltHashPassword } from '../common/util/auth';
import PricingPlan from './PricingPlan';

export const PRE_SELECTED_PLAN_ID = 'preSelectedPlanId';

const styles = (theme:Theme) => createStyles({
  page: {
    margin: theme.spacing(2),
  },
  item: {
    margin: theme.spacing(2),
  },
  link: {
    cursor: 'pointer',
    textDecoration: 'none!important',
    color: theme.palette.text.primary,
  },
  stripeGrid: {
    minWidth: '167px',
    width: '300px',
    margin: theme.spacing(1),
  },
  stripeInput: {
    padding: theme.spacing(1),
  },
  reviewRowError: {
    color: theme.palette.error.main,
  },
});

interface Props {
  history:History;
  location:Location;
}
interface ConnectProps {
  plans?:Admin.Plan[];
}
interface State {
  error?:string;
  step:number;
  isSubmitting?:boolean;
  planId?:string;
  billingIsYearly:boolean;
  company?:string;
  name?:string;
  email?:string;
  phone?:string;
  pass?:string;
  revealPassword?:boolean;
  stripe?:ReactStripeElements.StripeProps;
  stripeLoadError?:string;
  cardValid?:boolean;
  cardExpiryValid?:boolean;
  cardCvcValid?:boolean;
}

class SignupPage extends Component<Props&ConnectProps&WithStyles<typeof styles, true>, State> {

  constructor(props) {
    super(props);

    var billingIsYearly = true;
    var planId;
    if(props.location && props.location.state && props.location.state[PRE_SELECTED_PLAN_ID]) {
      planId = props.location.state[PRE_SELECTED_PLAN_ID];
      if(props.plans && props.plans[planId] && props.plans[planId].pricing) {
        billingIsYearly = props.plans[planId].pricing!.period === Admin.PlanPricingPeriodEnum.Yearly;
      }
    }
    this.state = {
      step: 0,
      planId: planId,
      billingIsYearly: billingIsYearly,
    };
  }

  render() {
    const selectedPlan = this.state.planId && this.props.plans && this.props.plans.find(plan =>
      plan.planid === this.state.planId);

    const plans = this.props.plans
      ? this.props.plans.filter(plan => !!plan.pricing && plan.pricing.period === (this.state.billingIsYearly ? Admin.PlanPricingPeriodEnum.Yearly : Admin.PlanPricingPeriodEnum.Quarterly))
      : [];

    const planStepCompleted = !!this.state.planId && !!selectedPlan;
    const accountStepCompleted = !!this.state.company && !!this.state.name && !!this.state.email && !!this.state.pass;
    const billingStepCompleted = !!this.state.stripe && !!this.state.cardValid && !!this.state.cardExpiryValid && !!this.state.cardCvcValid;

    return (
      <div className={this.props.classes.page}>
        <Container maxWidth='md'>
          <Stepper activeStep={this.state.step} orientation='vertical'>
            <Step key='plan' completed={planStepCompleted}>
              <StepLabel error={this.state.step > 0 && !planStepCompleted}>
                <Link onClick={() => !this.state.isSubmitting && this.setState({step: 0})} className={this.props.classes.link}>
                  Plan
                </Link>
              </StepLabel>
              <StepContent TransitionProps={{mountOnEnter: true, unmountOnExit: false}}>
                <Loader loaded={!!this.props.plans}>
                  <FormControlLabel
                    control={(
                      <Switch
                        checked={this.state.billingIsYearly}
                        onChange={(e, checked) => this.setState({billingIsYearly: !this.state.billingIsYearly})}
                        color='default'
                      />
                    )}
                    label={(<FormHelperText component='span'>{this.state.billingIsYearly ? 'Yearly billing' : 'Quarterly billing'}</FormHelperText>)}
                  />
                  <Grid container spacing={4} alignItems='flex-start' className={this.props.classes.item}>
                    {plans.map((plan, index) => (
                      <Grid item key={plan.title} xs={12} sm={6}>
                        <PricingPlan
                          plan={plan}
                          history={this.props.history}
                          actionTitle={this.state.planId === plan.planid ? 'continue' : 'select'}
                          actionOnClick={() => this.setState({
                            planId: plan.planid,
                            step: this.state.step + 1,
                          })}
                          selected={this.state.planId === plan.planid}
                          expanded
                        />
                      </Grid>
                    ))}
                  </Grid>
                </Loader>
              </StepContent>
            </Step>
            <Step key='account' completed={accountStepCompleted}>
              <StepLabel error={this.state.step > 1 && !accountStepCompleted}>
                <Link onClick={() => !this.state.isSubmitting && this.setState({step: 1})} className={this.props.classes.link}>
                  Account
                </Link>
              </StepLabel>
              <StepContent TransitionProps={{mountOnEnter: true, unmountOnExit: false}}>
                <Box display='flex' flexDirection='column' alignItems='flex-start'>
                  <TextField
                    className={this.props.classes.item}
                    id='company'
                    label='Company'
                    required
                    value={this.state.company || ''}
                    onChange={e => this.setState({ company: e.target.value })}
                  />
                  <TextField
                    className={this.props.classes.item}
                    id='name'
                    label='Name'
                    required
                    value={this.state.name || ''}
                    onChange={e => this.setState({ name: e.target.value })}
                  />
                  <TextField
                    className={this.props.classes.item}
                    id='phone'
                    label='Phone'
                    value={this.state.phone || ''}
                    onChange={e => this.setState({ phone: e.target.value })}
                  />
                  <TextField
                    className={this.props.classes.item}
                    id='email'
                    label='Email'
                    required
                    value={this.state.email || ''}
                    onChange={e => this.setState({ email: e.target.value })}
                  />
                  <Box display='flex' flexDirection='row' alignItems='center'>
                  <TextField
                    className={this.props.classes.item}
                    id='pass'
                    label='Password'
                    required
                    value={this.state.pass || ''}
                    onChange={e => this.setState({ pass: e.target.value })}
                    type={this.state.revealPassword ? 'text' : 'password'}
                  />
                  <IconButton
                    aria-label='Toggle password visibility'
                    onClick={() => this.setState({revealPassword: !this.state.revealPassword})}
                  >
                    {this.state.revealPassword ? <VisibilityIcon fontSize='small' /> : <VisibilityOffIcon fontSize='small' />}
                  </IconButton>
                  </Box>
                </Box>
                <Box display='flex' className={this.props.classes.item}>
                  <Button onClick={() => this.setState({step: this.state.step + 1})} color='primary' disabled={!accountStepCompleted}>Next</Button>
                </Box>
              </StepContent>
            </Step>
            <Step key='billing' completed={billingStepCompleted}>
              <StepLabel error={this.state.step > 2 && !billingStepCompleted}>
                <Link onClick={() => !this.state.isSubmitting && this.setState({step: 2})} className={this.props.classes.link}>
                  Billing
                </Link>
              </StepLabel>
              <StepContent TransitionProps={{mountOnEnter: true, unmountOnExit: false}}>
                <Box display='flex' flexDirection='column' alignItems='flex-start'>
                  <Typography>Enter your payment information</Typography>
                  <StripeProviderProvider stripeKey='pk_test_M1ANiFgYLBV2UyeVB10w1Ons'
                    onStripeElementsReady={stripe => this.setState({stripe: stripe})}
                    onError={() => this.setState({stripeLoadError: 'Failed to load payment processor'})}>
                    <Loader loaded={!!this.state.stripe} error={this.state.stripeLoadError}>
                      <React.Fragment>
                        {/* <CardElement className={this.props.classes.cardEl} /> */}
                        <Grid container className={this.props.classes.stripeGrid}>
                          <Grid item xs={12} className={this.props.classes.stripeInput}>
                            <StripeElementWrapper
                              onValidChanged={isValid => this.setState({cardValid: isValid})}
                              label="Card Number" component={CardNumberElement} />
                          </Grid>
                          <Grid item xs={7} className={this.props.classes.stripeInput}>
                            <StripeElementWrapper
                              onValidChanged={isValid => this.setState({cardExpiryValid: isValid})}
                              label="Expiry (MM / YY)" component={CardExpiryElement} />
                          </Grid>
                          <Grid item xs={5} className={this.props.classes.stripeInput}>
                            <StripeElementWrapper
                              onValidChanged={isValid => this.setState({cardCvcValid: isValid})}
                              label="CVC" component={CardCVCElement} />
                          </Grid>
                        </Grid>
                      </React.Fragment>
                    </Loader>
                  </StripeProviderProvider>
                </Box>
                <Box display='flex' className={this.props.classes.item}>
                  <Button onClick={() => this.setState({step: this.state.step + 1})} color='primary' disabled={!billingStepCompleted}>Next</Button>
                </Box>
              </StepContent>
            </Step>
            <Step key='submit'>
              <StepLabel>
                <Link onClick={() => !this.state.isSubmitting && this.setState({step: 3})} className={this.props.classes.link}>
                  {'Review & Submit'}
                </Link>
              </StepLabel>
              <StepContent TransitionProps={{mountOnEnter: true, unmountOnExit: false}}>
                <Box width='fit-content'>
                  <Table>
                    <TableBody>
                      {[
                        {name: 'Plan', value: (selectedPlan && selectedPlan.pricing) ? `${selectedPlan.title} (${selectedPlan.pricing.period === Admin.PlanPricingPeriodEnum.Yearly ? 'Yearly' : 'Quarterly'})` : 'No plan selected', error: !selectedPlan},
                        {name: 'Company', value: this.state.company || 'Missing company name', error: !this.state.company},
                        {name: 'Name', value: this.state.name || 'Missing name', error: !this.state.name},
                        {name: 'Phone', value: this.state.phone ? 'Completed' : 'Skipped'},
                        {name: 'Email', value: this.state.email || 'Missing email', error: !this.state.email},
                        {name: 'Password', value: this.state.pass ? 'Set' : 'Not set', error: !this.state.pass},
                        {name: 'Billing', value: billingStepCompleted ? 'Completed' : 'Incomplete', error: !billingStepCompleted },
                      ].map((data:{name:string, value:string, error?:boolean}) => (
                        <TableRow key={data.name}>
                          <TableCell key='date'><Typography>
                            {data.name}
                          </Typography></TableCell>
                          <TableCell key='title'><Typography className={data.error ? this.props.classes.reviewRowError : undefined}>
                            {data.value}
                          </Typography></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Box>
                <Box display='flex' className={this.props.classes.item}>
                  <Button onClick={() => this.signUp()}
                    color='primary'
                    disabled={this.state.isSubmitting || !billingStepCompleted || !accountStepCompleted || !planStepCompleted}
                  >Submit</Button>
                </Box>
                <Box display='flex' className={this.props.classes.item}>
                  {this.state.error && (<Message message={this.state.error} variant='error' />)}
                </Box>
              </StepContent>
            </Step>
          </Stepper>
        </Container>
      </div>
    );
  }

  async signUp() {
    if(!this.state.stripe) {
      this.setState({error: 'Our payment processor has not initialized'});
      return;
    }

    this.setState({isSubmitting: true});
    
    var tokenResponse:ReactStripeElements.TokenResponse;
    try {
      tokenResponse = await this.state.stripe.createToken();
    } catch(err) {
      this.setState({error: 'Failed to tokenize billing information',
        isSubmitting: false});
      return;
    };
    
    if(tokenResponse.error) {
      this.setState({error: 'Failed to retrieve billing token: ' + tokenResponse.error.message || tokenResponse.error.type,
        isSubmitting: false});
      return;
    }

    const dispatchAdmin = await ServerAdmin.get().dispatchAdmin();
    try {
      await dispatchAdmin.accountSignupAdmin({accountSignupAdmin: {
          planid: this.state.planId!,
          company: this.state.company!,
          name: this.state.name!,
          email: this.state.email!,
          phone: this.state.phone,
          password: saltHashPassword(this.state.pass!),
          paymentToken: JSON.stringify(tokenResponse.token!),
        }});
    } catch (err) {
      this.setState({
        error: (err.json && err.json.userFacingMessage)
          ? err.json.userFacingMessage
          : 'Failed to signup: ' + JSON.stringify(err),
          isSubmitting: false
      });
      return;
    }
    this.props.history.push('/dashboard');
  }
}

export default connect<ConnectProps,{},Props,ReduxStateAdmin>((state, ownProps) => {
  if(state.plans.plans.status === undefined) {
    ServerAdmin.get().dispatchAdmin().then(d => d.plansGet());
  }
  return { plans: state.plans.plans.plans };
})(withStyles(styles, { withTheme: true })(SignupPage));
