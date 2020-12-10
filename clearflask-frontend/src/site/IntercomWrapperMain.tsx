import { connect } from 'react-redux';
import ServerAdmin, { ReduxStateAdmin } from '../api/serverAdmin';
import { isProd } from '../common/util/detectEnv';
import IntercomWrapper, { IntercomWrapperConnectProps } from './IntercomWrapper';

const PROD_APP_ID = 'zklmfmdu';
const TEST_APP_ID = 'ga9fvvhx';

export default connect<IntercomWrapperConnectProps, {}, {}, ReduxStateAdmin>((state) => {
  if (state.account.account.status === undefined) {
    ServerAdmin.get().dispatchAdmin()
      .then(d => d.accountBindAdmin({}));
  }

  // Just don't show intercom to super admins (that's me!)
  if (state.account.isSuperAdmin) {
    return { dontUseThisComponentDirectly: true, disabled: true };
  }

  const account = state.account.account.account;
  const userData = !!account?.intercomIdentity ? {
    user_hash: account.intercomIdentity,
    email: account.email,
    name: account.name,
    base_plan_id: account.basePlanId,
    subscription_status: account.subscriptionStatus,
  } : undefined;

  const connectProps: IntercomWrapperConnectProps = {
    appId: isProd() ? PROD_APP_ID : TEST_APP_ID,
    userData,
    dontUseThisComponentDirectly: true,
  };
  return connectProps;
}, null, null, { forwardRef: true })(IntercomWrapper);
