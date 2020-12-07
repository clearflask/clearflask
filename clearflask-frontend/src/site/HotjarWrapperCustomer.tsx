import { connect } from 'react-redux';
import { ReduxState } from '../api/server';
import ServerAdmin from '../api/serverAdmin';
import HotjarWrapper, { HotjarWrapperProps } from './HotjarWrapper';

export default connect<HotjarWrapperProps, {}, {}, ReduxState>((state) => {
  if (ServerAdmin.get().isSuperAdminLoggedIn()) {
    return {};
  }
  const trackingCode = state.conf.conf?.integrations.hotjar?.trackingCode;
  const connectProps: HotjarWrapperProps = {
    trackerCode: trackingCode ? parseInt(trackingCode) : undefined,
  };
  return connectProps;
}, null, null, { forwardRef: true })(HotjarWrapper);
