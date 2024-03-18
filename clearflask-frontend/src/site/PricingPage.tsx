// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
/** Intentional comment to prevent licence-maven-plugin from deleting the below line */
/// <reference path="../@types/transform-media-imports.d.ts"/>
import { Box, Grid, Tab, Table, TableBody, TableCell, TableHead, TableRow, Tabs, Typography } from '@material-ui/core';
import { createStyles, Theme, useTheme, WithStyles, withStyles } from '@material-ui/core/styles';
import useMediaQuery from '@material-ui/core/useMediaQuery';
import CheckIcon from '@material-ui/icons/CheckRounded';
import GithubIcon from '@material-ui/icons/GitHub';
import classNames from 'classnames';
import React, { Component } from 'react';
import ReactGA from 'react-ga';
import ReactGA4 from 'react-ga4';
import { WithTranslation, withTranslation } from 'react-i18next';
import { connect } from 'react-redux';
import { RouteComponentProps, withRouter } from 'react-router';
import PricingImg from '../../public/img/landing/pricing.svg';
import * as Admin from '../api/admin';
import ServerAdmin, { ReduxStateAdmin } from '../api/serverAdmin';
import Loader from '../app/utils/Loader';
import HelpPopper from '../common/HelpPopper';
import ImgIso from '../common/ImgIso';
import { isProd } from '../common/util/detectEnv';
import { trackingBlock } from '../common/util/trackingDelay';
import { PRE_SELECTED_BASE_PLAN_ID, SIGNUP_PROD_ENABLED } from './AccountEnterPage';
import PricingPlan from './PricingPlan';
import PricingSlider from './PricingSlider';
import Background from './landing/Background';
import { SelfhostServicePlans } from '../common/config/settings/UpgradeWrapper';

/** If changed, also update PlanStore.java */
export const StopTrialAfterActiveUsersReaches = 10;
export const EstimatedPercUsersBecomeTracked = 0.05;
export const FlatYearlyStartingPrice = 1000;
export const AllowUserChoosePricingForPlans = new Set(['sponsor-monthly']);

const Faq: Array<{ heading: string, body: string | React.ReactNode }> = [
  {
    heading: 'Are you really Open-Source?',
    body: (
      <>
        <p>
          Our entire stack is open sourced under the Apache-2.0 license and free to use. The commercial cloud
          hosting and the self-hosted installations are from the same repository.
        </p>
      </>
    ),
  },
  {
    heading: 'Why is there a license for self-hosting?',
    body: (
      <>
        <p>
          The license for self-hosted installations allows us to fund continued development of this project.
          Although the license unlocks extra functionality, this functionality is also open-source.
          If you feel adventurous, you can remove the licensing restrictions and build ClearFlask yourself as we are
          open-source after all.
        </p>
      </>
    ),
  },
  {
    heading: 'How does the Post limit work?',
    body: (
      <>
        <p>
          A customer feedback, roadmap task or an announcement counts towards your Post Limit. Once you reach your limit,
          your account will be temporarily limited until you delete older posts or upgrade your plan.
        </p>
      </>
    ),
  },
  {
    heading: 'Can I import/export data?',
    body: (
      <>
        <p>
          Yes, we provide both import and export functionality via CSV format. You can switch between our cloud-hosting
          to a self-hosting installation.
        </p>
      </>
    ),
  },
  {
    heading: 'What is a teammate?',
    body: (
      <>
        <p>
          A teammate is a user with access to the ClearFlask admin dashboard. They can manage feedback, users,
          and settings. You count as one teammate and any additional teammates may cost extra depending on the
          plan.
        </p>
      </>
    ),
  },
  {
    heading: 'Can I add a teammate later?',
    body: (
      <>
        <p>
          For recurring plans, you will be charged based on the number of teammates you had during the billing
          period.
          For lifetime plans, you can purchase additional teammate slots at any time.
        </p>
      </>
    ),
  },
];

