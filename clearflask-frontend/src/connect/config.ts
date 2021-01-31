import path from 'path';

export interface ConnectConfig {
  listenPort: number;
  email: string;
  connectToken: string;
  chunksPublicPath?: string,
}

const configFile = process.env.NODE_ENV === 'production'
  ? '/opt/clearflask/connect.config.js'
  : path.resolve(__dirname, '..', '..', 'connect.config.dev.js');

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
  ...(configLoaded || {}),
};

export default connectConfig;
