// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import fs from 'fs';
import os from 'os';
import path from 'path';
import selfHostDeafaultConfigFile from '../connect.config.selfhost.json';

const configFile = '/opt/clearflask/connect.config.json';

export interface ConnectConfig {
  listenPort: number;
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
  // OAuth client IDs for integrations
  gitlabClientId?: string;
  jiraClientId?: string;
  slackClientId?: string;
}

var connectConfig: ConnectConfig = {
  listenPort: 44380,
  workerCount: os.cpus().length,
  apiBasePath: 'http://localhost:8080',
  parentDomain: 'clearflask.com',
  connectToken: 'EMPTY',
  publicPath: path.resolve(__dirname, 'public'),
  disableAutoFetchCertificate: process.env.ENV === 'development',
  forceRedirectHttpToHttps: process.env.ENV !== 'development',
};

if (process.env.ENV === 'production'
  || process.env.ENV === 'selfhost'
  || process.env.ENV === 'platform'
  || process.env.ENV === 'local') {

  // Create config if doesn't exist
  if (!!process.env.CLEARFLASK_CREATE_CONNECT_CONFIG_IF_MISSING
    && (process.env.ENV === 'selfhost' || process.env.ENV === 'platform')) {
    try {
      fs.statSync(configFile);
    } catch (err: any) {
      if (err?.code === 'ENOENT') {
        // Ensure the parent dir exists — on batteries-included platform hosts
        // (e.g. Railway) /opt/clearflask is not pre-created, so a bare
        // writeFileSync would throw ENOENT and crash Connect on first boot.
        fs.mkdirSync(path.dirname(configFile), { recursive: true });
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

  // Environment variables override the config file; mirrors CLEARFLASK_* handling
  // on the server side (SelfHostConfigBootstrap) for env-configured platforms.
  const envString = (name: string): string | undefined => process.env[name] || undefined;
  const envBoolean = (name: string): boolean | undefined => {
    const value = process.env[name];
    if (value === undefined || value === '') return undefined;
    return value === '1' || value.toLowerCase() === 'true';
  };
  const envNumber = (name: string): number | undefined => {
    const value = process.env[name];
    if (value === undefined || value === '') return undefined;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? undefined : parsed;
  };
  const envOverrides: Partial<ConnectConfig> = {
    connectToken: envString('CLEARFLASK_CONNECT_TOKEN'),
    parentDomain: envString('CLEARFLASK_DOMAIN'),
    apiBasePath: envString('CLEARFLASK_API_BASE_PATH'),
    listenPort: envNumber('CLEARFLASK_LISTEN_PORT'),
    disableAutoFetchCertificate: envBoolean('CLEARFLASK_DISABLE_AUTO_FETCH_CERTIFICATE'),
    forceRedirectHttpToHttps: envBoolean('CLEARFLASK_FORCE_REDIRECT_HTTPS'),
  };
  Object.entries(envOverrides).forEach(([key, value]) => {
    if (value !== undefined) {
      (connectConfig as any)[key] = value;
    }
  });
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