const styles = (theme: Theme) => createStyles({
  section: {
    maxWidth: theme.breakpoints.values.md,
    margin: 'auto',
    padding: theme.spacing(2, 6),
    [theme.breakpoints.down('sm')]: {
      padding: theme.spacing(1),
    },
  },
  sectionPlans: {
    maxWidth: '100%',
    width: '100%',
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  subSectionPlans: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'center',
    '& > *': {
      margin: theme.spacing(4),
      minWidth: 250,
    },
  },
  pricingSlider: {
    height: 250,
    maxWidth: 250,
    margin: 'auto',
  },
  header: {
    maxWidth: '100vw',
    display: 'flex',
    [theme.breakpoints.down('sm')]: {
      flexDirection: 'column-reverse',
      alignItems: 'center',
    },
    alignItems: 'flex-end',
  },
  box: {
    border: '1px solid ' + theme.palette.divider,
    borderBottom: 'none',
  },
  billingSelect: {
    margin: theme.spacing(3),
  },
  plansToggle: {
    display: 'flex',
    justifyContent: 'center',
  },
  plansToggleButton: {
    padding: theme.spacing(0, 2),
  },
  image: {
    maxWidth: theme.breakpoints.values.md,
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
  tab: {
    textTransform: 'initial',
  },
});

interface Props {
}

interface ConnectProps {
  callOnMount?: () => void,
  plans?: Admin.Plan[];
  featuresTable?: Admin.FeaturesTable;
  featuresTableSelfhost?: Admin.FeaturesTable;
}

interface State {
  highlightedBasePlanid?: string;
  tab: 'selfhost' | 'cloud',
}

class PricingPage extends Component<Props & ConnectProps & WithTranslation<'site'> & RouteComponentProps & WithStyles<typeof styles, true>, State> {
  state: State = {
    tab: 'cloud',
  };

  constructor(props) {
    super(props);

    props.callOnMount?.();
  }

  render() {

    // Community self-hosted plan
    const communityPlan: Admin.Plan = {
      basePlanId: 'selfhost-free',
      title: 'Free & Open-source',
      pricing: { basePrice: 0, baseMau: 0, unitPrice: 0, unitMau: 0, period: Admin.PlanPricingPeriodEnum.Monthly },
      perks: [
        { desc: 'Open-source Apache 2.0' },
        { desc: 'Deploy via Docker' },
      ],
    };
    const communityPlanCmpt = (
      <PricingPlan
        key={communityPlan.basePlanId}
        plan={communityPlan}
        selected={this.state.highlightedBasePlanid === communityPlan.basePlanId}
        actionIcon={(<GithubIcon />)}
        actionTitle="Deploy"
        remark="Community supported"
        actionOnClick={() => {
          trackingBlock(() => {
            [ReactGA4, ReactGA].forEach(ga =>
              ga.event({
                category: 'pricing',
                action: 'click-plan',
                label: communityPlan.basePlanId,
              }),
            );
          });
        }}
        actionToExt="https://github.com/clearflask/clearflask#self-hosting"
      />
    );

    // Extra features talk to us plan
    // const talkPlan: Admin.Plan = {
    //   basePlanId: 'talk',
    //   title: 'Enterprise',
    //   perks: [
    //     { desc: 'Support & SLA' },
    //     { desc: 'Whitelabel' },
    //     { desc: 'Search engine' },
    //   ],
    // };
    // const talkPlanCmpt = (
    //   <PricingPlan
    //     key={talkPlan.basePlanId}
    //     customPrice='200+'
    //     plan={talkPlan}
    //     selected={this.state.highlightedBasePlanid === talkPlan.basePlanId}
    //     overrideMauTerms={[
    //       'Self-hosted',
    //       'Own your data',
    //     ]}
    //     actionTitle='Talk to us'
    //     actionTo='/contact/sales'
    //     actionOnClick={() => {
    //       trackingBlock(() => {
    //         [ReactGA4, ReactGA].forEach(ga =>
    //           ga.event({
    //             category: 'pricing',
    //             action: 'click-plan',
    //             label: talkPlan.basePlanId,
    //           })
    //         );
    //       });
    //     }}
    //   />
    // );

    const plansSelfHost: JSX.Element[] = [];
    const plansCloud: JSX.Element[] = [];
    for (const plan of this.props.plans || []) {
      const pricingPlan = AllowUserChoosePricingForPlans.has(plan.basePlanId) ? (
        <PricingSlider
          key="pricingSlider"
          className={this.props.classes.pricingSlider}
          plan={plan}
        />
      ) : (
        <PricingPlan
          key={plan.basePlanId}
          customPrice={plan.basePlanId === 'flat-yearly' ? FlatYearlyStartingPrice + '+' : undefined}
          overrideMauTerms={plan.basePlanId === 'starter-unlimited' ? [
            'Free forever',
            'Upgrade anytime',
          ] : undefined}
          plan={plan}
          selected={this.state.highlightedBasePlanid === plan.basePlanId}
            actionTitle={SelfhostServicePlans.includes(plan.basePlanId) ? 'Buy license' : 'Get started'}
            remark={SelfhostServicePlans.includes(plan.basePlanId)
              ? 'Automatic renewal'
            : (plan.pricing
              ? this.props.t('free-14-day-trial')
              : this.props.t('free-forever'))}
          actionOnClick={() => {
            trackingBlock(() => {
              [ReactGA4, ReactGA].forEach(ga =>
                ga.event({
                  category: 'pricing',
                  action: 'click-plan',
                  label: plan.basePlanId,
                }),
              );
            });
          }}
          actionTo={plan.basePlanId !== 'flat-yearly' && (SIGNUP_PROD_ENABLED || !isProd())
            ? {
              pathname: '/signup',
              state: { [PRE_SELECTED_BASE_PLAN_ID]: plan.basePlanId },
            }
            : '/contact/sales'}
        />
      );
      if (SelfhostServicePlans.includes(plan.basePlanId)) {
        plansSelfHost.push(pricingPlan);
      } else {
        plansCloud.push(pricingPlan);
      }
    }

    const plansGroupedSelfhost = this.groupPlans([
      communityPlanCmpt,
      ...plansSelfHost,
    ])
    const plansGroupedCloud = this.groupPlans([
      ...plansCloud,
      // talkPlanCmpt,
    ]);

    const featuresTable = this.state.tab === 'cloud' ? this.props.featuresTable : this.props.featuresTableSelfhost;

    return (
      <>
        <Background svg={{
          d: 'M 0 49.98 C 0 120 16 137 94 136 C 361 122 252 -31 500 49.98 L 500 0 L 0 0 Z',
          viewBox: '0 0 500 150',
          flexible: true,
        }} height={500} align="top">
          <div className={this.props.classes.section}>
            <div className={this.props.classes.header}>
              <div>
                <Typography component="h2" variant="h2"
                  color="textPrimary">{this.props.t('pricing')}</Typography>
              </div>
              <ImgIso
                alt=""
                className={this.props.classes.image}
                src={PricingImg.pathname}
                aspectRatio={PricingImg.aspectRatio}
                maxWidth={PricingImg.width}
                maxHeight={PricingImg.height}
              />
            </div>
          </div>
          <br />
          <br />
          <Loader loaded={!!this.props.plans} skipFade>
            <Tabs
              centered
              variant='standard'
              scrollButtons='off'
              value={this.state.tab}
              onChange={(e, newTab) => this.setState({ tab: newTab as any })}
            >
              <Tab value='selfhost' label='Self-hosted' className={this.props.classes.tab} />
              <Tab value='cloud' label='Cloud' className={this.props.classes.tab} />
            </Tabs>
            <div className={classNames(this.props.classes.section, this.props.classes.sectionPlans)}>
              {this.state.tab === 'selfhost' && plansGroupedSelfhost}
              {this.state.tab === 'cloud' && plansGroupedCloud}
            </div>
          </Loader>
          {/* <LandingCustomers /> */}
          <br />
          <br />
          {featuresTable && (
            <div className={this.props.classes.section}>
              <FeatureList name="Features" planNames={featuresTable.plans}>
                {featuresTable.features.map((feature, index) => (
                  <FeatureListItem
                    key={feature.feature}
                    planContents={this.mapFeaturesTableValues(feature.values)}
                    name={feature.feature}
                    helpText={feature.terms}
                  />
                ))}
              </FeatureList>
              {featuresTable.extraTerms && (
                <Box display="flex" justifyContent="center">
                  <Typography variant="caption"
                    component="div">{featuresTable.extraTerms}</Typography>
                </Box>
              )}
            </div>
          )}
          <br />
          <br />
          <br />
          <div className={this.props.classes.section}>
            <Grid container spacing={5} alignItems="stretch" justify="center">
              {Faq.map((faqItem, index) => (
                <Grid key={index} item xs={12} sm={6}>
                  <div className={this.props.classes.faqItem}>
                    <Typography component="div" variant="h5">
                      {faqItem.heading}
                    </Typography>
                    <br />
                    <Typography component="div" variant="body1" color="textSecondary">
                      {faqItem.body}
                    </Typography>
                  </div>
                </Grid>
              ))}
            </Grid>
          </div>
        </Background>
      </>
    );
  }

  mapFeaturesTableValues(values: string[]): (string | boolean)[] {
    return values.map(value => {
      switch (value) {
        case 'Yes':
          return true;
        case 'No':
          return false;
        default:
          return value;
      }
    });
  }

  groupPlans(plans: JSX.Element[]): JSX.Element[] {
    const plansGrouped: JSX.Element[] = [];
    for (var i = 0; i < plans.length; i += 2) {
      const left = plans[i];
      const right = plans[i + 1];
      plansGrouped.push((
        <div key={`${left?.key}-${right?.key}`} className={classNames(this.props.classes.subSectionPlans)}>
          {left}
          {right}
        </div>
      ));
    }
    return plansGrouped;
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
            <TableCell key="feature"><Typography variant="h6">{props.name}</Typography></TableCell>
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
    <TableRow key="name">
      <TableCell key="feature">
        {props.name}
        {props.helpText && (
          <>
            &nbsp;
            <HelpPopper description={props.helpText} />
          </>
        )}
      </TableCell>
      {props.planContents.map((content, index) => (
        <TableCell key={index}>
          {content === true
            ? (<CheckIcon fontSize="inherit" />)
            : content}
        </TableCell>
      ))}
    </TableRow>
  );
};

export default connect<ConnectProps, {}, Props, ReduxStateAdmin>((state, ownProps) => {
  const newProps: ConnectProps = {
    plans: state.plans.plans.plans,
    featuresTable: state.plans.plans.featuresTable,
    featuresTableSelfhost: state.plans.plans.featuresTableSelfhost,
  };
  if (state.plans.plans.status === undefined) {
    newProps.callOnMount = () => {
      ServerAdmin.get().dispatchAdmin({ ssr: true }).then(d => d.plansGet());
    };
  }
  return newProps;
})(withStyles(styles, { withTheme: true })(withRouter(withTranslation('site', { withRef: true })(PricingPage))));
