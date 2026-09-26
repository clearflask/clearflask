// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import * as Sentry from "@sentry/node";
import {Integrations} from "@sentry/tracing";
import cluster from 'cluster';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import express from 'express';
import fs from 'fs';
import http from 'http';
import httpp from 'http-proxy';
import https, {ServerOptions} from 'https';
import i18nextMiddleware from 'i18next-http-middleware';
import MapExpire from 'map-expire/MapExpire';
import path from 'path';
import process from 'process';
import serveStatic from 'serve-static';
import tls, {SecureContext} from 'tls';
import v8 from 'v8';
import {CertGetOrCreateResponse} from "../api/connect";
import {getI18n} from '../i18n-ssr';
import connectConfig from './config';
import httpx from './httpx';
import reactRenderer, {replaceParentDomain} from './renderer';
import ServerConnect from './serverConnect';
import {isBanned, isHostNotFound, normalizeIp, recordHostNotFound, recordStrike} from './banlist';

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
  const serverHttpp = httpp.createProxyServer({
    xfwd: true,
    preserveHeaderKeyCase: true,
  });

  serverHttpp.on('proxyReq', (proxyReq, req, res, options) => {
    if (req.headers.accept === 'text/event-stream') {
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
    }
  });

  serverHttpp.on('error', function (err, req, res: any) {
    console.error(err);
    // This also fires for WebSocket upgrades, where the third argument is a raw
    // socket rather than a response, and for requests whose headers have already
    // gone out — a client that resets mid-response reaches here. Writing a reply
    // in either case throws, and an uncaught throw kills the worker, which by
    // the cluster policy below takes the whole site down with it.
    if (!res || typeof res.writeHead !== 'function' || res.headersSent) {
      res?.destroy?.();
      return;
    }
    res.writeHead(500, { 'Content-Type': 'text/javascript' });
    res.end(JSON.stringify({
      userFacingMessage: 'Oops, something went wrong',
    }));
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
  capacity: 10000,
  duration: 0, // default expiry in millisecond
});
// Servernames whose cert lookup failed on the backend. Without this, a scanner
// enumerating nonexistent subdomains turns every TLS handshake into a backend
// call; with it, repeats are rejected in-memory for a minute.
const certFailureCache = new MapExpire([], {
  capacity: 10000,
  duration: 60 * 1000,
});
const sniCallback: ServerOptions['SNICallback'] = async (servername, callback) => {
  // The parent domain's wildcard cert covers a single label (foo.clearflask.com),
  // so a deeper name (a.b.clearflask.com) can never be served — only subdomain
  // scanners ask for those. Reject before involving the backend.
  const parentSuffix = '.' + connectConfig.parentDomain;
  if (servername.endsWith(parentSuffix)
    && servername.slice(0, -parentSuffix.length).includes('.')) {
    callback(new Error('No certificate found'), null as any);
    return;
  }

  // Get cert
  const wildName = '*.' + servername
    .split('.')
    .slice(1)
    .join('.');
  var secureContext: SecureContext = secureContextCache.get(servername) || secureContextCache.get(wildName);
  if (!secureContext) {
    if (certFailureCache.get(servername)) {
      callback(new Error('No certificate found'), null as any);
      return;
    }
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
      // A 404 is the backend's normal answer for "no project owns this domain":
      // stale customer DNS and subdomain scanners both land here, so it is the
      // common case rather than an error. Log a single line for it and reserve
      // the full response dump for genuinely unexpected failures.
      if (response?.status === 404) {
        console.log('No cert for servername', servername);
      } else {
        console.log('Cert get unknown error for servername', servername, response);
      }
      certFailureCache.set(servername, true);
      callback(new Error('No certificate found'), null as any);
      return;
    }

    // Create secure context
    secureContext = tls.createSecureContext({
      key: certAndKey.keypair.privateKeyPem,
      cert: certAndKey.cert.cert + "\n" + certAndKey.cert.chain,
    });

    // Add to cache under every name the cert covers — including the wildcard
    // altname, so all single-label subdomains share one entry. expiresAt and
    // MapExpire durations are both in milliseconds; cap at one hour.
    const expiresInMs = certAndKey.cert.expiresAt - new Date().getTime();
    const cacheDurationMs = Math.min(60 * 60 * 1000, Math.max(1000, expiresInMs));
    [servername, ...certAndKey.cert.altnames].forEach(altName => secureContextCache.set(
      altName,
      secureContext,
      cacheDurationMs));
  }

  callback(null, secureContext);
}

