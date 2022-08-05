// SPDX-FileCopyrightText: 2021-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import { connect } from 'react-redux';
import ServerAdmin, { ReduxStateAdmin } from '../api/serverAdmin';
import { isProd } from '../common/util/detectEnv';
import ChatwootWrapper, { ChatwootWrapperConnectProps } from './ChatwootWrapper';

const PROD_WEBSITE_TOKEN = 'tzdcJCw9sKQYt9EWrY3cSrLA';
const TEST_WEBSITE_TOKEN = 'iVXK4xSFsatssgsxrwez99uE';

export default connect<ChatwootWrapperConnectProps, {}, { suppressBind?: boolean }, ReduxStateAdmin>((state, ownProps) => {
  const connectProps: ChatwootWrapperConnectProps = {
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

  connectProps.websiteToken = isProd() ? PROD_WEBSITE_TOKEN : TEST_WEBSITE_TOKEN;

  const account = state.account.account.account;
  connectProps.userData = !!account?.chatwootIdentity ? {
    identity: account.chatwootIdentity,
    email: account.email,
    name: account.name,
    basePlanId: account.basePlanId,
    subscriptionStatus: account.subscriptionStatus,
  } : undefined;

  return connectProps;
}, null, null, { forwardRef: true })(ChatwootWrapper);
