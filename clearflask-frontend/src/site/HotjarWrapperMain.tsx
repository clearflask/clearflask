import React from 'react';
import ServerAdmin from '../api/serverAdmin';
import { isTracking } from '../common/util/detectEnv';
import HotjarWrapper from './HotjarWrapper';

const HotjarWrapperMain = () => (
  <HotjarWrapper
    trackerCode={(ServerAdmin.get().isSuperAdminLoggedIn() || !isTracking())
      ? undefined : 2132039}
  />
);
export default HotjarWrapperMain;
