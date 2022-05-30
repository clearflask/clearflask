// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import { ChunkExtractor } from '@loadable/server';
import { ServerStyleSheets } from '@material-ui/core';
import htmlparser from 'cheerio';
import { Handler } from 'express';
import fs from 'fs';
import { i18n, Resource } from 'i18next';
import path from 'path';
import { resetServerContext } from 'react-beautiful-dnd';
import { StaticRouterContext } from 'react-router';
import { htmlDataCreate } from '../common/util/htmlData';
import { StoresState, StoresStateSerializable } from '../common/windowIso';
import { renderIndexSsr } from '../index-ssr';
import connectConfig from './config';

export interface RenderResult {
  faviconUrl?: string;
  title: string;
  extractor: ChunkExtractor;
  muiSheets: ServerStyleSheets;
  renderedScreen: string;
  maxAge?: number;
}

const PH_ENV = '%ENV%';
const PH_PARENT_DOMAIN = '%PARENT_DOMAIN%';
const PH_FAVICON_URL = '%FAVICON_URL%';
const PH_PAGE_TITLE = '%PAGE_TITLE%';
const PH_LINK_TAGS = '%LINK_TAGS%';
const PH_STYLE_TAGS = '%STYLE_TAGS%';
const PH_MUI_STYLE_TAGS = '%MUI_STYLE_TAGS%';
const PH_SCRIPT_TAGS = '%SCRIPT_TAGS%';
const PH_MAIN_SCREEN = '%MAIN_SCREEN%';
const PH_STORE_CONTENT = '%STORE_CONTENT%';
const PH_I18N_INIT_LNG = '%I18N_INIT_LNG%';
const PH_I18N_INIT_STORE = '%I18N_INIT_STORE%';

export const getParentDomainUrl = () => {
  return `${connectConfig.forceRedirectHttpToHttps ? 'https' : 'http'}://${connectConfig.parentDomain}`;
}

export const replaceParentDomain = (html) => {
  if (connectConfig.parentDomain === 'clearflask.com') return html;
  return html.replace(
    /https:\/\/clearflask\.com/g,
    getParentDomainUrl());
}

// Cache index.html in memory
const indexHtmlPromise: Promise<string> = new Promise<string>((resolve, error) => {
  const filePath = path.resolve(connectConfig.publicPath, 'index.html');
  fs.readFile(filePath, 'utf8', (err, html) => {
    if (!err) {
      resolve(html);
    } else {
      error(err);
    }
  });
}).then(htmlStr => {
  htmlStr = replaceParentDomain(htmlStr);
  const $ = htmlparser.load(htmlStr);
  $('#loader-css').remove();
  $('noscript').remove();
  $('#loadingScreen').remove();
  $('#favicon').attr('href', PH_FAVICON_URL);
  $('title').text(PH_PAGE_TITLE);
  $('#mainScreen').text(PH_MAIN_SCREEN);
  $('head').append(PH_STYLE_TAGS);
  $('head').append(`<style id="ssr-jss">${PH_MUI_STYLE_TAGS}</style>`);
  $('head').append(PH_LINK_TAGS);
  $('body').append(PH_ENV);
  $('body').append(PH_PARENT_DOMAIN);
  $('body').append(PH_I18N_INIT_LNG);
  $('body').append(PH_I18N_INIT_STORE);
  $('body').append(PH_SCRIPT_TAGS);
  $('body').append(PH_STORE_CONTENT);
  $('body').find('script').remove();
  return $.root().html() || '';
});

