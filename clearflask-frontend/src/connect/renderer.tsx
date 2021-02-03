import { ChunkExtractor, ChunkExtractorManager } from '@loadable/server';
import { ServerStyleSheets } from '@material-ui/core';
import htmlparser from 'cheerio';
import fs from 'fs';
import path from 'path';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { StaticRouterContext } from 'react-router';
import { StoresState, WindowIsoSsrProvider } from '../common/windowIso';
import Main from '../Main';
import connectConfig from './config';

const statsFile = path.resolve(__dirname, '..', '..', 'build', 'loadable-stats.json')

const PH_PAGE_TITLE = '%PAGE_TITLE%';
const PH_LINK_TAGS = '%LINK_TAGS%';
const PH_STYLE_TAGS = '%STYLE_TAGS%';
const PH_MUI_STYLE_TAGS = '%MUI_STYLE_TAGS%';
const PH_SCRIPT_TAGS = '%SCRIPT_TAGS%';
const PH_MAIN_SCREEN = '%MAIN_SCREEN%';
const PH_STORE_CONTENT = '%STORE_CONTENT%';

// Cache index.html in memory
const indexHtmlPromise: Promise<string> = new Promise<string>((resolve, error) => {
  const filePath = path.resolve(__dirname, '..', '..', 'public', 'index.html');
  fs.readFile(filePath, 'utf8', (err, html) => {
    if (!err) {
      resolve(html);
    } else {
      error(err);
    }
  });
}).then(htmlStr => {
  const publicUrl = (connectConfig.chunksPublicPath || '').replace(/\/$/, '');
  htmlStr = htmlStr.replace(/%PUBLIC_URL%/g, publicUrl)
  const $ = htmlparser.load(htmlStr);
  $('#loader-css').remove();
  $('noscript').remove();
  $('#loadingScreen').remove();
  $('title').text(PH_PAGE_TITLE);
  $('#mainScreen').text(PH_MAIN_SCREEN);
  $('head').append(PH_STYLE_TAGS);
  $('head').append(`<style id="ssr-jss">${PH_MUI_STYLE_TAGS}</style>`);
  $('head').append(PH_LINK_TAGS);
  $('body').append(PH_SCRIPT_TAGS);
  $('body').append(PH_STORE_CONTENT);
  return $.root().html() || '';
});

export default function render() {
  return async (req, res, next) => {
    try {
      const staticRouterContext: StaticRouterContext = {};
      const storesState: StoresState = {};
      const port = req.app.settings.port;
      const requested_url = `${req.protocol}://${req.hostname}${(!port || port == 80 || port == 443) ? '' : (':' + port)}${req.path}`;

      var title = 'ClearFlask';
      var extractor: ChunkExtractor | undefined;
      var muiSheets: ServerStyleSheets | undefined;
      var renderedScreen: string = '';
      var awaitPromises: Array<Promise<any>> = [];
      do {
        extractor = new ChunkExtractor({
          statsFile,
          entrypoints: ['main'],
          publicPath: connectConfig.chunksPublicPath,
          outputPath: path.resolve(__dirname, '..', '..', 'build'),
        });
        muiSheets = new ServerStyleSheets();

        await Promise.all(awaitPromises);
        awaitPromises = [];

        renderedScreen = ReactDOMServer.renderToString(muiSheets.collect(
          <ChunkExtractorManager extractor={extractor}>
            <WindowIsoSsrProvider
              url={requested_url}
              setTitle={newTitle => title = newTitle}
              storesState={storesState}
              awaitPromises={awaitPromises}
            >
              <Main
                ssrLocation={req.url}
                ssrStaticRouterContext={staticRouterContext}
              />
            </WindowIsoSsrProvider>
          </ChunkExtractorManager>
        ));

      } while (awaitPromises.length > 0);

      var html = await indexHtmlPromise;

      // Page title
      html = html.replace(PH_PAGE_TITLE, title);

      // JS, CSS
      html = html.replace(PH_LINK_TAGS, extractor.getLinkTags());
      html = html.replace(PH_STYLE_TAGS, extractor.getStyleTags());
      html = html.replace(PH_SCRIPT_TAGS, extractor.getScriptTags());
      html = html.replace(PH_MUI_STYLE_TAGS, muiSheets.toString());

      // Add rendered html
      html = html.replace(PH_MAIN_SCREEN, reactDom);

      // Add populated stores
      if (Object.keys(StoresState).length > 0) {
        html = html.replace(PH_STORE_CONTENT, `<script>window.__SSR_STORE_INITIAL_STATE__ = ${JSON.stringify(StoresState)};</script>\n</body>`);
      } else {
        html = html.replace(PH_STORE_CONTENT, '');
      }

      res.writeHead(staticRouterContext.statusCode || 200, {
        'Content-Type': 'text/html',
        ...(staticRouterContext.url && { Location: staticRouterContext.url }),
      });
      return res.end(html);

    } catch (e) {
      console.error('Failed to get page', e);
      if (process.env.NODE_ENV !== 'production') {
        res.status(500).end();
      } else {
        // fallback to client-side rendering
        res.status(500);
        res.sendFile(path.join(__dirname, '..', '..', "build", "index.html"));
      }
    }
  };
};
