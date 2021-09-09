// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
import { Button, makeStyles } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import { Alert } from '@material-ui/lab';
import classNames from 'classnames';
import React, { Component, useState } from 'react';
import { connect } from 'react-redux';
import { Link } from 'react-router-dom';
import * as Admin from '../../../api/admin';
import { ReduxStateAdmin } from '../../../api/serverAdmin';
import { Path, pathEquals } from '../configEditor';

/** If changed, also change in PlanStore.java */
export const TeammatePlanId = 'teammate-unlimited';

/** If changed, also change in KillBillPlanStore.java */
const GrowthRestrictedProperties: Path[] = [
  ['users', 'onboarding', 'notificationMethods', 'sso'],
  ['users', 'onboarding', 'notificationMethods', 'oauth'],
  ['users', 'onboarding', 'visibility'],
  ['style', 'templates'],
  ['integrations', 'googleAnalytics'],
  ['integrations', 'hotjar'],
  ['integrations', 'intercom'],
];
/** If changed, also change in KillBillPlanStore.java */
export const RestrictedProperties: { [basePlanId: string]: Path[] } = {
  'growth-monthly': GrowthRestrictedProperties,
  'growth2-monthly': GrowthRestrictedProperties,
};
/** If changed, also change in KillBillPlanStore.java */
export const TeammatesMaxCount: { [basePlanId: string]: number } = {
  'growth-monthly': 1,
  'growth2-monthly': 1,
  'standard-monthly': 8,
  'standard2-monthly': 8,
};

export enum Action {
  API_KEY,
  TEAMMATE_INVITE,
}
/** If changed, also change in KillBillPlanStore.java */
export const RestrictedActions: { [basePlanId: string]: Set<Action> } = {
  'growth-monthly': new Set([Action.API_KEY]),
  'growth2-monthly': new Set([Action.API_KEY]),
};

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
  subscriptionStatus?: Admin.SubscriptionStatus;
  teammatesCount?: number;
  overrideUpgradeMsg?: string,
}
interface ConnectProps {
  accountBasePlanId?: string;
  subscriptionStatus?: Admin.SubscriptionStatus;
}
class UpgradeWrapper extends Component<Props & ConnectProps & WithStyles<typeof styles, true>> {
  render() {
    if (!this.isActionRestricted() && !this.isPropertyRestricted() && !this.isTeammatesInviteRestricted()) {
      return this.props.children;
    }

    return (
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
    return this.props.propertyPath !== undefined
      && this.props.accountBasePlanId !== undefined
      && !this.canAutoUpgrade()
      && RestrictedProperties[this.props.accountBasePlanId]?.some(restrictedPath =>
        pathEquals(restrictedPath, this.props.propertyPath!))
  }

  isTeammatesInviteRestricted(): boolean {
    return this.props.action === Action.TEAMMATE_INVITE
      && this.props.accountBasePlanId !== undefined
      && !this.canAutoUpgrade()
      && TeammatesMaxCount[this.props.accountBasePlanId] !== undefined
      && (this.props.teammatesCount || 1) >= TeammatesMaxCount[this.props.accountBasePlanId];
  }

  canAutoUpgrade(): boolean {
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
    subscriptionStatus: ownProps.subscriptionStatus !== undefined ? ownProps.subscriptionStatus : state.account.account.account?.subscriptionStatus,
  };
})(withStyles(styles, { withTheme: true })(UpgradeWrapper));
