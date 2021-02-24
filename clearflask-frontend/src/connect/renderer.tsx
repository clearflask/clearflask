import { ChunkExtractor, ChunkExtractorManager } from '@loadable/server';
import { ServerStyleSheets } from '@material-ui/core';
import htmlparser from 'cheerio';
import fs from 'fs';
import fetch from 'node-fetch';
import path from 'path';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { StaticRouterContext } from 'react-router';
import { htmlDataCreate } from '../common/util/htmlData';
import { StoresState, StoresStateSerializable, WindowIsoSsrProvider } from '../common/windowIso';
import Main from '../Main';

interface RenderResult {
  title: string;
  extractor: ChunkExtractor;
  muiSheets: ServerStyleSheets;
  renderedScreen: string;
}

const statsFile = path.resolve(__dirname, 'public', 'loadable-stats.json')

const PH_ENV = '%ENV%';
const PH_PAGE_TITLE = '%PAGE_TITLE%';
const PH_LINK_TAGS = '%LINK_TAGS%';
const PH_STYLE_TAGS = '%STYLE_TAGS%';
const PH_MUI_STYLE_TAGS = '%MUI_STYLE_TAGS%';
const PH_SCRIPT_TAGS = '%SCRIPT_TAGS%';
const PH_MAIN_SCREEN = '%MAIN_SCREEN%';
const PH_STORE_CONTENT = '%STORE_CONTENT%';

// Cache index.html in memory
const indexHtmlPromise: Promise<string> = new Promise<string>((resolve, error) => {
  const filePath = path.resolve(__dirname, 'public', 'index.html');
  fs.readFile(filePath, 'utf8', (err, html) => {
    if (!err) {
      resolve(html);
    } else {
      error(err);
    }
  });
}).then(htmlStr => {
  const $ = htmlparser.load(htmlStr);
  $('#loader-css').remove();
  $('noscript').remove();
  $('#loadingScreen').remove();
  $('title').text(PH_PAGE_TITLE);
  $('#mainScreen').text(PH_MAIN_SCREEN);
  $('head').append(PH_STYLE_TAGS);
  $('head').append(`<style>${PH_MUI_STYLE_TAGS}</style>`);
  $('head').append(PH_LINK_TAGS);
  $('body').append(PH_ENV);
  $('body').append(PH_SCRIPT_TAGS);
  $('body').append(PH_STORE_CONTENT);
  $('body').find('script').remove();
  return $.root().html() || '';
});

export default function render() {
  return async (req, res, next) => {
    try {
      const staticRouterContext: StaticRouterContext = {};
      const storesState: StoresState = {};
      const port = req.app.settings.port;
      const requested_url = `${req.protocol}://${req.hostname}${(!port || port == 80 || port == 443) ? '' : (':' + port)}${req.path}`;
      const awaitPromises: Array<Promise<any>> = [];

      var renderResult: RenderResult | undefined;
      var isFinished = false;
      var renderCounter = 0;
      const renderPromise = new Promise<void>(async (resolve, reject) => {
        try {
          do {
            if (++renderCounter > 10) {
              console.warn(`Render give up after too many passes ${renderCounter} on ${requested_url}`);
              resolve();
              return;
            }
            // console.debug(`Rendering ${requested_url} pass #${renderCounter} with ${awaitPromises.length} promises`);
            const rr: RenderResult = {
              title: 'ClearFlask',
              extractor: renderResult?.extractor || new ChunkExtractor({
                statsFile,
                entrypoints: ['main'],
                outputPath: path.resolve(__dirname, '..', '..', 'build'),
                publicPath: process.env.ENV !== 'production' ? '/' : undefined,
              }),
              muiSheets: new ServerStyleSheets(),
              renderedScreen: '',
            };
            try {
              await Promise.allSettled(awaitPromises);
            } catch (e) { }
            awaitPromises.length = 0;
            if (isFinished) return; // Request timed out

            rr.renderedScreen = ReactDOMServer.renderToString(rr.muiSheets.collect(
              <ChunkExtractorManager extractor={rr.extractor}>
                <WindowIsoSsrProvider
                  env={process.env.ENV || process.env.NODE_ENV as any}
                  fetch={fetch}
                  url={requested_url}
                  setTitle={newTitle => rr.title = newTitle}
                  storesState={storesState}
                  awaitPromises={awaitPromises}
                  staticRouterContext={staticRouterContext}
                >
                  <Main
                    ssrLocation={req.url}
                    ssrStaticRouterContext={staticRouterContext}
                  />
                </WindowIsoSsrProvider>
              </ChunkExtractorManager>
            ));
            if (isFinished) return; // Request timed out
            renderResult = rr;
          } while (awaitPromises.length > 0);
          console.info(`Rendered ${requested_url} in ${renderCounter} pass(es)`);
          resolve();
        } catch (e) {
          reject(e);
        }
      });
      const timeoutPromise = new Promise<void>(resolve => setTimeout(() => {
        !isFinished && console.warn(`Render timeout on ${requested_url} after ${renderCounter} pass(es)`);
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
      if (storesState.serverAdminStore || storesState.serverStores) {
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

      res.writeHead(staticRouterContext.statusCode || 200, {
        'Content-Type': 'text/html',
        ...(staticRouterContext.url && { Location: staticRouterContext.url }),
      });
      res.end(html);
    } catch (e) {
      console.error('Failed to get page', e);
      if (process.env.ENV !== 'production') {
        res.status(500).end();
      } else {
        // fallback to client-side rendering but still throw 500
        res.status(500);
        // This is not exactly necessary for CloudFront as it is configured to get index.html on http 500
        // It is necessary for custom domains bypassing CloudFront
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
      }
    }
  };
};
