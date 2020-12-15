
export interface ConnectConfig {
  listenPort: number;
  downstreamUrl: string;
  externalDomain: string;
  email: string;
}

var configLoaded;
try {
  configLoaded = require('/opt/clearflask/connect.config.ts')
}
catch (e) {
}

const connectConfig: ConnectConfig = {
  listenPort: 44380,
  downstreamUrl: 'http://localhost:8080',
  externalDomain: 'clearflask.com',
  email: 'hostmaster@clearflask.com',
  ...(configLoaded || {}),
};

export default connectConfig;
