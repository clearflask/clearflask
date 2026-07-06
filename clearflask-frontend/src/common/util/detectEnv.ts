// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import windowIso from '../windowIso';

var envCache: Environment | undefined = undefined;

export enum Environment {
  DEVELOPMENT_FRONTEND = 'FRONTEND',
  DEVELOPMENT_LOCAL = 'LOCAL',
  PRODUCTION = 'PROD',
  PRODUCTION_SELF_HOST = 'PROD_SELF_HOST',
  // Platform-hosting: one-click marketplace appliance (Railway/PikaPods/...). Single-tenant:
  // one project served on the root domain, so no subdomain picking or extra projects. Behaves
  // like self-host otherwise (see isSelfHostLike).
  PRODUCTION_PLATFORM = 'PROD_PLATFORM',
}

export function detectEnv(): Environment {
  if (envCache === undefined) {
    const envVar = windowIso.isSsr
      ? (process.env.ENV || process.env.NODE_ENV)
      : windowIso.ENV;
    if (envVar === 'local') {
      envCache = Environment.DEVELOPMENT_LOCAL;
    } else if (envVar === 'selfhost') {
      envCache = Environment.PRODUCTION_SELF_HOST;
    } else if (envVar === 'platform') {
      envCache = Environment.PRODUCTION_PLATFORM;
    } else if (envVar === 'development' || envVar === 'test' || process?.env?.NODE_ENV === 'development' || process?.env?.NODE_ENV === 'test') {
      const paramsEnv = !!windowIso.location?.href && new URL(windowIso.location.href).searchParams.get('env');
      if (!!paramsEnv && Object.values(Environment).includes(paramsEnv as any)) {
        envCache = paramsEnv as Environment;
      } else {
        envCache = Environment.DEVELOPMENT_FRONTEND;
      }
    } else {
      envCache = Environment.PRODUCTION;
    }
  }
  return envCache;
}

export function isProd(): boolean {
  return detectEnv() === Environment.PRODUCTION
    || isSelfHostLike();
}

/** True for both self-host and platform: single-tenant appliance installs (not our cloud). */
export function isSelfHostLike(): boolean {
  return detectEnv() === Environment.PRODUCTION_SELF_HOST
    || detectEnv() === Environment.PRODUCTION_PLATFORM;
}
