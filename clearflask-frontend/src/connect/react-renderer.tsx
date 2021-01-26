import path from 'path';
import fs from 'fs';
import { StoresInitialState } from '../Main';
import { StaticRouterContext } from 'react-router';
import { renderCfToString } from './renderer';

// Cache index.html in memory
const indexHtmlPromise: Promise<string> = new Promise((resolve, error) => {
  const filePath = path.resolve(__dirname, '..', '..', 'build', 'index.html');
  fs.readFile(filePath, 'utf8', (err, html) => {
    if(!err) {
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
      const reactDom = renderCfToString(req.url, staticRouterContext, storesInitialState);
      
      res.writeHead(staticRouterContext.statusCode || 200, {
        'Content-Type': 'text/html',
        ...(staticRouterContext.url && { Location: staticRouterContext.url }),
      });

      // Add rendered html
      html.replace('&zwnj;', reactDom);

      // Add populated stores
      if(Object.keys(storesInitialState).length > 0) {
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
