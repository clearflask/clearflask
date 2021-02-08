import React from 'react';
import { StaticRouterContext } from 'react-router';
import { Store } from 'redux';
import { ReduxState } from '../api/server';
import { ReduxStateAdmin } from '../api/serverAdmin';
import { ImageSizer } from '../connect/imageSizerCollector';

export interface StoresState {
  serverAdminStore?: Store<ReduxStateAdmin, any>,
  serverStores?: { [projectId: string]: Store<ReduxState, any> },
}

export interface StoresStateSerializable {
  serverAdminStore?: ReduxStateAdmin,
  serverStores?: { [projectId: string]: ReduxState },
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
  fetch: any;
  nodeEnv: 'development' | 'production' | 'test';
  url: string;
  setTitle: (title: string) => void;
  storesState: StoresState;
  awaitPromises: Array<Promise<any>>;
  staticRouterContext: StaticRouterContext;
  imageSizer: ImageSizer;
}) => {
  win['nodeEnv'] = props.nodeEnv;
  win['fetch'] = props.fetch;
  const url = new URL(props.url);
  win['location'] = url;
  win['setTitle'] = props.setTitle;
  win['storesState'] = props.storesState;
  win['awaitPromises'] = props.awaitPromises;
  win['staticRouterContext'] = props.staticRouterContext;
  win['imageSizer'] = props.imageSizer;
  return props.children;
};

export type WindowIso = Window & typeof globalThis & { isSsr: false } | NodeJS.Global & {
  isSsr: true;
  fetch: any;
  nodeEnv: 'development' | 'production' | 'test';
  location: URL;
  setTitle: (title: string) => void;
  storesState: StoresState;
  awaitPromises: Array<Promise<any>>;
  staticRouterContext: StaticRouterContext;
  imageSizer: ImageSizer;
};

const windowIso: WindowIso = win;
export default windowIso;