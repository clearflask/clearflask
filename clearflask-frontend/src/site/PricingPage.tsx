import React, { Component } from 'react';
import { Typography, Grid, Button, Container, Card, CardHeader, CardContent, CardActions, Table, TableHead, TableRow, TableCell, TableBody, Paper, FormControlLabel, Switch, FormHelperText } from '@material-ui/core';
import { withStyles, Theme, createStyles, WithStyles } from '@material-ui/core/styles';
import CheckIcon from '@material-ui/icons/CheckRounded';
import HelpPopover from '../common/HelpPopover';
import { useTheme } from '@material-ui/core/styles';
import useMediaQuery from '@material-ui/core/useMediaQuery';
import { History, Location } from 'history';
import { PRE_SELECTED_PLAN_ID } from './SignupPage';
import ServerAdmin, { ReduxStateAdmin } from '../api/serverAdmin';
import { connect } from 'react-redux';
import * as Admin from '../api/admin';
import Loader from '../app/utils/Loader';
import PricingPlan from './PricingPlan';

const styles = (theme:Theme) => createStyles({
  page: {
    margin: theme.spacing(2),
  },
  box: {
    border: '1px solid ' + theme.palette.grey[300],
  },
});

const T = true;
const F = false;

interface Props {
  history:History;
}
interface ConnectProps {
  plans?:Admin.Plan[];
  featuresTable?:Admin.FeaturesTable;
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
        || (this.state.isYearly ? Admin.PlanPricingPeriodEnum.Yearly : Admin.PlanPricingPeriodEnum.Quarterly) === plan.pricing.period)
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
            label={(<FormHelperText component='span'>{this.state.isYearly ? 'Yearly billing' : 'Quarterly billing'}</FormHelperText>)}
          />
        </Container>
        <Container maxWidth='md'>
          <Loader loaded={!!this.props.plans}>
            <Grid container spacing={5} alignItems='stretch'>
              {plans.map((plan, index) => (
                <Grid item key={plan.planid} xs={12} sm={index === 2 ? 12 : 6} md={4}>
                  <PricingPlan
                    plan={plan}
                    actionTitle={plan.pricing ? 'Get started' : 'Contact us'}
                    actionOnClick={() => !plan.pricing
                      ? this.props.history.push('/contact/sales')
                      : this.props.history.push('/signup', {[PRE_SELECTED_PLAN_ID]: plan.planid})}
                  />
                </Grid>
              ))}
            </Grid>
          </Loader>
        </Container>
        <br />
        <br />
        <br />
        <Container maxWidth='md'>
          {this.props.featuresTable && (
            <FeatureList name='Features' planNames={this.props.featuresTable.plans}>
              {this.props.featuresTable.features.map(feature => (
                <FeatureListItem planContents={this.mapFeaturesTableValues(feature.values)} name={feature.feature} />
              ))}
            </FeatureList>
          )}
        </Container>
      </div>
    );
  }

  mapFeaturesTableValues(values:string[]):(string|boolean)[] {
    return values.map(value => {
      switch(value) {
        case 'Yes': return T;
        case 'No': return F;
        default: return value;
      }
    });
  }
}

const FeatureList = withStyles(styles, { withTheme: true })((props:WithStyles<typeof styles, true>&{
  planNames:string[],
  name:string,
  children?:any,
}) => {
  const theme = useTheme();
  const mdUp = useMediaQuery(theme.breakpoints.up('sm'));
  return (
    <div className={props.classes.box}>
      <Table
        size={mdUp ? 'medium' : 'small'}
      >
        <TableHead>
          <TableRow>
            <TableCell key='feature'><Typography variant='h6'>{props.name}</Typography></TableCell>
            {props.planNames.map(planName => (
              <TableCell key={planName}>{planName}</TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {props.children}
        </TableBody>
      </Table>
    </div>
  );
});

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
  return {
    plans: state.plans.plans.plans,
    featuresTable: state.plans.plans.featuresTable,
  };
})(withStyles(styles, { withTheme: true })(PricingPage));
