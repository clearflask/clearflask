import { connect } from 'react-redux';
import { ReduxState } from '../api/server';
import ServerAdmin from '../api/serverAdmin';
import IntercomWrapper, { IntercomWrapperConnectProps } from './IntercomWrapper';

export default connect<IntercomWrapperConnectProps, {}, {}, ReduxState>((state) => {

  const appId = state.conf.conf?.integrations.intercom?.appId;
  if (!appId) {
    return { dontUseThisComponentDirectly: true };
  }

  // Just don't show intercom to super admins (that's me!)
  if (ServerAdmin.get().isSuperAdminLoggedIn()) {
    return { dontUseThisComponentDirectly: true, disabled: true };
  }

  const userMe = state.users.loggedIn.user;
  const userData = (!!userMe?.intercomIdentity && !!userMe.email) ? {
    user_hash: userMe.intercomIdentity,
    email: userMe.email,
    ...(userMe.name ? { name: userMe.name } : {}),
  } : undefined;

  const connectProps: IntercomWrapperConnectProps = {
    appId,
    userData,
    dontUseThisComponentDirectly: true,
  };
  return connectProps;
}, null, null, { forwardRef: true })(IntercomWrapper);
