import { ChunkExtractor, ChunkExtractorManager } from '@loadable/server';
import fs from 'fs';
import path from 'path';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { StaticRouterContext } from 'react-router';
import { WindowIsoSsrProvider } from '../common/windowIso';
import Main, { StoresInitialState } from '../Main';

const statsFile = path.resolve('../dist/loadable-stats.json')

// Cache index.html in memory
const indexHtmlPromise: Promise<string> = new Promise((resolve, error) => {
  const filePath = path.resolve(__dirname, '..', '..', 'build', 'index.html');
  fs.readFile(filePath, 'utf8', (err, html) => {
    if (!err) {
      resolve(html);
    } else {
      error(err);
    }
  });
});

export default function render() {
  return (req, res, next) => {
    indexHtmlPromise.then(html => {
      const staticRouterContext: StaticRouterContext = {};
      const storesInitialState: StoresInitialState = {};
      const port = req.app.settings.port;
      const requested_url = `${req.protocol}://${req.host}${(!port || port == 80 || port == 443) ? '' : (':' + port)}${req.path}`;
      const extractor = new ChunkExtractor({
        statsFile,
        // publicPath: 'https://cdn.example.org/v1.1.0/',
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
      html.replace('</head>', `${extractor.getLinkTags()}\n${extractor.getStyleTags()}\n</head>`);
      html.replace('</body>', `${extractor.getScriptTags()}\n</body>`);

      // Add rendered html
      html.replace('&zwnj;', reactDom);

      // Add populated stores
      if (Object.keys(storesInitialState).length > 0) {
        html.replace('</body>', `<script>window.__SSR_STORE_INITIAL_STATE__ = ${JSON.stringify(storesInitialState)};</script>\n</body>`);
      }

      return res.end(html);
    })
      .catch(e => {
        console.error('Failed to get page', e);
        res.status(500).end()
      });
  };
};
