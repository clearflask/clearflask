// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
const fs = require('fs');

const configFile = '/opt/clearflask/connect.config.json';

export interface ConnectConfig {
  listenPort: number;
  email: string;
  connectToken: string;
  acmeDirectoryUrl?: string,
  workerCount?: number, // Leave blank to match cores
  apiBasePath: string,
  parentDomain: string,
}

var connectConfig: ConnectConfig = {
  listenPort: 44380,
  email: 'hostmaster@clearflask.com',
  apiBasePath: process.env.ENV === 'local' ? 'http://clearflask-server:8080' : 'http://localhost:8080',
  parentDomain: 'clearflask.com',
  connectToken: 'EMPTY',
};

if (process.env.ENV === 'production') {
  try {
    const configLoaded = JSON.parse(fs.readFileSync(configFile));
    connectConfig = {
      ...connectConfig,
      ...(configLoaded || {}),
    };
  }
  catch (e) {
    console.info('Failed to load config file', configFile, e);
    throw e;
  }
} else {
  connectConfig = {
    ...connectConfig,
    // If changed, also change in config-prod.cfg
    connectToken: '7cb1e1c26f5d4705a213529257d081c6',
    workerCount: 2,
    acmeDirectoryUrl: 'https://acme.staging.localhost:14000/dir',
    parentDomain: 'localhost.com',
  };
}

export default connectConfig;
