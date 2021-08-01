// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useEffect, useRef, useState } from 'react';
import { useHistory, useLocation } from 'react-router';
import windowIso from '../windowIso';
import { redirectIso } from './routerUtil';
import setTitle from './titleUtil';
import randomUuid from './uuid';

export const IframeWithUrlSync = (props: {
  browserPathPrefix: string;
  srcWithoutPathname: string;
  pathnamePrefix?: string;
  initialQuery?: string;
  redirectOnDirectAccess?: boolean | string; // Optional different pathnamePrefix
} & Omit<React.HTMLProps<HTMLIFrameElement>, 'src'>) => {
  const { browserPathPrefix, srcWithoutPathname, pathnamePrefix, initialQuery, redirectOnDirectAccess, ...iframeProps } = props;
  const getBrowserPathname = () => (!!windowIso.isSsr || !windowIso.location.pathname.startsWith(browserPathPrefix))
    ? undefined
    : windowIso.location.pathname.substr(browserPathPrefix.length);
  const history = useHistory();
  const iframeId = useRef(iframeProps.id || `iframe-url-sync-${randomUuid()}`);

  const handleOnMessage = event => {
    if (typeof event.data !== 'object'
      || event.data.type !== 'pathname-changed'
      || typeof event.data.pathname !== 'string'
      || typeof event.data.title !== 'string') return;
    const browserPathname = getBrowserPathname();
    const iframeFullPathname = event.data.pathname as string;
    const newIframePathname = !iframeFullPathname.startsWith(pathnamePrefix || '') ? undefined
      : iframeFullPathname.substr(pathnamePrefix?.length || 0);
    iframePathnameRef.current = newIframePathname;
    if (browserPathname !== undefined && newIframePathname !== undefined
      && browserPathname !== newIframePathname) {
      history.replace(browserPathPrefix + newIframePathname);
    }
    setTitle(event.data.title);
  };
  useEffect(() => {
    !windowIso.isSsr && windowIso.addEventListener('message', handleOnMessage);
    return () => { !windowIso.isSsr && windowIso.removeEventListener('message', handleOnMessage) };
  }, [handleOnMessage]);

  const browserPathname = getBrowserPathname();
  const iframePathnameRef = useRef<string | undefined>(browserPathname || '');
  const [src, setSrc] = useState(srcWithoutPathname + (pathnamePrefix || '') + (browserPathname || '') + (initialQuery || ''));

  if (browserPathname !== undefined && iframePathnameRef.current !== undefined
    && browserPathname !== iframePathnameRef.current) {
    const newSrc = srcWithoutPathname + (pathnamePrefix || '') + browserPathname;
    if (src !== newSrc) {
      setSrc(newSrc);
    } else {
      // We need to navigate to the same src, so setting it will not navigate.
      const iframeEl = document.getElementById(iframeId.current) as HTMLIFrameElement | undefined;
      if (iframeEl) iframeEl.src += '';
    }
  }

  if (redirectOnDirectAccess !== undefined && windowIso.isSsr) {
    redirectIso(srcWithoutPathname + (redirectOnDirectAccess || pathnamePrefix || '') + (browserPathname || '') + (initialQuery || ''));
    return null;
  }

  return (
    <iframe
      {...iframeProps}
      id={iframeId.current}
      src={src}
      onLoad={e => {
        iframeProps.onLoad?.(e);
      }}
    />
  );
};

export const IframeBroadcastPathname = (props: {
} & Omit<React.HTMLProps<HTMLIFrameElement>, 'src'>) => {
  const location = useLocation();

  if (!windowIso.isSsr) {
    windowIso.top.postMessage({
      type: 'pathname-changed',
      pathname: location.pathname,
      title: windowIso.document.title,
    }, '*');
  }

  return null;
};