export default function render(): Handler {
  return async (req, res, next) => {
    try {
      const staticRouterContext: StaticRouterContext = {};
      const storesState: StoresState = {};
      const port = req.app.settings.port;
      const requestedUrl = `${req.protocol}://${req.hostname}${(!port || port == 80 || port == 443) ? '' : (':' + port)}${req.path}`;
      const awaitPromises: Array<Promise<any>> = [];

      // From i18next-http-middleware
      const i18n = req.i18n as i18n;
      const lng = i18n.language;

      var renderResult: RenderResult | undefined;
      var isFinished = false;
      var renderCounter = 0;
      const renderPromise = new Promise<void>(async (resolve, reject) => {
        try {
          do {
            if (++renderCounter > 10) {
              console.warn(`Render give up after too many passes ${renderCounter} on ${requestedUrl}`);
              resolve();
              return;
            }
            // console.debug(`Rendering ${requestedUrl} pass #${renderCounter} with ${awaitPromises.length} promises`);
            const renderPassResult: RenderResult = {
              title: 'ClearFlask',
              extractor: renderResult?.extractor || new ChunkExtractor({
                statsFile: path.resolve(connectConfig.publicPath, 'loadable-stats.json'),
                entrypoints: ['main'],
                // SSR public path, for CSR see index.tsx
                outputPath: path.resolve(__dirname, '..', '..', 'build'),
                publicPath: (connectConfig.parentDomain !== 'clearflask.com')
                  ? '/' : undefined,
              }),
              muiSheets: new ServerStyleSheets(),
              renderedScreen: '',
            };
            try {
              await Promise.allSettled(awaitPromises);
            } catch (e) { }
            awaitPromises.length = 0;
            if (isFinished) return; // Request timed out

            resetServerContext(); // For react-beautiful-dnd library

            renderPassResult.renderedScreen = renderIndexSsr({
              i18n,
              url: req.url,
              staticRouterContext,
              storesState,
              awaitPromises,
              renderResult: renderPassResult,
              requestedUrl: requestedUrl,
            });

            if (isFinished) return; // Request timed out
            renderResult = renderPassResult;
          } while (awaitPromises.length > 0);
          console.info(`Rendered ${requestedUrl} in ${renderCounter} pass(es)`);
          resolve();
        } catch (e) {
          reject(e);
        }
      });
      const timeoutPromise = new Promise<void>(resolve => setTimeout(() => {
        !isFinished && console.warn(`Render timeout on ${requestedUrl} after ${renderCounter} pass(es)`);
        resolve();
      }, 10000));
      await Promise.race([timeoutPromise, renderPromise]);
      isFinished = true;

      if (!renderResult) {
        // Timeout with no render finished, fallback to client-side rendering
        res.status(500);
        res.sendFile(path.join(__dirname, '..', '..', "build", "index.html"));
        return;
      }

      var html = await indexHtmlPromise;

      if (process.env.ENV !== 'production') {
        html = html.replace(PH_ENV, `<script>window.ENV='${process.env.ENV}'</script>`);
      } else {
        html = html.replace(PH_ENV, '');
      }

      if (connectConfig.parentDomain !== 'clearflask.com') {
        html = html.replace(PH_PARENT_DOMAIN, `<script>window.parentDomain='${connectConfig.parentDomain}'</script>`);
      } else {
        html = html.replace(PH_PARENT_DOMAIN, '');
      }

      // Favicon
      html = html.replace(PH_FAVICON_URL, renderResult.faviconUrl || `${getParentDomainUrl()}/favicon.ico`);

      // Page title
      html = html.replace(PH_PAGE_TITLE, renderResult.title);

      // JS, CSS
      html = html.replace(PH_LINK_TAGS, renderResult.extractor.getLinkTags());
      html = html.replace(PH_STYLE_TAGS, renderResult.extractor.getStyleTags());
      html = html.replace(PH_SCRIPT_TAGS, renderResult.extractor.getScriptTags());
      html = html.replace(PH_MUI_STYLE_TAGS, renderResult.muiSheets.toString());

      // Add rendered html
      html = html.replace(PH_MAIN_SCREEN, renderResult.renderedScreen);

      // Add populated stores
      if (storesState.serverAdminStore !== undefined || storesState.serverStores !== undefined) {
        const storesStateSerializable: StoresStateSerializable = {
          serverAdminStore: storesState.serverAdminStore?.getState(),
          serverStores: {},
        };
        !!storesState.serverStores && Object.entries(storesState.serverStores)
          .forEach(([id, store]) => storesStateSerializable.serverStores![id] = store.getState());
        html = html.replace(PH_STORE_CONTENT, htmlDataCreate('__SSR_STORE_INITIAL_STATE__', storesStateSerializable));
      } else {
        html = html.replace(PH_STORE_CONTENT, '');
      }

      // I18N initial language and in-memory store
      html = html.replace(PH_I18N_INIT_LNG, htmlDataCreate('__SSR_I18N_INIT_LNG__', lng));
      const i18nStore: Resource = { [lng]: {} };
      (lng === 'en' ? ['en'] : ['en', lng]).forEach(l => {
        i18nStore[l] = {};
        i18n.reportNamespaces.getUsedNamespaces().forEach(ns => {
          i18nStore[l][ns] = i18n.services.resourceStore.data[l][ns];
        });
      });
      html = html.replace(PH_I18N_INIT_STORE, htmlDataCreate('__SSR_I18N_INIT_STORE__', i18nStore));

      res.writeHead(staticRouterContext.statusCode || 200, {
        'Content-Type': 'text/html',
        ...(renderResult.maxAge !== undefined && { 'Cache-Control': 'public, max-age=' + renderResult.maxAge }),
        ...(staticRouterContext.url && { Location: staticRouterContext.url }),
      });
      res.end(html);
    } catch (e) {
      console.error('Failed to get page', e);
      res.header('Cache-Control', 'public, max-age=10');
      res.status(500);
      if (process.env.ENV === 'production') {
        // fallback to client-side rendering (still throwing 500)
        // This is not exactly necessary for CloudFront as it is configured to get index.html on http 500
        // It is necessary for custom domains bypassing CloudFront
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
      } else {
        res.end();
      }
    }
  };
};
