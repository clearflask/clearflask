// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
import { connect } from 'react-redux';
import ServerAdmin, { ReduxStateAdmin } from '../api/serverAdmin';
import { isProd } from '../common/util/detectEnv';
import IntercomWrapper, { IntercomWrapperConnectProps } from './IntercomWrapper';

const PROD_APP_ID = 'zklmfmdu';
const TEST_APP_ID = 'ga9fvvhx';

export default connect<IntercomWrapperConnectProps, {}, { suppressBind?: boolean }, ReduxStateAdmin>((state, ownProps) => {
  const connectProps: IntercomWrapperConnectProps = {
    dontUseThisComponentDirectly: true,
  };

  if (state.account.account.status === undefined && !ownProps.suppressBind) {
    connectProps.callOnMount = () => {
      ServerAdmin.get().dispatchAdmin()
        .then(d => d.accountBindAdmin({ accountBindAdmin: {} }));
    };
  }

  if (state.account.isSuperAdmin) {
    connectProps.disabled = true;
    return connectProps;
  }

  connectProps.appId = isProd() ? PROD_APP_ID : TEST_APP_ID;

  const account = state.account.account.account;
  connectProps.userData = !!account?.intercomIdentity ? {
    user_hash: account.intercomIdentity,
    email: account.email,
    name: account.name,
    base_plan_id: account.basePlanId,
    subscription_status: account.subscriptionStatus,
  } : undefined;

  return connectProps;
}, null, null, { forwardRef: true })(IntercomWrapper);
