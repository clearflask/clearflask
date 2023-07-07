// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import { Button, makeStyles } from '@material-ui/core';
import { Theme, WithStyles, createStyles, withStyles } from '@material-ui/core/styles';
import { Alert } from '@material-ui/lab';
import classNames from 'classnames';
import React, { Component, useState } from 'react';
import { connect } from 'react-redux';
import { Link } from 'react-router-dom';
import * as Admin from '../../../api/admin';
import { ReduxStateAdmin } from '../../../api/serverAdmin';
import { AddonPrivateProjects, AddonWhitelabel } from '../../../site/dashboard/BillingPage';
import { Path, pathEquals } from '../configEditor';

/** If changed, also change in PlanStore.java */
export const TeammatePlanId = 'teammate-unlimited';

/** If changed, also change in KillBillPlanStore.java */
const UnrestrictedProperties: Path[] = [
];
/** If changed, also change in KillBillPlanStore.java */
const RestrictedPropertiesByDefault: Path[] = [
  ['style', 'whitelabel', 'poweredBy'],
];
/** If changed, also change in KillBillPlanStore.java */
const Standard2Properties: Path[] = [
  ['users', 'onboarding', 'visibility'],
  ['style', 'whitelabel', 'poweredBy'],
];
/** If changed, also change in KillBillPlanStore.java */
const GrowthRestrictedProperties: Path[] = [
  ['style', 'whitelabel', 'poweredBy'],
  ['users', 'onboarding', 'notificationMethods', 'sso'],
  ['users', 'onboarding', 'notificationMethods', 'oauth'],
  ['users', 'onboarding', 'visibility'],
  ['style', 'templates'],
  ['github'],
  ['integrations', 'googleAnalytics'],
  ['integrations', 'hotjar'],
  ['integrations', 'intercom'],
  ['noIndex'],
];
/** If changed, also change in KillBillPlanStore.java */
const AbPitchGroundRestrictedProperties: Path[] = [
  ['style', 'whitelabel', 'poweredBy'],
  ['users', 'onboarding', 'notificationMethods', 'sso'],
  ['users', 'onboarding', 'notificationMethods', 'oauth'],
  ['users', 'onboarding', 'visibility'],
  ['github'],
  ['integrations', 'googleAnalytics'],
  ['integrations', 'hotjar'],
  ['integrations', 'intercom'],
  ['style', 'templates'],
];
/** If changed, also change in KillBillPlanStore.java */
const CdPitchGroundRestrictedProperties: Path[] = [
  ['style', 'whitelabel', 'poweredBy'],
];
/** If changed, also change in KillBillPlanStore.java */
const EPitchGroundRestrictedProperties: Path[] = [
];
/** If changed, also change in KillBillPlanStore.java */
const RestrictedPropertiesByPlan: { [basePlanId: string]: Path[] } = {
  'starter-unlimited': GrowthRestrictedProperties,
  'standard-unlimited': RestrictedPropertiesByDefault,
  'standard2-unlimited': Standard2Properties,
  'sponsor-monthly': UnrestrictedProperties,
  'pro-lifetime': GrowthRestrictedProperties,
  'growth-monthly': GrowthRestrictedProperties,
  'growth2-monthly': GrowthRestrictedProperties,
  'standard-monthly': RestrictedPropertiesByDefault,
  'standard2-monthly': RestrictedPropertiesByDefault,
  'starter3-monthly': GrowthRestrictedProperties,
  'standard3-monthly': RestrictedPropertiesByDefault,
  'flat-yearly': RestrictedPropertiesByDefault,
  'pitchground-a-lifetime': AbPitchGroundRestrictedProperties,
  'pitchground-b-lifetime': AbPitchGroundRestrictedProperties,
  'pitchground-c-lifetime': CdPitchGroundRestrictedProperties,
  'pitchground-d-lifetime': CdPitchGroundRestrictedProperties,
  'pitchground-e-lifetime': EPitchGroundRestrictedProperties,
};
/** If changed, also change in KillBillPlanStore.java */
export const TeammatesMaxCount: { [basePlanId: string]: number } = {
  'starter-unlimited': 2,
  'growth-monthly': 2,
  'growth2-monthly': 2,
  'pro-lifetime': 1,
  'pitchground-a-lifetime': 1,
  'pitchground-b-lifetime': 3,
  'pitchground-c-lifetime': 5,
  'standard-monthly': 8,
  'standard2-monthly': 8,
  'pitchground-d-lifetime': 10,
  'pitchground-e-lifetime': 25,
  'standard2-unlimited': 3,
};
/** If changed, also change in KillBillPlanStore.java */
export const ProjectMaxCount: { [basePlanId: string]: number } = {
  'pro-lifetime': 1,
  'pitchground-a-lifetime': 1,
  'pitchground-b-lifetime': 1,
  'pitchground-c-lifetime': 5,
};
/** If changed, also change in KillBillPlanStore.java */
const AllowedPropertiesByAddon: { [addonId: string]: Path[] } = {
  [AddonWhitelabel]: [
    ['style', 'whitelabel', 'poweredBy'],
  ],
  [AddonPrivateProjects]: [
    ['users', 'onboarding', 'visibility'],
  ],
};
export enum Action {
  API_KEY,
  TEAMMATE_INVITE,
}
/** If changed, also change in KillBillPlanStore.java */
export const RestrictedActions: { [basePlanId: string]: Set<Action> } = {
  'starter-unlimited': new Set([Action.API_KEY]),
  'starter3-monthly': new Set([Action.API_KEY]),
  'growth-monthly': new Set([Action.API_KEY]),
  'growth2-monthly': new Set([Action.API_KEY]),
  'pitchground-a-lifetime': new Set([Action.API_KEY]),
  'pitchground-b-lifetime': new Set([Action.API_KEY]),
};
/** If changed, also change in KillBillPlanStore.java */
export const StarterMaxPosts = 30;

