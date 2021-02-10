import express from 'express';
import fs from 'fs';
import greenlockExpress, { glx } from 'greenlock-express';
import httpp from 'http-proxy';
import path from 'path';
import connectConfig from './config';
import httpx from './httpx';
import reactRenderer from './renderer';

greenlockExpress
  .init({
    agreeToTerms: true,
    renewOffset: "-45d",
    renewStagger: "15d",
    packageRoot: process.cwd(),
    configDir: './greenlock.d',
    packageAgent: 'clearflask/1.0',
    maintainerEmail: connectConfig.email,
    subscriberEmail: connectConfig.email,
    cluster: true,
    debug: true,
    workers: connectConfig.workerCount,
    manager: {
      module: `${process.cwd()}/src/connect/greenlock/greenlock-manager-clearflask.js`
    },
    store: {
      module: `${process.cwd()}/src/connect/greenlock/greenlock-store-clearflask.js`
    },
    challenges: {
      "http-01": {
        module: `${process.cwd()}/src/connect/greenlock/greenlock-challenge-http-clearflask.js`,
      },
    },
    notify: (event, details) => {
      console.log('EVENT:', event, details);
    },
  })
  .ready(worker)
  .master(function () {
    console.log('Master Started');
  });

function worker(glx: glx) {
  console.log('Worker Started');

  // Proxy
  const serverHttpp = httpp.createProxyServer({ xfwd: true });
  serverHttpp.on("error", function (err, req, res) {
    console.error(err);
    res.statusCode = 500;
    res.end();
    return;
  });

  // App
  const app = express();
  if (process.env.ENV !== 'production') {
    app.get("/asset-manifest.json", function (req, res) {
      fs.readFile(path.join(connectConfig.distPath, 'asset-manifest.json'), 'utf8', (err, data) => {
        if (err) {
          res.sendStatus(404);
        } else {
          res.send(data.replace(/https:\/\/clearflask\.com/g, ''));
        }
      });
    });
  }
  app.use(express.static(connectConfig.distPath, {
    index: false,
  }));
  app.all('/api/*', function (req, res) {
    serverHttpp.web(req, res, {
      target: "http://localhost:8080",
    });
  })
  app.all('/*', reactRenderer());
  if (process.env.ENV !== 'production') {
    app.listen(9081, () => {
      console.info("App on", 9081);
    });
  }

  // Http
  const serverHttp = glx.httpServer();

  // Https
  const serverHttps = glx.httpsServer(null, app);
  serverHttps.on("upgrade", function (req, socket, head) {
    serverHttpp.ws(req, socket, head, {
      ws: true,
      target: "ws://localhost:8080"
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
}
