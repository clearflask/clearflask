import React, { Component } from 'react';
import { Typography, Grid, Button, Container, Card, CardHeader, CardContent, CardActions, Stepper, StepLabel, StepContent, Step, Box, TextField, Link, InputAdornment, IconButton, Table, TableBody, TableRow, TableCell, FormHelperText } from '@material-ui/core';
import { withStyles, Theme, createStyles, WithStyles } from '@material-ui/core/styles';
import CheckIcon from '@material-ui/icons/CheckRounded';
import { Tiers } from './PricingPage';
import { History, Location } from 'history';
import ServerAdmin from '../api/serverAdmin';
import VisibilityIcon from '@material-ui/icons/Visibility';
import VisibilityOffIcon from '@material-ui/icons/VisibilityOff';
import StripeProviderProvider from '../common/stripe/StripeProviderProvider';
import { CardNumberElement, CardExpiryElement, CardCVCElement, ReactStripeElements } from 'react-stripe-elements';
import Loader from '../app/utils/Loader';
import StripeElementWrapper from '../common/stripe/StripeElementWrapper';

export const PRE_SELECTED_PLAN_NAME = 'preSelectedPlanName';
export const PRE_SELECTED_BILLING_PERIOD_IS_YEARLY = 'preSelectedBillingPeriodIsYearly';

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

interface State {
  error?:string;
  step:number;
  isSubmitting?:boolean;
  plan?:string;
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

class SignupPage extends Component<Props&WithStyles<typeof styles, true>, State> {

  constructor(props) {
    super(props);

    var billingIsYearly = true;
    var plan;
    if(props.location && props.location.state && props.location.state[PRE_SELECTED_PLAN_NAME]) {
      plan = props.location.state[PRE_SELECTED_PLAN_NAME];
      billingIsYearly = !!props.location.state[PRE_SELECTED_BILLING_PERIOD_IS_YEARLY];
    }
    this.state = {
      step: 0,
      plan: plan,
      billingIsYearly: billingIsYearly,
    };
  }

  render() {
    const planStepCompleted = !!this.state.plan;
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
                <Grid container spacing={4} alignItems='flex-start' className={this.props.classes.item}>
                  {Tiers.map((tier, index) => (
                    <Grid item key={tier.title} xs={12} sm={index === 2 ? 12 : 6} md={4}>
                      <Card>
                        <CardHeader
                          title={tier.title}
                          titleTypographyProps={{ align: 'center' }}
                          subheaderTypographyProps={{ align: 'center' }}
                        />
                        <CardContent>
                          <Box display='flex' alignItems='baseline' justifyContent='center'>
                            <Typography variant="h4" color="textPrimary">{tier.price(this.state.billingIsYearly)}</Typography>
                            <Typography variant="h6" color="textSecondary">/monthly</Typography>
                          </Box>
                          {tier.description(this.state.billingIsYearly).map(line => (
                            <div style={{display: 'flex', alignItems: 'center'}}>
                              <CheckIcon fontSize='inherit' />
                              &nbsp;
                              <Typography variant="subtitle1" key={line}>
                                {line}
                              </Typography>
                            </div>
                          ))}
                        </CardContent>
                        <CardActions>
                          <Button fullWidth variant={this.state.plan === tier.title ? 'contained' : 'text'} color='primary' onClick={() => {
                            this.setState({
                              plan: tier.title,
                              step: this.state.step + 1,
                            });
                          }}>{this.state.plan === tier.title
                            ? 'continue'
                            : 'select'}</Button>
                        </CardActions>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
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
                        {name: 'Plan', value: this.state.plan ? `${this.state.plan} (${this.state.billingIsYearly ? 'Yearly' : 'Monthly'})` : 'No plan selected', error: !this.state.plan},
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
                  {this.state.error && (<FormHelperText error>{this.state.error}</FormHelperText>)}
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
    
    var token:ReactStripeElements.TokenResponse;
    try {
      token = await this.state.stripe.createToken();
    } catch(err) {
      this.setState({error: 'Failed to tokenize billing information'});
      return;
    };
    
    if(token.error) {
      this.setState({error: 'Failed to retrieve billing token: ' + token.error.message || token.error.type});
      return;
    }

    const dispatchAdmin = await ServerAdmin.get().dispatchAdmin();
    try {
      await dispatchAdmin.accountSignupAdmin({signup: {
          plan: this.state.plan!,
          company: this.state.company!,
          name: this.state.name!,
          email: this.state.email!,
          phone: this.state.phone,
          paymentToken: 'TODO',
        }});
    } catch (err) {
      this.setState({
        step: this.state.step - 1,
        error: (err.json && err.json.userFacingMessage)
          ? err.json.userFacingMessage
          : JSON.stringify(err),
      });
      return;
    }
    this.props.history.push('/dashboard');
  }
}

export default withStyles(styles, { withTheme: true })(SignupPage);
