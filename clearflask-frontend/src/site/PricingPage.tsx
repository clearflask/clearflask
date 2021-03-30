/// <reference path="../@types/transform-media-imports.d.ts"/>
import { Box, Container, Grid, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@material-ui/core';
import { createStyles, Theme, useTheme, withStyles, WithStyles } from '@material-ui/core/styles';
import useMediaQuery from '@material-ui/core/useMediaQuery';
import CheckIcon from '@material-ui/icons/CheckRounded';
import React, { Component } from 'react';
import ReactGA from 'react-ga';
import { connect } from 'react-redux';
import { RouteComponentProps, withRouter } from 'react-router';
import PricingImg from '../../public/img/landing/pricing.svg';
import * as Admin from '../api/admin';
import ServerAdmin, { ReduxStateAdmin } from '../api/serverAdmin';
import Loader from '../app/utils/Loader';
import HelpPopper from '../common/HelpPopper';
import ImgIso from '../common/ImgIso';
import { isProd, isTracking } from '../common/util/detectEnv';
import PricingPlan from './PricingPlan';
import PricingSlider from './PricingSlider';
import { PRE_SELECTED_BASE_PLAN_ID, SIGNUP_PROD_ENABLED } from './TrialSignupPage';

export const TrialInfoText = () => (
  <div>
    <div>Free 14-day trial</div>
  </div>
);

/** If changed, also update PlanStore.java */
export const StopTrialAfterActiveUsersReaches = 10;
export const EstimatedPercUsersBecomeTracked = 0.05;

const Faq: Array<{ heading: string, body: string | React.ReactNode }> = [
  {
    heading: 'What are tracked users?',
    body: (
      <React.Fragment>
        <p>
          A user signed up on ClearFlask becomes tracked when they provide you with feedback by posting, commenting or voting.
          Typically about {EstimatedPercUsersBecomeTracked * 100}% of your total users will become tracked.
        </p>
      </React.Fragment>
    ),
  },
  {
    heading: 'Can I import/export data?',
    body: (
      <React.Fragment>
        <p>
          Yes, you can switch between providers whenever you need to. We provide both import and export functionality via CSV format. Contact us for help.
        </p>
      </React.Fragment>
    ),
  },
];

const styles = (theme: Theme) => createStyles({
  page: {
    margin: theme.spacing(6),
    [theme.breakpoints.down('xs')]: {
      margin: theme.spacing(1),
    },
  },
  header: {
    display: 'flex',
    [theme.breakpoints.down('sm')]: {
      flexWrap: 'wrap-reverse',
    },
    alignItems: 'flex-end',
  },
  box: {
    border: '1px solid ' + theme.palette.grey[300],
    borderBottom: 'none',
  },
  billingSelect: {
    margin: theme.spacing(3),
  },
  image: {
    padding: theme.spacing(0, 8),
    [theme.breakpoints.down('sm')]: {
      padding: theme.spacing(2),
      maxWidth: 300,
    },
    width: '100%',
  },
  faqItem: {
    margin: theme.spacing(4),
  },
});

interface Props {
}
interface ConnectProps {
  callOnMount?: () => void,
  plans?: Admin.Plan[];
  featuresTable?: Admin.FeaturesTable;
}
interface State {
  highlightedBasePlanid?: string;
  callForQuote?: boolean;
}
class PricingPage extends Component<Props & ConnectProps & RouteComponentProps & WithStyles<typeof styles, true>, State> {
  state: State = {};

  constructor(props) {
    super(props);

    props.callOnMount?.();
  }

  render() {
    return (
      <div className={this.props.classes.page}>
        <Container maxWidth='md'>
          <div className={this.props.classes.header}>
            <div>
              <Typography component="h2" variant="h2" color="textPrimary">Pricing</Typography>
              <Typography component="div" variant="h6" color="textSecondary">Only pay for users that provide value.</Typography>
            </div>
            <Container maxWidth='md'>
              <ImgIso
                alt=''
                className={this.props.classes.image}
                src={PricingImg.pathname}
                aspectRatio={PricingImg.aspectRatio}
                maxWidth={PricingImg.width}
                maxHeight={PricingImg.height}
              />
            </Container>
          </div>
        </Container>
        <br />
        <br />
        <br />
        <Container maxWidth='md'>
          <Loader loaded={!!this.props.plans} skipFade>
            <Grid container spacing={5} alignItems='stretch' justify='center'>
              {this.props.plans && this.props.plans.map((plan, index) => (
                <Grid item key={plan.basePlanId} xs={12} sm={6} md={4}>
                  <PricingPlan
                    customPrice='1000+'
                    plan={plan}
                    selected={this.state.highlightedBasePlanid === plan.basePlanId
                      || this.state.callForQuote && !plan.pricing}
                    actionTitle={plan.pricing && (SIGNUP_PROD_ENABLED || !isProd()) ? 'Get started' : 'Talk to us'}
                    remark={plan.pricing ? (<TrialInfoText />) : 'Let us help you'}
                    actionOnClick={() => {
                      if (isTracking()) {
                        ReactGA.event({
                          category: 'pricing',
                          action: 'click-plan',
                          label: plan.basePlanId,
                        });
                      }
                    }}
                    actionTo={plan.pricing && (SIGNUP_PROD_ENABLED || !isProd())
                      ? {
                        pathname: '/signup',
                        state: { [PRE_SELECTED_BASE_PLAN_ID]: plan.basePlanId },
                      }
                      : '/contact/sales'}
                  />
                </Grid>
              ))}
              <Grid item key='slider' xs={12} sm={6} md={4}>
                <PricingSlider
                  plans={this.props.plans || []}
                  onSelectedPlanChange={(basePlanId, callForQuote) => this.setState({
                    highlightedBasePlanid: callForQuote ? undefined : basePlanId,
                    callForQuote,
                  })}
                />
              </Grid>
            </Grid>
          </Loader>
        </Container>
        <br />
        <br />
        <br />
        {this.props.featuresTable && (
          <Container maxWidth='md'>
            <FeatureList name='Features' planNames={this.props.featuresTable.plans}>
              {this.props.featuresTable.features.map((feature, index) => (
                <FeatureListItem
                  key={feature.feature}
                  planContents={this.mapFeaturesTableValues(feature.values)}
                  name={feature.feature}
                  helpText={feature.terms}
                />
              ))}
            </FeatureList>
            {this.props.featuresTable.extraTerms && (
              <Box display='flex' justifyContent='center'>
                <Typography variant='caption' component='div'>{this.props.featuresTable.extraTerms}</Typography>
              </Box>
            )}
          </Container>
        )}
        <br />
        <br />
        <br />
        <Container maxWidth='md'>
          <Grid container spacing={5} alignItems='stretch' justify='center'>
            {Faq.map((faqItem, index) => (
              <Grid key={index} item xs={12} sm={6}>
                <div className={this.props.classes.faqItem}>
                  <Typography component='div' variant='h5'>
                    {faqItem.heading}
                  </Typography>
                  <br />
                  <Typography component='div' variant='body1' color='textSecondary'>
                    {faqItem.body}
                  </Typography>
                </div>
              </Grid>
            ))}
          </Grid>
        </Container>
      </div>
    );
  }

  mapFeaturesTableValues(values: string[]): (string | boolean)[] {
    return values.map(value => {
      switch (value) {
        case 'Yes': return true;
        case 'No': return false;
        default: return value;
      }
    });
  }
}

const FeatureList = withStyles(styles, { withTheme: true })((props: WithStyles<typeof styles, true> & {
  planNames: string[],
  name: string,
  children?: any,
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

const FeatureListItem = (props: {
  planContents: (boolean | React.ReactNode | string)[],
  name: string,
  helpText?: string
}) => {
  return (
    <TableRow key='name'>
      <TableCell key='feature'>
        {props.name}
        {props.helpText && (
          <React.Fragment>
            &nbsp;
            <HelpPopper description={props.helpText} />
          </React.Fragment>
        )}
      </TableCell>
      {props.planContents.map((content, index) => (
        <TableCell key={index}>
          {content === true
            ? (<CheckIcon fontSize='inherit' />)
            : content}
        </TableCell>
      ))}
    </TableRow>
  );
}

export default connect<ConnectProps, {}, Props, ReduxStateAdmin>((state, ownProps) => {
  const newProps: ConnectProps = {
    plans: state.plans.plans.plans,
    featuresTable: state.plans.plans.featuresTable,
  };
  if (state.plans.plans.status === undefined) {
    newProps.callOnMount = () => {
      ServerAdmin.get().dispatchAdmin({ ssr: true }).then(d => d.plansGet());
    };
  }
  return newProps;
})(withStyles(styles, { withTheme: true })(withRouter(PricingPage)));
