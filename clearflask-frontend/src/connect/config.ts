
export interface ConnectConfig {
  listenPort: number;
  email: string;
  connectToken: string;
  acmeDirectoryUrl?: string,
  workerCount?: number, // Leave blank to match cores
  apiBasePath: string,
}

var configLoaded;
if (process.env.ENV === 'production') {
  const configFile = '/opt/clearflask/connect.config.js';
  try {
    configLoaded = require(configFile).default;
  }
  catch (e) {
    console.info('Failed to load config file', configFile, e);
    throw e;
  }
} else {
  configLoaded = {
    // If changed, also change in config-prod.cfg
    connectToken: '7cb1e1c26f5d4705a213529257d081c6',
    workerCount: 2,
    acmeDirectoryUrl: 'https://acme.staging.localhost:14000/dir',
  };
}

const connectConfig: ConnectConfig = {
  listenPort: 44380,
  chunksDomain: '/',
  email: 'hostmaster@clearflask.com',
  apiBasePath: process.env.ENV === 'local' ? 'http://host.docker.internal:8080' : 'http://localhost:8080',
  ...(configLoaded || {}),
};

export default connectConfig;
