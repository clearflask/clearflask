import React from 'react';

export interface StoresState {
  serverAdminStore?: any,
  serverStores?: { [projectId: string]: any },
}

var win: any;
if (typeof window !== "undefined") {
  win = window;
  win.isSsr = false;
} else if (typeof global !== "undefined") {
  win = global;
  win.isSsr = true;
  /* eslint-disable-next-line no-restricted-globals */
} else if (typeof self !== "undefined") {
  /* eslint-disable-next-line no-restricted-globals */
  win = self;
  win.isSsr = true;
} else {
  win = {};
  win.isSsr = true;
}

export const WindowIsoSsrProvider = (props: {
  children: React.ReactElement;
  url: string;
  setTitle: (title: string) => void;
  storesState: StoresState;
  awaitPromises: Array<Promise<any>>;
}) => {
  const url = new URL(props.url);
  win['location'] = url;
  win['setTitle'] = props.setTitle;
  win['storesState'] = props.storesState;
  win['awaitPromises'] = props.awaitPromises;
  return props.children;
};

export type WindowIso = Window & typeof globalThis & { isSsr: false } | NodeJS.Global & {
  isSsr: true;
  location: URL;
  setTitle: (title: string) => void;
  storesState: StoresState;
  awaitPromises: Array<Promise<any>>;
};

const windowIso: WindowIso = win;
export default windowIso;