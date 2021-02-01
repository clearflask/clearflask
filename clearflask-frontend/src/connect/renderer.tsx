import { ChunkExtractor, ChunkExtractorManager } from '@loadable/server';
import htmlparser from 'cheerio';
import fs from 'fs';
import path from 'path';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { StaticRouterContext } from 'react-router';
import { WindowIsoSsrProvider } from '../common/windowIso';
import Main, { StoresInitialState } from '../Main';
import connectConfig from './config';

const statsFile = path.resolve(__dirname, '..', '..', 'build', 'loadable-stats.json')


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
  htmlStr = htmlStr.replace('%PUBLIC_URL%', publicUrl)
  const $ = htmlparser.load(htmlStr);
  $('#loader-css').remove();
  $('#loadingScreen').remove();
  return $.root().html() || '';
});

export default function render() {
  return (req, res, next) => {
    indexHtmlPromise.then(html => {
      const staticRouterContext: StaticRouterContext = {};
      const storesInitialState: StoresInitialState = {};
      const port = req.app.settings.port;
      const requested_url = `${req.protocol}://${req.hostname}${(!port || port == 80 || port == 443) ? '' : (':' + port)}${req.path}`;
      const extractor = new ChunkExtractor({
        statsFile,
        entrypoints: ['main'],
        publicPath: connectConfig.chunksPublicPath,
        outputPath: path.resolve(__dirname, '..', '..', 'build'),
      });

      const reactDom = ReactDOMServer.renderToString(
        <ChunkExtractorManager extractor={extractor}>
          <WindowIsoSsrProvider
            url={requested_url}
          >
            <Main
              ssrLocation={req.url}
              ssrStaticRouterContext={staticRouterContext}
              ssrStoresInitialState={storesInitialState}
            />
          </WindowIsoSsrProvider>
        </ChunkExtractorManager>
      );

      res.writeHead(staticRouterContext.statusCode || 200, {
        'Content-Type': 'text/html',
        ...(staticRouterContext.url && { Location: staticRouterContext.url }),
      });

      // Add chunks
      html = html.replace('</head>', `${extractor.getLinkTags()}\n${extractor.getStyleTags()}\n</head>`);
      html = html.replace('</body>', `${extractor.getScriptTags()}\n</body>`);

      // Add rendered html
      html = html.replace('&zwnj;', reactDom);

      // Add populated stores
      if (Object.keys(storesInitialState).length > 0) {
        html = html.replace('</body>', `<script>window.__SSR_STORE_INITIAL_STATE__ = ${JSON.stringify(storesInitialState)};</script>\n</body>`);
      }

      return res.end(html);
    })
      .catch(e => {
        console.error('Failed to get page', e);
        res.status(500).end()
      });
  };
};
