import React, { Component } from 'react';
import { Typography, Grid, Button, Container, Card, CardHeader, CardContent, CardActions, Stepper, StepLabel, StepContent, Step, Box, TextField } from '@material-ui/core';
import { withStyles, Theme, createStyles, WithStyles } from '@material-ui/core/styles';
import CheckIcon from '@material-ui/icons/CheckRounded';
import { Tiers } from './PricingPage';
import { History, Location } from 'history';
import ServerAdmin from '../api/serverAdmin';

export const PRE_SELECTED_PLAN_NAME = 'preSelectedPlanName';

const styles = (theme:Theme) => createStyles({
  page: {
    margin: theme.spacing(2),
  },
  item: {
    margin: theme.spacing(2),
  },
});

interface Props {
  history:History;
  location:Location;
}

interface State {
  error?:string;
  step:number;
  plan?:string;
  company?:string;
  name?:string;
  email?:string;
  phone?:string;
}

class SignupPage extends Component<Props&WithStyles<typeof styles, true>, State> {

  constructor(props) {
    super(props);

    const preSelectedPlan = (props.location && props.location.state && props.location.state[PRE_SELECTED_PLAN_NAME])
      ? props.location.state[PRE_SELECTED_PLAN_NAME]
      : undefined;
    this.state = {
      step: 0,
      plan: preSelectedPlan,
    };
  }

  render() {
    const prevButton = (
      <Button
        onClick={() => this.setState({step: this.state.step - 1})}
      >Back</Button>
    );
    const nextButton = (
      <Button
        color='primary'
        onClick={() => this.setState({step: this.state.step + 1})}
      >Next</Button>
    );

    const planStepCompleted = !!this.state.plan;
    const accountStepCompleted = !!this.state.company && !!this.state.name && !!this.state.email;
    const billingStepCompleted = true;

    return (
      <div className={this.props.classes.page}>
        <Container maxWidth='md'>
          <Stepper activeStep={this.state.step} orientation='vertical'>
            <Step key='plan' completed={planStepCompleted}>
              <StepLabel>{this.state.plan === undefined
                  ? 'Select a plan'
                  : `Selected ${this.state.plan} plan`
              }</StepLabel>
              <StepContent>
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
                            <Typography variant="h4" color="textPrimary">{tier.price}</Typography>
                            <Typography variant="h6" color="textSecondary">{tier.priceUnit}</Typography>
                          </Box>
                          {tier.description.map(line => (
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
              <StepLabel>Account</StepLabel>
              <StepContent>
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
                    id='email'
                    label='Email'
                    required
                    value={this.state.email || ''}
                    onChange={e => this.setState({ email: e.target.value })}
                  />
                  <TextField
                    className={this.props.classes.item}
                    id='phone'
                    label='Phone'
                    value={this.state.phone || ''}
                    onChange={e => this.setState({ phone: e.target.value })}
                  />
                </Box>
                <Box display='flex' className={this.props.classes.item}>
                  <Button onClick={() => this.setState({step: this.state.step - 1})}>Back</Button>
                  <Button onClick={() => this.setState({step: this.state.step + 1})} color='primary' disabled={!accountStepCompleted}>Next</Button>
                </Box>
              </StepContent>
            </Step>
            <Step key='billing' completed={billingStepCompleted}>
              <StepLabel>Billing</StepLabel>
              <StepContent>
                <Typography>Enter your payment information</Typography>
                <Box display='flex' flexDirection='column' alignItems='flex-start'>
                  <TextField
                    className={this.props.classes.item}
                    id='payment'
                    label='TODO Payment'
                    // value={this.state.payment || ''}
                    // onChange={e => this.setState({ phone: e.target.value })}
                  />
                </Box>
                <Box display='flex' className={this.props.classes.item}>
                  <Button onClick={() => this.setState({step: this.state.step - 1})}>Back</Button>
                  <Button onClick={() => this.signUp()} color='primary' disabled={!billingStepCompleted}>Submit</Button>
                </Box>
              </StepContent>
            </Step>
          </Stepper>
        </Container>
      </div>
    );
  }

  signUp() {
    ServerAdmin.get().dispatchAdmin().then(d => {
      d.accountSignupAdmin({signup: {
        plan: this.state.plan!,
        company: this.state.company!,
        name: this.state.name!,
        email: this.state.email!,
        phone: this.state.phone,
        paymentToken: 'TODO',
      }})
      .then(() => {
        this.props.history.push('/dashboard');
      })
      .catch(err => {
        this.setState({
          step: this.state.step - 1,
          error: (err.json && err.json.userFacingMessage)
            ? err.json.userFacingMessage
            : JSON.stringify(err),
        })
      });
    });
  }
}

export default withStyles(styles, { withTheme: true })(SignupPage);
