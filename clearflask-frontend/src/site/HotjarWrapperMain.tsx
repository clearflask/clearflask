// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
import React from 'react';
import ServerAdmin from '../api/serverAdmin';
import HotjarWrapper from './HotjarWrapper';

const HotjarWrapperMain = () => (
  <HotjarWrapper
    trackerCode={(ServerAdmin.get().isSuperAdminLoggedIn())
      ? undefined : 2132039}
  />
);
export default HotjarWrapperMain;
