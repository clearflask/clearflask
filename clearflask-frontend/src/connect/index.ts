import greenlockExpress from 'greenlock-express';
import httpp from 'http-proxy';
import connectConfig from './config';
import httpx from './httpx';
import express from 'express';
import reactRenderer from './react-renderer';
import path from 'path';

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

function worker(glx) {
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
  // app.use(express.static(path.resolve(__dirname, '../public')))
  app.all('/api/*', function (req, res) {
    serverHttpp.web(req, res, {
      target: "http://localhost:8080",
    });
  })
  app.all('/*', reactRenderer());

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
  serverHttp.listen(9080, "0.0.0.0", function() {
    console.info("Http on", serverHttp.address().port);
  });
  serverHttps.listen(9443, "0.0.0.0", function() {
    console.info("Https on", serverHttps.address().port);
  });
}