function addHealthRoute(server, serverApi) {
  server.get('/api/health', function (req, res) {
    serverApi.web(req, res, {
      target: connectConfig.apiBasePath,
    });
  });
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

  serverApp.use((req, res, next) => {
    const ip = normalizeIp(req.socket.remoteAddress);
    if (ip && isBanned(ip)) {
      res.status(429).set('Retry-After', '3600').send('Too Many Requests');
      return;
    }
    const isSubdomain = !!req.hostname && req.hostname !== connectConfig.parentDomain;
    // Exempt /api/ and ACME challenges: they must keep working while a custom
    // domain is being onboarded, before its project is reachable.
    const isExemptPath = req.path.startsWith('/api/') || req.path.startsWith('/.well-known/');
    if (isSubdomain && !isExemptPath) {
      // Only count strikes on top-level page navigations (Accept: text/html),
      // not on /api/ requests, embedded assets, or favicon hits — otherwise an
      // attacker could ban innocent visitors by embedding <img src="https://x.clearflask.com/y.png">.
      const acceptsHtml = (req.headers.accept || '').includes('text/html');
      res.on('finish', () => {
        if (res.statusCode !== 404) return;
        if (ip && acceptsHtml) recordStrike(ip, req.hostname + req.path);
        // A 404 on the root path means no project answers for this hostname —
        // safe to short-circuit the whole host, since every path 404s anyway.
        if (req.path === '/') recordHostNotFound(req.hostname);
      });
      if (isHostNotFound(req.hostname)) {
        res.status(404).set('Cache-Control', 'public, max-age=60').send('Not found');
        return;
      }
    }
    next();
  });

  serverApp.use(cookieParser());
  serverApp.use(compression({
    filter: (req, res) => {
      // Do not compress Server-Sent Events
      if (res.getHeader('Content-Type') === 'text/event-stream') {
        return false;
      }
      return compression.filter(req, res);
    }
  }));

  // Health check and acme challenge before http->https redirect
  addHealthRoute(serverApp, serverApi);
  addAcmeRoute(serverApp);

  // Redirect http to https
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
    });
  } else {
    serverApp.get('/api/openapi.yaml', function (req, res) {
      res.header('Cache-Control', `public, max-age=${7 * 24 * 60 * 60}`);
      res.sendFile(path.resolve(connectConfig.publicPath, 'api', 'openapi.yaml'));
    });
  }

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

