
import React, { useEffect, useRef, useState } from 'react';
import { useHistory, useLocation } from 'react-router';
import windowIso from '../windowIso';
import setTitle from './titleUtil';

export const IframeWithUrlSync = (props: {
  browserPathPrefix: string;
  srcWithoutPathname: string;
  pathnamePrefix?: string;
} & Omit<React.HTMLProps<HTMLIFrameElement>, 'src'>) => {
  const { browserPathPrefix, srcWithoutPathname, pathnamePrefix, ...iframeProps } = props;
  const getBrowserPathname = () => (!!windowIso.isSsr || !windowIso.location.pathname.startsWith(browserPathPrefix))
    ? undefined
    : windowIso.location.pathname.substr(browserPathPrefix.length);
  const history = useHistory();

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
    window.addEventListener('message', handleOnMessage);
    return () => window.removeEventListener('message', handleOnMessage);
  }, [handleOnMessage]);

  const browserPathname = getBrowserPathname();
  const iframePathnameRef = useRef<string | undefined>(browserPathname || '');
  const [src, setSrc] = useState(srcWithoutPathname + (pathnamePrefix || '') + (browserPathname || ''));

  if (browserPathname !== undefined && iframePathnameRef.current !== undefined
    && browserPathname !== iframePathnameRef.current) {
    const newSrc = srcWithoutPathname + (pathnamePrefix || '') + browserPathname;
    if (src !== newSrc) setSrc(newSrc);
  }


  return (
    <iframe
      {...iframeProps}
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
