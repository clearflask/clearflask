// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import * as Sentry from "@sentry/node";
import { Integrations } from "@sentry/tracing";
import cluster from 'cluster';
import compression from 'compression';
import express from 'express';
import fs from 'fs';
import greenlockExpress, { glx } from 'greenlock-express';
import http from 'http';
import httpp from 'http-proxy';
import https, { ServerOptions } from 'https';
import i18nextMiddleware from 'i18next-http-middleware';
import MapExpire from 'map-expire/MapExpire';
import path from 'path';
import serveStatic from 'serve-static';
import tls, { SecureContext } from 'tls';
import { CertGetOrCreateResponse } from "../api/connect";
import { getI18n } from '../i18n-ssr';
import connectConfig from './config';
import httpx from './httpx';
import reactRenderer, { replaceParentDomain } from './renderer';
import ServerConnect from './serverConnect';

Sentry.init({
  dsn: "https://600460a790e34b3e884ebe25ed26944d@o934836.ingest.sentry.io/5884409",
  integrations: [new Integrations.Express()],
  tracesSampleRate: 0.1,
  environment: process.env.ENV,
});

const urlsSkipCache = new Set([
  '/index.html',
  '/service-worker.js',
  '/sw.js',
  '/asset-manifest.json',
]);
const apiBasePathWs = connectConfig.apiBasePath.replace(/[a-z]+:\/\//i, 'ws://');

function createApiProxy() {
  const serverHttpp = httpp.createProxyServer({ xfwd: true });
  serverHttpp.on('error', function (err, req, res) {
    console.error(err);
    res.writeHead(500, { 'Content-Type': 'text/javascript' });
    res.end(JSON.stringify({
      userFacingMessage: 'Oops, something went wrong',
    }));
    return;
  });
  return serverHttpp;
}

const cacheReplaceAndSend = {};
function replaceAndSend(res, filePath) {
  if (!!cacheReplaceAndSend[filePath]) {
    res.send(cacheReplaceAndSend[filePath]);
  } else {
    fs.readFile(path.resolve(connectConfig.publicPath, filePath), 'utf8', (err, data) => {
      if (err) {
        res.sendStatus(404);
      } else {
        cacheReplaceAndSend[filePath] = replaceParentDomain(data);
        res.send(cacheReplaceAndSend[filePath]);
      }
    });
  }
}

const secureContextCache = new MapExpire([], {
  capacity: 100,
  duration: 0, // default expiry in millisecond
});
const sniCallback: ServerOptions['SNICallback'] = async (servername, callback) => {
  // Get cert
  const wildName = '*.' + servername
    .split('.')
    .slice(1)
    .join('.');
  var secureContext: SecureContext = secureContextCache.get(servername) || secureContextCache.get(wildName);
  if (!secureContext) {
    var certAndKey: CertGetOrCreateResponse;
    try {
      certAndKey = await ServerConnect.get()
        .dispatch()
        .certGetOrCreateConnect(
          { domain: servername },
          undefined,
          { 'x-cf-connect-token': connectConfig.connectToken });
      console.log('Found cert for servername', servername);
    } catch (response: any) {
      console.log('Cert get unknown error for servername', servername, response);
      callback(new Error('No certificate found'), null as any);
      return;
    }

    // Create secure context
    secureContext = tls.createSecureContext({
      key: certAndKey.keypair.privateKeyPem,
      cert: certAndKey.cert.cert + "\n" + certAndKey.cert.chain,
    });

    // Add to cache
    const expiresInSec = certAndKey.cert.expiresAt - new Date().getTime();
    [servername, ...certAndKey.cert.altnames].forEach(altName => secureContextCache.set(
      servername,
      secureContext,
      Math.min(3600, expiresInSec)));
  }

  callback(null, secureContext);
}

function addAcmeRoute(server) {
  server.get('/.well-known/acme-challenge/:key', async function (req, res) {
    const key = req.params.key;
    try {
      const challenge = await ServerConnect.get()
        .dispatch()
        .certChallengeHttpGetConnect(
          { key },
          undefined,
          { 'x-cf-connect-token': connectConfig.connectToken });
      console.log('Challenge found for key', key);
      res.status(200);
      res.send(challenge.result);
      return;
    } catch (response: any) {
      if (response?.status === 404) {
        res.status(404);
        res.send('Not found');
        console.log('Challenge not found for key', key);
        return;
      }
      console.log('Challenge failed for key', key, response);
      res.status(500);
      res.send('Internal server error');
      throw response;
    }
  }
  );
}

function createApp(serverApi) {
  const serverApp = express();
  const reactRender = reactRenderer();

  serverApp.use(compression());

  if (connectConfig.forceRedirectHttpToHttps) {
    serverApp.set('trust proxy', true);
    serverApp.use((req, res, next) => {
      req.secure ? next() : res.redirect('https://' + req.headers.host + req.url);
    });
  }

  serverApp.get('/robots.txt', async (req, res) => {
    res.header('Cache-Control', 'public, max-age=0');
    var doIndex = true;
    if (req.hostname !== connectConfig.parentDomain) {
      try {
        doIndex = !!(await ServerConnect.get().dispatch().robotsConnect({
          slug: req.hostname,
        }, undefined, {
          'x-cf-connect-token': connectConfig.connectToken,
        })).index;
      } catch (er) {
        console.log('Failed to check robots connect for slug', req.hostname, er);
      }
    }
    res.sendFile(path.resolve(connectConfig.publicPath,
      doIndex ? 'robots.txt' : 'robots-deny.txt'));
  });

  if (connectConfig.parentDomain !== 'clearflask.com') {
    ['asset-manifest.json', 'index.html', 'api/openapi.yaml'].forEach(file => {
      serverApp.get(`/${file}`, function (req, res) {
        replaceAndSend(res, file);
      });
    })
  } else {
    serverApp.get('/api/openapi.yaml', function (req, res) {
      res.header('Cache-Control', `public, max-age=${7 * 24 * 60 * 60}`);
      res.sendFile(path.resolve(connectConfig.publicPath, 'api', 'openapi.yaml'));
    });
  }

  addAcmeRoute(serverApp);

  serverApp.use(serveStatic(connectConfig.publicPath, {
    index: false,
    maxAge: '7d',
    setHeaders: (res, path, stat) => {
      if (urlsSkipCache.has(path)) {
        res.header('Cache-Control', 'public, max-age=0');
      }
    },
  }));

  serverApp.all(/^\/api\/./, function (req, res) {
    serverApi.web(req, res, {
      target: connectConfig.apiBasePath,
    });
  });

  serverApp.use(
    i18nextMiddleware.handle(getI18n())
  );

  serverApp.all('/*', reactRender);

  serverApp.on('error', function (err) {
    console.error('Failed with', err);
  });

  return serverApp;
}

if (!connectConfig.disableAutoFetchCertificate && connectConfig.useGreenlock) {
  greenlockExpress
    .init({
      agreeToTerms: true,
      renewOffset: '-45d',
      renewStagger: '15d',
      packageRoot: process.cwd(),
      configDir: './greenlock.d',
      packageAgent: 'clearflask/1.0',
      maintainerEmail: connectConfig.email,
      subscriberEmail: connectConfig.email,
      cluster: true,
      debug: true,
      workers: connectConfig.workerCount,
      manager: {
        module: connectConfig.isInsideWebpack
          ? '/WEBPACK_REPLACE_ME_PLEASE/greenlock-manager-clearflask.js'
          : './src/connect/greenlock/greenlock-manager-clearflask.js',
      },
      store: {
        module: connectConfig.isInsideWebpack
          ? '/WEBPACK_REPLACE_ME_PLEASE/greenlock-store-clearflask.js'
          : '../../../src/connect/greenlock/greenlock-store-clearflask.js',
      },
      challenges: {
        "http-01": {
          module: connectConfig.isInsideWebpack
            ? '/WEBPACK_REPLACE_ME_PLEASE/greenlock-challenge-http-clearflask.js'
            : '../../../src/connect/greenlock/greenlock-challenge-http-clearflask.js',
        },
        // For now wildcard challenges are disabled
        // "dns-01": {
        //   module: connectConfig.isInsideWebpack
        //     ? '/WEBPACK_REPLACE_ME_PLEASE/greenlock-challenge-dns-clearflask.js'
        //     : '../../../src/connect/greenlock/greenlock-challenge-dns-clearflask.js',
        // },
      },
      notify: (event, details) => {
        console.log('EVENT:', event, details);
      },
    })
    .ready(function (glx: glx) {
      console.log('Worker Started');

      // API proxy
      const serverHttpp = createApiProxy();

      // App
      const serverApp = createApp(serverHttpp);

      // Http
      const serverHttp = glx.httpServer();

      // Https
      const serverHttps = glx.httpsServer(null, serverApp);
      serverHttps.on("upgrade", function (req, socket, head) {
        serverHttpp.ws(req, socket, head, {
          ws: true,
          target: apiBasePathWs,
        });
      });

      // Http(s)
      const serverHttpx = httpx.createServer(serverHttp, serverHttps);
      serverHttpx.listen(connectConfig.listenPort, () => {
        console.info("Http(s) on", connectConfig.listenPort);
      });

      // Servers
      serverHttp.listen(9080, "0.0.0.0", function () {
        console.info("Http on", (serverHttp.address() as any)?.port);
      });
      serverHttps.listen(9443, "0.0.0.0", function () {
        console.info("Https on", (serverHttps.address() as any)?.port);
      });
    })
    .master(function () {
      console.log(`Master Started (${process.env.ENV})`);
    });
} else if (!connectConfig.disableAutoFetchCertificate && !connectConfig.useGreenlock) {
  // Spin up cluster
  if (cluster.isMaster) {
    console.log(`Master ${process.pid} running`);

    // Fork workers
    for (let i = 0; i < Math.max(1, connectConfig.workerCount); i++) {
      cluster.fork();
    }

    cluster.on('exit', (worker, code, signal) => {
      console.log(`worker ${worker.process.pid} died`);
      process.exit(42); // Kill entire cluster if one worker dies
    });
  } else {
    console.log(`Worker ${process.pid} starting`);

    // API proxy
    const serverApi = createApiProxy();

    // App
    const serverApp = createApp(serverApi);

    // ACME challenger
    const serverAcme = express();
    addAcmeRoute(serverAcme);
    serverAcme.use('*', serverApp);

    // Http
    const serverHttp = http.createServer(serverAcme);

    // Https
    const serverHttps = https.createServer({
      SNICallback: sniCallback,
    }, serverApp);

    // Http(s)
    const serverHttpx = httpx.createServer(serverHttp, serverHttps);
    serverHttpx.listen(connectConfig.listenPort, () => {
      console.info("Http(s) on", connectConfig.listenPort);
    });

    // WebSockets
    serverHttpx.on('upgrade', function (req, socket, head) {
      serverApi.ws(req, socket, head, {
        ws: true,
        target: apiBasePathWs,
      });
    });

    // Servers
    serverHttp.listen(9080, "0.0.0.0", function () {
      console.info("Http on", (serverHttp as any).address?.()?.port);
    });
    serverHttps.listen(9443, "0.0.0.0", function () {
      console.info("Https on", (serverHttps as any).address?.()?.port);
    });
  }
} else {
  createApp(createApiProxy()).listen(9080, "0.0.0.0", function () {
    console.info(`App on 9080 (${process.env.ENV})`);
  });
}