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

TODO TODO TODO 

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

interface Props {
  history:History;
}
interface ConnectProps {
  plans?:Admin.Plan[];
}
interface State {
  isYearly:boolean;
}

class PricingPlan extends Component<Props&ConnectProps&WithStyles<typeof styles, true>, State> {
  state:State = {
    isYearly: true
  };
  render() {
    const plans = this.props.plans ? this.props.plans
      .filter(plan => !plan.pricing
        || (this.state.isYearly ? Admin.PlanPricingPeriodEnum.Yearly : Admin.PlanPricingPeriodEnum.Monthly) === plan.pricing.period)
      : [];

    return (
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
    );
  }
}

export default withStyles(styles, { withTheme: true })(PricingPlan);
