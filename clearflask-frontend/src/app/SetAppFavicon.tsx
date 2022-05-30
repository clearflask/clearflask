// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import { shallowEqual, useSelector } from 'react-redux';
import { ReduxState } from '../api/server';
import windowIso from '../common/windowIso';

const SetAppFavicon = () => {
  const faviconUrl = useSelector<ReduxState, string | undefined>(state => state.conf.conf?.logoUrl, shallowEqual);
  if (faviconUrl) {
    if (windowIso.isSsr) {
      windowIso.setFaviconUrl(faviconUrl);
    } else {
      const faviconEl = windowIso.document.getElementById('favicon');
      if (!!faviconEl) faviconEl['href'] = faviconUrl;
    }
  }
  return null;
}
export default SetAppFavicon;
