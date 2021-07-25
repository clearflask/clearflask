import { Button } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import { Alert } from '@material-ui/lab';
import classNames from 'classnames';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import { Link } from 'react-router-dom';
import { ReduxStateAdmin } from '../../../api/serverAdmin';
import { Path, pathEquals } from '../configEditor';

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

export enum Action {
  API_KEY
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
interface Props {
  children: React.ReactNode;
  propertyPath?: Path;
  action?: Action;
  accountBasePlanId?: string;
}
interface ConnectProps {
  accountBasePlanId?: string;
}
interface State {
  clicked?: boolean;
  hovered?: boolean;
}
class UpgradeWrapper extends Component<Props & ConnectProps & WithStyles<typeof styles, true>, State> {
  state: State = {};
  render() {
    if (!this.isActionRestricted() && !this.isPropertyRestricted()) {
      return this.props.children;
    }

    const showWarning = !!this.state.clicked || !!this.state.hovered;

    return (
      <div className={this.props.classes.outer}
        onClick={e => this.setState({ clicked: true })}
        onMouseEnter={e => this.setState({ hovered: true })}
        onMouseLeave={e => this.setState({ hovered: false })}
      >
        <UpgradeAlert
          className={classNames(this.props.classes.warning, !showWarning && this.props.classes.hidden)}
        />
        <div
          className={classNames(this.props.classes.children, showWarning && this.props.classes.partiallyHidden)}
        >
          {this.props.children}
        </div>
      </div>
    );
  }

  isActionRestricted(): boolean {
    return this.props.action !== undefined
      && this.props.accountBasePlanId !== undefined
      && RestrictedActions[this.props.accountBasePlanId]?.has(this.props.action);
  }

  isPropertyRestricted(): boolean {
    return this.props.propertyPath !== undefined
      && this.props.accountBasePlanId !== undefined
      && RestrictedProperties[this.props.accountBasePlanId]?.some(restrictedPath =>
        pathEquals(restrictedPath, this.props.propertyPath!))
  }
}

export const UpgradeAlert = (props: { className?: string }) => (
  <Alert
    className={props.className}
    variant='outlined'
    severity='info'
    action={(
      <Button component={Link} to='/dashboard/billing'>Plans</Button>
    )}
  >
    Upgrade to use this feature
  </Alert>
);

export default connect<ConnectProps, {}, Props, ReduxStateAdmin>((state, ownProps) => {
  return {
    accountBasePlanId: ownProps.accountBasePlanId !== undefined ? ownProps.accountBasePlanId : state.account.account.account?.basePlanId,
  };
})(withStyles(styles, { withTheme: true })(UpgradeWrapper));
