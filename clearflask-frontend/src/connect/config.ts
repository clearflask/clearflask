// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
import fs from 'fs';
import path from 'path';

const configFile = '/opt/clearflask/connect.config.json';

export interface ConnectConfig {
  listenPort: number;
  email: string;
  connectToken: string;
  acmeDirectoryUrl?: string,
  workerCount?: number, // Leave blank to match cores
  apiBasePath: string,
  parentDomain: string,
  publicPath: string;
  isInsideWebpack?: boolean;
  disableAutoFetchCertificate?: boolean;
  // Only if disableAutoFetchCertificate is true,
  // whether to still redirect and assume https
  forceRedirectHttpToHttps?: boolean;
}

var connectConfig: ConnectConfig = {
  listenPort: 44380,
  email: 'hostmaster@clearflask.com',
  apiBasePath: 'http://localhost:8080',
  parentDomain: 'clearflask.com',
  connectToken: 'EMPTY',
  publicPath: path.resolve(__dirname, 'public'),
  disableAutoFetchCertificate: process.env.ENV === 'development',
  forceRedirectHttpToHttps: process.env.ENV !== 'development',
};

if (process.env.ENV === 'production'
  || process.env.ENV === 'selfhost'
  || process.env.ENV === 'local') {
  try {
    const configLoaded = JSON.parse(fs.readFileSync(configFile, 'utf8'));
    connectConfig = {
      ...connectConfig,
      isInsideWebpack: true,
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
    isInsideWebpack: false,
    workerCount: 2,
    parentDomain: 'localhost',
    publicPath: path.resolve(__dirname, '..', '..', 'target', 'public'),
  };
}

export default connectConfig;
