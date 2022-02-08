// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
import windowIso from "../windowIso";

var envCache: Environment | undefined = undefined;

export enum Environment {
  DEVELOPMENT_FRONTEND = 'FRONTEND',
  DEVELOPMENT_LOCAL = 'LOCAL',
  PRODUCTION = 'PROD',
  PRODUCTION_SELF_HOST = 'PROD_SELF_HOST',
}

export function detectEnv(): Environment {
  if (envCache === undefined) {
    if (windowIso.ENV === 'local') {
      envCache = Environment.DEVELOPMENT_LOCAL;
    } else if (windowIso.ENV === 'selfhost') {
      envCache = Environment.PRODUCTION_SELF_HOST;
    } else if (windowIso.ENV === 'development' || process?.env?.NODE_ENV === 'development') {
      const paramsEnv = new URL(windowIso.location.href).searchParams.get('env');
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
    || detectEnv() === Environment.PRODUCTION_SELF_HOST;
}