const styles = (theme: Theme) => createStyles({
  outer: {
    position: 'relative',
  },
  warning: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    transition: theme.transitions.create('opacity'),
    opacity: 1,
    zIndex: 1,
    background: theme.palette.background.paper,
    width: 'max-content',
    maxWidth: '100%',
  },
  children: {
    transition: theme.transitions.create('opacity'),
    opacity: 1,
    pointerEvents: 'none',
  },
  hidden: {
    opacity: 0,
  },
  partiallyHidden: {
    opacity: 0.2,
  },
});
const useStyles = makeStyles(styles);
interface Props {
  children: React.ReactNode;
  propertyPath?: Path;
  action?: Action;
  accountBasePlanId?: string;
  accountAddons?: { [addonId: string]: string };
  subscriptionStatus?: Admin.SubscriptionStatus;
  teammatesCount?: number;
  overrideUpgradeMsg?: string,
  hideInsteadOfCover?: boolean;
}
interface ConnectProps {
  accountBasePlanId?: string;
  accountAddons?: { [addonId: string]: string };
  subscriptionStatus?: Admin.SubscriptionStatus;
}
class UpgradeWrapper extends Component<Props & ConnectProps & WithStyles<typeof styles, true>> {
  render() {
    if (!this.isActionRestricted()
      && !this.isPropertyRestricted()
      && !this.isTeammatesInviteRestricted()) {
      return this.props.children;
    }

    return this.props.hideInsteadOfCover ? null : (
      <UpgradeCover overrideUpgradeMsg={this.props.overrideUpgradeMsg}>
        {this.props.children}
      </UpgradeCover>
    );
  }

  isActionRestricted(): boolean {
    return this.props.action !== undefined
      && this.props.accountBasePlanId !== undefined
      && !this.canAutoUpgrade()
      && RestrictedActions[this.props.accountBasePlanId]?.has(this.props.action);
  }

  isPropertyRestricted(): boolean {
    return this.isPropertyRestrictedByPlan()
      && !this.isPropertyAllowedByAddon();

  }

  isPropertyRestrictedByPlan(): boolean {
    return this.props.propertyPath !== undefined
      && this.props.accountBasePlanId !== undefined
      && !this.canAutoUpgrade()
      && RestrictedPropertiesByPlan[this.props.accountBasePlanId]?.some(restrictedPath =>
        pathEquals(restrictedPath, this.props.propertyPath!));
  }

  isPropertyAllowedByAddon(): boolean {
    return this.props.propertyPath !== undefined
      && Object.entries(AllowedPropertiesByAddon)
        .some(([addonId, paths]) => !!this.props.accountAddons?.[addonId]
          && paths.some(path => pathEquals(path, this.props.propertyPath!)));
  }

  isTeammatesInviteRestricted(): boolean {
    return this.props.action === Action.TEAMMATE_INVITE
      && this.props.accountBasePlanId !== undefined
      && !this.canAutoUpgrade()
      && TeammatesMaxCount[this.props.accountBasePlanId] !== undefined
      && (this.props.teammatesCount || 2) >= TeammatesMaxCount[this.props.accountBasePlanId];
  }

  /** If changed, also change in KillBilling.java:tryAutoUpgradePlan */
  canAutoUpgrade(): boolean {
    // TODO trial period with a CC on file is allowed to auto upgrade here, but server will not allow it
    // This is most impactful for SSO and OAuth as it takes time to setup and only after the user is prompted to upgrade
    // Reason why this is not fixed is that it's not easy to check here whether the user has a CC on file
    return this.props.subscriptionStatus === Admin.SubscriptionStatus.ActiveTrial
      && this.props.accountBasePlanId !== TeammatePlanId;
  }
}

export const UpgradeCover = (props: {
  children: any,
  overrideUpgradeMsg?: string,
}) => {
  const classes = useStyles();

  const [clicked, setClicked] = useState<boolean>();
  const [hovered, setHovered] = useState<boolean>();
  const showWarning = !!clicked || !!hovered;

  return (
    <div className={classes.outer}
      onClick={e => setClicked(true)}
      onMouseEnter={e => setHovered(true)}
      onMouseLeave={e => setHovered(false)}
    >
      <Alert
        className={classNames(
          classes.warning,
          !showWarning && classes.hidden,
        )}
        variant='outlined'
        severity='info'
        action={(
          <Button component={Link} to='/dashboard/billing'>Plans</Button>
        )}
      >
        {props.overrideUpgradeMsg || 'Plan upgrade required'}
      </Alert>
      <div
        className={classNames(
          classes.children,
          showWarning && classes.partiallyHidden,
        )}
      >
        {props.children}
      </div>
    </div>
  );
};

export default connect<ConnectProps, {}, Props, ReduxStateAdmin>((state, ownProps) => {
  return {
    accountBasePlanId: ownProps.accountBasePlanId !== undefined ? ownProps.accountBasePlanId : state.account.account.account?.basePlanId,
    accountAddons: ownProps.accountAddons !== undefined ? ownProps.accountAddons : state.account.account.account?.addons,
    subscriptionStatus: ownProps.subscriptionStatus !== undefined ? ownProps.subscriptionStatus : state.account.account.account?.subscriptionStatus,
  };
})(withStyles(styles, { withTheme: true })(UpgradeWrapper));
