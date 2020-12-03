import React, { Component } from 'react';
import { connect } from 'react-redux';
import { Route } from 'react-router';
import * as Admin from '../api/admin';
import { Status } from '../api/server';
import ServerAdmin, { ReduxStateAdmin } from '../api/serverAdmin';
import { isProd } from '../common/util/detectEnv';
import { intercomLoad, intercomStart, intercomUpdate } from '../common/util/intercomUtil';

const APP_ID = 'zklmfmdu';

interface ConnectProps {
  accountStatus?: Status;
  account?: Admin.AccountAdmin;
}
class IntercomWrapper extends Component<ConnectProps> {
  started: boolean = false;

  constructor(props) {
    super(props);

    if (props.accountStatus === undefined) {
      ServerAdmin.get().dispatchAdmin()
        .then(d => d.accountBindAdmin({}));
    }

    intercomLoad(APP_ID);
  }

  render() {
    const userData = isProd() && !!this.props.account?.intercomIdentity ? {
      user_hash: this.props.account.intercomIdentity,
      email: this.props.account.email,
      name: this.props.account.name,
      base_plan_id: this.props.account.basePlanId,
      subscription_status: this.props.account.subscriptionStatus,
    } : undefined;

    if (!this.started) {
      this.started = true;
      intercomStart(APP_ID, userData);
    } else {
      intercomUpdate(APP_ID, userData);
    }

    return (
      <Route path='/' render={({ location }) => {
        intercomUpdate(APP_ID, userData);
        return null;
      }} />
    );
  }
}

export default connect<ConnectProps, {}, {}, ReduxStateAdmin>((state) => {
  const connectProps: ConnectProps = {
    accountStatus: state.account.account.status,
    account: state.account.account.account,
  };
  return connectProps;
}, null, null, { forwardRef: true })(IntercomWrapper);
