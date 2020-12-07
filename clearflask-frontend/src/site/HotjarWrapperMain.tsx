import React from 'react';
import ServerAdmin from '../api/serverAdmin';
import HotjarWrapper from './HotjarWrapper';

export default () => (
  <HotjarWrapper
    trackerCode={ServerAdmin.get().isSuperAdminLoggedIn()
      ? undefined : 2132039}
  />
);
