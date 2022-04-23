// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import { Button, createStyles, Drawer, Theme, Typography } from '@material-ui/core';
import { makeStyles } from '@material-ui/styles';
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { shallowEqual, useSelector } from 'react-redux';
import * as Client from '../../api/client';
import { ReduxState } from '../../api/server';
import { useForceUpdate } from '../../common/util/reactUtil';
import { trackingConsent, trackingImplicitConsent, trackingIsConsented, trackingReject } from '../../common/util/trackingDelay';
import windowIso from '../../common/windowIso';

const styles = (theme: Theme) => createStyles({
  bannerDrawer: {
    display: 'flex',
    alignItems: 'center',
    maxWidth: 600,
    margin: 'auto',
    padding: theme.spacing(2, 1),
  },
  bannerActions: {
    display: 'flex',
    margin: theme.spacing(2),
    columnGap: theme.spacing(1),
  },
});
const useStyles = makeStyles(styles);

export const CookieConsenter = () => {
  const cookieConsentBuiltIn = useSelector<ReduxState, Client.BuiltIn | undefined>(state => state.conf.conf?.cookieConsent?.builtIn, shallowEqual);
  const cookieConsentCookieYes = useSelector<ReduxState, Client.CookieYes | undefined>(state => state.conf.conf?.cookieConsent?.cookieYes, shallowEqual);
  if (cookieConsentBuiltIn) {
    return (
      <BannerBuiltIn form={cookieConsentBuiltIn} />
    );
  } else if (cookieConsentCookieYes) {
    return (
      <BannerCookieYes opts={cookieConsentCookieYes} />
    );
  } else {
    trackingImplicitConsent();
    return null;
  }
}

export const BannerBuiltIn = (props: {
  form: Client.BuiltIn;
}) => {
  const classes = useStyles();
  const forceUpdate = useForceUpdate();
  const { t } = useTranslation('app');
  return (
    <Drawer
      variant='persistent'
      open={trackingIsConsented() === undefined}
      anchor='bottom'
      PaperProps={{ style: { 'visibility': 'visible' } }} // Fix drawer incorrectly sets visiblity to false
    >
      <div className={classes.bannerDrawer}>
        <div>
          <Typography variant='h6' component='div'>{t(props.form.title as any) || t('cookie-consent')}</Typography>
          <Typography variant='body1' component='div'>{t(props.form.description as any) || t('we-use-cookies-to')}</Typography>
        </div>
        <div className={classes.bannerActions}>
          <Button
            onClick={() => {
              trackingReject();
              forceUpdate();
            }}
          >{t(props.form.reject as any) || t('reject-cookie')}</Button>
          <Button
            variant='contained'
            color='primary'
            onClick={() => {
              trackingConsent();
              forceUpdate();
            }}
          >{t(props.form.accept as any) || t('accept-cookie')}</Button>
        </div>
      </div>
    </Drawer>
  );
}

// Undocumented event from CookieYes triggered on library load and on subsequent user actions
const ConsentUpdateEventName = 'cookieyes_consent_update';
type ConsentTypes = 'necessary' | 'functional' | 'analytics' | 'performance' | 'advertisement' | 'other';
type ConsentUpdateEvent = {
  detail: {
    accepted: Array<ConsentTypes>;
    rejected: Array<ConsentTypes>;
  };
}

export const BannerCookieYes = (props: {
  opts: Client.CookieYes;
}) => {
  useEffect(() => {
    if (windowIso.isSsr) return;
    var s = windowIso.document.createElement('script');
    s.id = 'cookieyes';
    s.type = 'text/javascript';
    s.src = `https://cdn-cookieyes.com/client_data/${props.opts.clientId}/script.js`;
    s.onload = function () {
      const consentUpdateHandler: ((e: any) => void) = (e: ConsentUpdateEvent) => {
        // Analytics will be triggered only if user
        // accepts all cookie types as we have no control
        // over filtering which cookies get set.
        if (e.detail.rejected.length === 0) {
          trackingImplicitConsent();
          !windowIso.isSsr && windowIso.document.removeEventListener(ConsentUpdateEventName, consentUpdateHandler);
        }
      };
      !windowIso.isSsr && windowIso.document.addEventListener(ConsentUpdateEventName, consentUpdateHandler);
    };
    var x = windowIso.document.getElementsByTagName('script')[0];
    x.parentNode?.insertBefore(s, x);
  }, [props.opts.clientId]);
  return null;
}

