// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import fs from 'fs';
import path from 'path';
import selfHostDeafaultConfigFile from '../connect.config.selfhost.json';
import os from 'os';

const configFile = '/opt/clearflask/connect.config.json';

export interface ConnectConfig {
  listenPort: number;
  email: string;
  connectToken: string;
  acmeDirectoryUrl?: string,
  workerCount: number, // Leave blank to match cores
  apiBasePath: string,
  parentDomain: string,
  publicPath: string;
  isInsideWebpack?: boolean;
  disableAutoFetchCertificate?: boolean;
  // Only if disableAutoFetchCertificate is true,
  // whether to still redirect and assume https
  forceRedirectHttpToHttps?: boolean;
  // Please just don't
  useGreenlock?: boolean;
}

var connectConfig: ConnectConfig = {
  listenPort: 44380,
  email: 'hostmaster@clearflask.com',
  workerCount: os.cpus().length,
  apiBasePath: 'http://localhost:8080',
  parentDomain: 'clearflask.com',
  connectToken: 'EMPTY',
  publicPath: path.resolve(__dirname, 'public'),
  disableAutoFetchCertificate: process.env.ENV === 'development',
  forceRedirectHttpToHttps: process.env.ENV !== 'development',
  useGreenlock: true,
};

if (process.env.ENV === 'production'
  || process.env.ENV === 'selfhost'
  || process.env.ENV === 'local') {

  // Create config if doesn't exist
  if (!!process.env.CLEARFLASK_CREATE_CONNECT_CONFIG_IF_MISSING
    && process.env.ENV === 'selfhost') {
    try {
      fs.statSync(configFile);
    } catch (err: any) {
      if (err?.code === 'ENOENT') {
        fs.writeFileSync(
          configFile,
          JSON.stringify(selfHostDeafaultConfigFile, null, 4));
        console.log('Config file does not exist, creating it');
      } else {
        console.log('Failed reading config file', err.code);
      }
    }
  }

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
