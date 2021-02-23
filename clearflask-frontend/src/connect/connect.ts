import express from 'express';
import fs from 'fs';
import greenlockExpress, { glx } from 'greenlock-express';
import httpp from 'http-proxy';
import path from 'path';
import connectConfig from './config';
import GreenlockClearFlaskManager from './greenlock/greenlock-manager-clearflask';
import httpx from './httpx';
import reactRenderer from './renderer';

function createProxy() {
  const serverHttpp = httpp.createProxyServer({ xfwd: true });
  serverHttpp.on("error", function (err, req, res) {
    console.error(err);
    res.statusCode = 500;
    res.end();
    return;
  });
  return serverHttpp;
}

function createApp(serverHttpp) {
  const serverApp = express();

  if (process.env.ENV !== 'production') {
    serverApp.get("/asset-manifest.json", function (req, res) {
      fs.readFile(path.resolve(__dirname, 'public', 'asset-manifest.json'), 'utf8', (err, data) => {
        if (err) {
          res.sendStatus(404);
        } else {
          res.send(data.replace(/https:\/\/clearflask\.com/g, ''));
        }
      });
    });
  }

  serverApp.use(express.static(path.resolve(__dirname, 'public'), {
    index: false,
  }));

  serverApp.all('/api/*', function (req, res) {
    serverHttpp.web(req, res, {
      target: process.env.ENV !== 'local' ? 'http://localhost:8080' : 'http://host.docker.internal:8080',
    });
  });

  serverApp.all('/*', reactRenderer());

  return serverApp;
}


if (process.env.ENV === 'production' || process.env.ENV === 'test') {
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
      managerInstance: GreenlockClearFlaskManager,
      manager: {
        module: `/WEBPACK_REPLACE_ME_PLEASE/greenlock-manager-clearflask.js`
      },
      store: {
        module: `/WEBPACK_REPLACE_ME_PLEASE/greenlock-store-clearflask.js`
      },
      challenges: {
        "http-01": {
          module: `/WEBPACK_REPLACE_ME_PLEASE/greenlock-challenge-http-clearflask.js`,
        },
      },
      notify: (event, details) => {
        console.log('EVENT:', event, details);
      },
    })
    .ready(function (glx: glx) {
      console.log('Worker Started');

      // App
      const serverHttpp = createProxy();

      // App
      const serverApp = createApp(serverHttpp);

      // Http
      const serverHttp = glx.httpServer();

      // Https
      const serverHttps = glx.httpsServer(null, serverApp);
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
    })
    .master(function () {
      console.log('Master Started');
    });
} else {
  createApp(createProxy()).listen(80, "0.0.0.0", function () {
    console.info("App on", 80);
  });
}
