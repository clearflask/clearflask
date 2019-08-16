import React, { Component } from 'react';
import { Typography, Grid, Button, Container, Card, CardHeader, CardContent, CardActions, Table, TableHead, TableRow, TableCell, TableBody, Paper, FormControlLabel, Switch, FormHelperText } from '@material-ui/core';
import { withStyles, Theme, createStyles, WithStyles } from '@material-ui/core/styles';
import CheckIcon from '@material-ui/icons/CheckRounded';
import HelpPopover from '../common/HelpPopover';
import { useTheme } from '@material-ui/core/styles';
import useMediaQuery from '@material-ui/core/useMediaQuery';
import { History, Location } from 'history';
import { PRE_SELECTED_PLAN_NAME, PRE_SELECTED_BILLING_PERIOD_IS_YEARLY } from './SignupPage';
import ServerAdmin, { ReduxStateAdmin } from '../api/serverAdmin';
import { connect } from 'react-redux';
import * as Admin from '../api/admin';
import Loader from '../app/utils/Loader';

const styles = (theme:Theme) => createStyles({
  page: {
    margin: theme.spacing(2),
  },
  option: {
    display: 'inline-block',
    margin: theme.spacing(6),
    padding: theme.spacing(6),
  },
  cardHeader: {
    // backgroundColor: theme.palette.grey[200],
  },
  cardPricing: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'baseline',
    marginBottom: theme.spacing(2),
  },
});

const T = true;
const F = false;

interface Props {
  history:History;
}
interface ConnectProps {
  plans?:Admin.Plan[];
}
interface State {
  isYearly:boolean;
}

