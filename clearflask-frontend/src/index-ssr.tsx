// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import { ChunkExtractorManager } from '@loadable/server';
import i18n from 'i18next';
import fetch from 'node-fetch';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { StaticRouterContext } from 'react-router';
import { StoresState, WindowIsoSsrProvider } from './common/windowIso';
import connectConfig from './connect/config';
import { RenderResult } from './connect/renderer';
import Main from './Main';

export const renderIndexSsr = (props: {
  i18n: typeof i18n;
  url: string;
  staticRouterContext: StaticRouterContext;
  storesState: StoresState;
  awaitPromises: Array<Promise<any>>;
  renderResult: RenderResult;
  requestedUrl: string;
}) => renderToString(props.renderResult.muiSheets.collect(
  <ChunkExtractorManager extractor={props.renderResult.extractor}>
    <WindowIsoSsrProvider
      fetch={fetch}
      apiBasePath={connectConfig.apiBasePath}
      url={props.requestedUrl}
      setTitle={newTitle => props.renderResult.title = newTitle}
      setFaviconUrl={newFaviconUrl => props.renderResult.faviconUrl = newFaviconUrl}
      setMaxAge={maxAge => props.renderResult.maxAge = maxAge}
      storesState={props.storesState}
      awaitPromises={props.awaitPromises}
      staticRouterContext={props.staticRouterContext}
      parentDomain={connectConfig.parentDomain}
    >
      <Main
        i18n={props.i18n}
        ssrLocation={props.url}
        ssrStaticRouterContext={props.staticRouterContext}
      />
    </WindowIsoSsrProvider>
  </ChunkExtractorManager>
));
