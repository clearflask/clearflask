import path from 'path';

export interface ConnectConfig {
  listenPort: number;
  email: string;
  connectToken: string;
  chunksPublicPath?: string,
  distPath: string,
  acmeDirectoryUrl?: string,
  workerCount?: number, // Leave blank to match cores
  apiBasePath: string,
}

const configFile = process.env.NODE_ENV === 'test'
  ? path.resolve(__dirname, '..', '..', 'connect.config.dev.js')
  : '/opt/clearflask/connect.config.js';

var configLoaded;
try {
  configLoaded = require(configFile).default;
}
catch (e) {
  console.info('Failed to load config file', configFile, e);
  throw e;
}

const connectConfig: ConnectConfig = {
  listenPort: 44380,
  chunksDomain: '/',
  email: 'hostmaster@clearflask.com',
  apiBasePath: process.env.ENV === 'local' ? 'http://host.docker.internal:8080' : 'http://localhost:8080',
  distPath: path.join(__dirname, '..', '..',
    (process.env.ENV === 'production' || process.env.ENV === 'local') ? 'dist' : 'dist-dev'),
  ...(configLoaded || {}),
};

export default connectConfig;