class PricingPage extends Component<Props&ConnectProps&WithStyles<typeof styles, true>, State> {
  state:State = {
    isYearly: true
  };
  render() {
    const plans = this.props.plans ? this.props.plans
      .filter(plan => !plan.pricing
        || (this.state.isYearly ? Admin.PlanPricingPeriodEnum.Yearly : Admin.PlanPricingPeriodEnum.Monthly) === plan.pricing.period)
      : [];

    return (
      <div className={this.props.classes.page}>
        <Container maxWidth='md'>
          <Typography component="h1" variant="h2" color="textPrimary">Plans and pricing</Typography>
          <Typography component="h2" variant="h4" color="textSecondary">All plans include unlimited number of users.</Typography>
          <FormControlLabel
            control={(
              <Switch
                checked={this.state.isYearly}
                onChange={(e, checked) => this.setState({isYearly: !this.state.isYearly})}
                color='default'
              />
            )}
            label={(<FormHelperText component='span'>{this.state.isYearly ? 'Yearly billing' : 'Monthly billing'}</FormHelperText>)}
          />
        </Container>
        <Container maxWidth='md'>
          <Loader loaded={!!this.props.plans}>
            <Grid container spacing={5} alignItems='stretch'>
              {plans.map((plan, index) => (
                <Grid item key={plan.planid} xs={12} sm={index === 2 ? 12 : 6} md={4}>
                  <Card raised>
                    <CardHeader
                      title={plan.title}
                      titleTypographyProps={{ align: 'center' }}
                      subheaderTypographyProps={{ align: 'center' }}
                      className={this.props.classes.cardHeader}
                    />
                    <CardContent>
                      {plan.pricing ? (
                        <React.Fragment>
                          <div className={this.props.classes.cardPricing}>
                            <Typography component='h2' variant='h6' color='textSecondary' style={{alignSelf: 'end'}}>{'$'}</Typography>
                            <Typography component='h2' variant='h3'>{plan.pricing.price}</Typography>
                            <Typography component='h2' variant='h6' color='textSecondary'>{'/ month'}</Typography>
                          </div>
                          <div className={this.props.classes.cardPricing}>
                            <Typography component='h3'>{
                              plan.pricing.period === Admin.PlanPricingPeriodEnum.Yearly
                                ? ('$' + (plan.pricing.price * 12) + ' billed yearly')
                                : 'billed monthly'}</Typography>
                          </div>
                        </React.Fragment>
                        ) : (
                          <div className={this.props.classes.cardPricing}>
                           <Typography component="h2" variant="h4" color="textPrimary">Contact us</Typography>
                          </div>
                        )}
                      {plan.perks.map(perk => (
                        <div key={perk.desc} style={{display: 'flex', alignItems: 'center'}}>
                          <CheckIcon fontSize='inherit' />
                          &nbsp;
                          <Typography variant="subtitle1">{perk.desc}</Typography>
                        </div>
                      ))}
                    </CardContent>
                    <CardActions>
                      <Button fullWidth variant='text' color="primary"
                        onClick={() => !plan.pricing
                          ? this.props.history.push('/contact')
                          : this.props.history.push('/signup', {
                            [PRE_SELECTED_PLAN_NAME]: plan.title,
                            [PRE_SELECTED_BILLING_PERIOD_IS_YEARLY]: this.state.isYearly,})
                      }>
                        {plan.pricing ? 'Get started' : 'Contact us'}
                      </Button>
                    </CardActions>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Loader>
        </Container>
        <br />
        <br />
        <br />
        <Container maxWidth='md'>
          <FeatureList name='Features' planNames={['Starter', 'Pro', 'Whatever']}>
            <FeatureListItem planContents={['1','Unlimited','Unlimited']} name='Projects' />
            <FeatureListItem planContents={['Unlimited','Unlimited','Unlimited']} name='Active users' />
            <FeatureListItem planContents={['Unlimited','Unlimited','Unlimited']} name='User submitted content' />
            <FeatureListItem planContents={[T,T,T]} name='Customizable pages: Ideas, Roadmap, FAQ, Knowledge base, etc...' />
            <FeatureListItem planContents={[T,T,T]} name='Voting and Emoji expressions' />
            <FeatureListItem planContents={[F,T,T]} name='Credit system / Crowd-funding' />
            <FeatureListItem planContents={[F,T,T]} name='Analytics' />
            <FeatureListItem planContents={[F,F,T]} name='Multi agent access' />
            <FeatureListItem planContents={[F,F,T]} name='Integrations' />
            <FeatureListItem planContents={[F,F,T]} name='API access' />
            <FeatureListItem planContents={[F,F,T]} name='Whitelabel' />
          </FeatureList>
        </Container>
      </div>
    );
  }
}

const FeatureList = (props:{
  planNames:string[],
  name:string,
  children?:any,
}) => {
  const theme = useTheme();
  const mdUp = useMediaQuery(theme.breakpoints.up('sm'));
  return (
    <Paper elevation={8}>
      <Table
        size={mdUp ? 'medium' : 'small'}
      >
        <TableHead>
          <TableRow>
            <TableCell key='feature'><Typography variant='h6'>{props.name}</Typography></TableCell>
            <TableCell key='plan1'>Starter</TableCell>
            <TableCell key='plan2'>Full</TableCell>
            <TableCell key='plan3'>Enterprise</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {props.children}
        </TableBody>
      </Table>
    </Paper>
  );
}

const FeatureListItem = (props:{
  planContents:(boolean|React.ReactNode|string)[],
  name:string,
  helpText?:string
}) => {
  return (
    <TableRow key='name'>
      <TableCell key='feature'>
        {props.name}
        {props.helpText && (<HelpPopover description={props.helpText} />)}
      </TableCell>
      {props.planContents.map(content => (
        <TableCell>
          {content === T
            ? (<CheckIcon fontSize='inherit' />)
            : content}
        </TableCell>
      ))}
    </TableRow>
  );
}

export default connect<ConnectProps,{},Props,ReduxStateAdmin>((state, ownProps) => {
  if(state.plans.plans.status === undefined) {
    ServerAdmin.get().dispatchAdmin().then(d => d.plansGet());
  }
  return { plans: state.plans.plans.plans };
})(withStyles(styles, { withTheme: true })(PricingPage));
