import { ChunkExtractor, ChunkExtractorManager } from '@loadable/server';
import { ServerStyleSheets } from '@material-ui/core';
import htmlparser from 'cheerio';
import fs from 'fs';
import fetch from 'node-fetch';
import path from 'path';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { StaticRouterContext } from 'react-router';
import { IMAGE_SIZER_DATA_KEY } from '../common/imageSizerClient';
import { StoresState, StoresStateSerializable, WindowIsoSsrProvider } from '../common/windowIso';
import Main from '../Main';
import connectConfig from './config';
import imageSizer, { ImageSizerCollector } from './imageSizerCollector';

interface RenderResult {
  title: string;
  extractor: ChunkExtractor;
  muiSheets: ServerStyleSheets;
  renderedScreen: string;
  imageSizer: ImageSizerCollector;
}

const statsFile = path.resolve(connectConfig.distPath, 'loadable-stats.json')

const PH_ENV = '%ENV%';
const PH_PAGE_TITLE = '%PAGE_TITLE%';
const PH_LINK_TAGS = '%LINK_TAGS%';
const PH_STYLE_TAGS = '%STYLE_TAGS%';
const PH_MUI_STYLE_TAGS = '%MUI_STYLE_TAGS%';
const PH_SCRIPT_TAGS = '%SCRIPT_TAGS%';
const PH_MAIN_SCREEN = '%MAIN_SCREEN%';
const PH_STORE_CONTENT = '%STORE_CONTENT%';
const PH_IMAGE_SIZER_CACHE = '%IMAGE_SIZER_CACHE%';

// Cache index.html in memory
const indexHtmlPromise: Promise<string> = new Promise<string>((resolve, error) => {
  const filePath = path.resolve(connectConfig.distPath, 'index.html');
  fs.readFile(filePath, 'utf8', (err, html) => {
    if (!err) {
      resolve(html);
    } else {
      error(err);
    }
  });
}).then(htmlStr => {
  const publicUrl = (connectConfig.chunksPublicPath || '').replace(/\/$/, '');
  // htmlStr = htmlStr.replace(/%PUBLIC_URL%/g, publicUrl)
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
  $('body').append(PH_IMAGE_SIZER_CACHE);
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
      const renderPromise = new Promise<void>(async resolve => {
        do {
          if (++renderCounter > 10) {
            console.warn(`Render give up after too many passes ${renderCounter} on ${requested_url}`);
            resolve();
            return;
          }
          console.debug(`Rendering ${requested_url} pass #${renderCounter} with ${awaitPromises.length} promises`);
          const rr: RenderResult = {
            title: 'ClearFlask',
            extractor: renderResult?.extractor || new ChunkExtractor({
              statsFile,
              entrypoints: ['main'],
              publicPath: connectConfig.chunksPublicPath,
              outputPath: path.resolve(__dirname, '..', '..', 'build'),
            }),
            muiSheets: new ServerStyleSheets(),
            renderedScreen: '',
            imageSizer: new ImageSizerCollector(),
          };

          try {
            await Promise.allSettled(awaitPromises);
          } catch (e) { }
          awaitPromises.length = 0;
          if (isFinished) return; // Request timed out

          rr.renderedScreen = ReactDOMServer.renderToString(rr.muiSheets.collect(
            <ChunkExtractorManager extractor={rr.extractor}>
              <WindowIsoSsrProvider
                nodeEnv={process.env.ENV || process.env.NODE_ENV as any}
                fetch={fetch}
                url={requested_url}
                setTitle={newTitle => rr.title = newTitle}
                storesState={storesState}
                awaitPromises={awaitPromises}
                staticRouterContext={staticRouterContext}
                imageSizer={rr.imageSizer}
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
        html = html.replace(PH_ENV, '<script>window.ENV=\'development\'</script>');
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
        html = html.replace(PH_STORE_CONTENT, `<script>window.__SSR_STORE_INITIAL_STATE__ = ${JSON.stringify(storesStateSerializable)};</script>`);
      } else {
        html = html.replace(PH_STORE_CONTENT, '');
      }

      html = html.replace(PH_IMAGE_SIZER_CACHE, `<script>window.${IMAGE_SIZER_DATA_KEY} = ${JSON.stringify(imageSizer.getCache())};</script>`);

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
        res.sendFile(path.join(connectConfig.distPath, 'index.html'));
      }
    }
  };
};
