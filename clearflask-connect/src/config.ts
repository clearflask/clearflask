
export interface ConnectConfig {
  listenPort: number;
  downstreamUrl: string;
  externalDomain: string;
  email: string;
  connectToken: string;
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
  connectToken: '7cb1e1c26f5d4705a213529257d081c6',
  ...(configLoaded || {}),
};

export default connectConfig;