if (!connectConfig.disableAutoFetchCertificate) {
  // Spin up cluster
  if (cluster.isMaster) {
    // Cap each worker's heap. Without a cap a leaking worker grows until the
    // kernel swaps the whole host to a standstill and only then OOM-kills it;
    // the site is unreachable for the hour in between. With one, V8 aborts the
    // worker the moment it cannot free enough, and the master replaces it.
    cluster.setupMaster({
      execArgv: [...process.execArgv, `--max-old-space-size=${connectConfig.workerHeapMb}`],
    });

    // Liveness: ping every worker over IPC. A worker whose event loop has
    // stalled — GC thrash near its heap limit, a runaway render — still holds
    // its share of accepted connections, so every request routed to it hangs.
    // The process is alive as far as the cluster is concerned, which is why the
    // exit handler below never fires for it. Kill it and let that handler
    // replace it. The clock starts at fork, so a worker that never comes up
    // at all is caught too.
    const pingIntervalMs = 10 * 1000;
    const pingTimeoutMs = 60 * 1000;
    const lastSeen = new Map<number, number>();
    cluster.on('fork', worker => lastSeen.set(worker.id, Date.now()));
    cluster.on('exit', worker => lastSeen.delete(worker.id));

    // Fork workers
    for (let i = 0; i < Math.max(1, connectConfig.workerCount); i++) {
      cluster.fork();
    }

    setInterval(() => {
      const now = Date.now();
      Object.values(cluster.workers || {}).forEach(worker => {
        if (!worker || worker.isDead() || worker.exitedAfterDisconnect) return;
        const seen = lastSeen.get(worker.id);
        if (seen !== undefined && now - seen > pingTimeoutMs) {
          console.error(`worker ${worker.process.pid} unresponsive for ${Math.round((now - seen) / 1000)}s, killing it`);
          lastSeen.delete(worker.id);
          worker.process.kill('SIGKILL');
          return;
        }
        try {
          worker.send({ type: 'ping' });
        } catch (e) {
          // IPC channel already gone; the exit handler takes it from here.
        }
      });
    }, pingIntervalMs);

    // Rotation: a worker whose memory has crept up asks to be recycled before
    // it hits the cap. Start its replacement first and retire the old worker
    // only once the new one is listening, so capacity never drops. One
    // rotation at a time — under a flood every worker would ask at once, and
    // forking them all simultaneously is its own outage.
    let rotating = false;
    const rotate = (worker: cluster.Worker, reason: string) => {
      if (rotating || worker.isDead() || worker.exitedAfterDisconnect) return;
      rotating = true;
      console.warn(`worker ${worker.process.pid} asked to be recycled (${reason}), starting replacement`);
      const replacement = cluster.fork();
      const finish = (ok: boolean) => {
        replacement.removeListener('listening', onListening);
        replacement.removeListener('exit', onExit);
        rotating = false;
        if (!ok) return;
        console.warn(`worker ${replacement.process.pid} is listening, retiring worker ${worker.process.pid}`);
        if (!worker.isDead()) worker.disconnect();
      };
      const onListening = () => finish(true);
      const onExit = () => finish(false);
      replacement.once('listening', onListening);
      replacement.once('exit', onExit);
    };

    cluster.on('message', (worker, message) => {
      if (message?.type === 'pong') {
        lastSeen.set(worker.id, Date.now());
      } else if (message?.type === 'recycle') {
        rotate(worker, message.reason);
      }
    });

    // Replace a dead worker instead of taking the site down with it. Whatever
    // killed one worker — an unlucky socket, a single bad request — usually has
    // nothing to do with the others, and the connections they are serving do
    // not deserve to be dropped for it.
    //
    // A worker that dies immediately and repeatedly is a different problem: the
    // process cannot start at all (bad config, port already bound), and
    // reforking would spin. Past that point, stop and let the service manager
    // restart the whole thing cleanly.
    const crashWindowMs = 60 * 1000;
    const crashLimit = 10;
    const recentDeaths: number[] = [];

    cluster.on('exit', (worker, code, signal) => {
      if (worker.exitedAfterDisconnect) {
        // Asked to stop, not a fault.
        return;
      }

      const now = Date.now();
      while (recentDeaths.length > 0 && now - recentDeaths[0] > crashWindowMs) {
        recentDeaths.shift();
      }
      recentDeaths.push(now);

      if (recentDeaths.length >= crashLimit) {
        console.error(`worker ${worker.process.pid} died (${signal || code});`
          + ` ${recentDeaths.length} deaths within ${crashWindowMs / 1000}s, giving up`);
        process.exit(42);
      }

      console.warn(`worker ${worker.process.pid} died (${signal || code}), replacing it`);
      cluster.fork();
    });
    console.log(`Master started (${process.env.ENV})`);
  }
  if (cluster.isWorker || process.env.ENV === 'test') {

    // API proxy
    const serverApi = createApiProxy();

    // App
    const serverApp = createApp(serverApi);

    // Http Listener
    const serverHttpListener = express();
    addHealthRoute(serverHttpListener, serverApi)
    addAcmeRoute(serverHttpListener);
    serverHttpListener.use('*', serverApp);

    // Http
    const serverHttp = http.createServer(serverHttpListener);

    // Https
    const serverHttps = https.createServer({
      SNICallback: sniCallback,
    }, serverApp);

    // Http(s)
    const serverHttpx = httpx.createServer(serverHttp, serverHttps);

    // A client vanishing mid-connection — an abandoned TLS handshake, a closed
    // tab, a scanner hanging up — surfaces as an 'error' on the socket. Node
    // throws any 'error' event that has no listener, so a single reset would
    // otherwise take the worker, and with it every other connection this
    // process is serving. These are routine, so drop them silently; faults on
    // the listeners themselves stay visible.
    [serverHttp, serverHttps, serverHttpx].forEach(server => {
      server.on('connection', socket => socket.on('error', () => { }));
      server.on('secureConnection', socket => socket.on('error', () => { }));
      server.on('tlsClientError', () => { });
      server.on('clientError', (err, socket) => socket.destroy());
      server.on('error', err => console.error('Listener error', err));
    });
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

    if (cluster.isWorker) {
      process.on('message', message => {
        if (message?.type === 'ping') process.send?.({ type: 'pong' });
      });

      // Once the master retires this worker, the servers stop accepting and the
      // process exits when its last connection closes — but idle keep-alive
      // sockets and event streams never close on their own. Give in-flight
      // work a grace period, then go.
      cluster.worker.on('disconnect', () => {
        setTimeout(() => process.exit(0), 30 * 1000).unref();
      });

      // Ask for a rotation when the heap has grown into the top quarter of its
      // limit on two consecutive samples (one spike of concurrent renders
      // should not count), or when non-heap memory has ballooned past it.
      // heap_size_limit reflects --max-old-space-size, or V8's default without it.
      const heapLimit = v8.getHeapStatistics().heap_size_limit;
      const recycleHeapAt = heapLimit * 0.75;
      const recycleRssAt = heapLimit * 1.25;
      // The master serves one rotation at a time and drops requests that
      // arrive during another, so keep asking once a minute until retired.
      const sampleIntervalMs = 15 * 1000;
      const minAgeMs = 2 * 60 * 1000;
      const reaskMs = 60 * 1000;
      const startedAt = Date.now();
      const toMb = (bytes: number) => Math.round(bytes / 1024 / 1024);
      let samplesOver = 0;
      let samples = 0;
      let lastRecycleRequestAt = 0;
      setInterval(() => {
        const now = Date.now();
        const { heapUsed, rss } = process.memoryUsage();
        const summary = `heap ${toMb(heapUsed)}MB of ${toMb(heapLimit)}MB, rss ${toMb(rss)}MB`;
        if (++samples % 40 === 0) console.info(`Worker #${cluster.worker.id} memory: ${summary}`);
        samplesOver = (heapUsed > recycleHeapAt || rss > recycleRssAt) ? samplesOver + 1 : 0;
        if (samplesOver >= 2 && now - startedAt > minAgeMs && now - lastRecycleRequestAt > reaskMs) {
          lastRecycleRequestAt = now;
          process.send?.({ type: 'recycle', reason: summary });
        }
      }, sampleIntervalMs).unref();
    }

    console.log(`Worker started #${cluster.isWorker ? cluster.worker.id : 'test'}`);
  }
} else {
  createApp(createApiProxy()).listen(9080, "0.0.0.0", function () {
    console.info(`App on 9080 (${process.env.ENV})`);
  });
}