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
    if (windowIso.ENV === 'development' /* npm run start:dev */) {
      envCache = Environment.DEVELOPMENT_FRONTEND;
    } else if (windowIso.ENV === 'local' /* npm run start:local */) {
      envCache = Environment.DEVELOPMENT_LOCAL;
    } else if (windowIso.ENV === 'selfhost' /* npm run start:local */) {
      envCache = Environment.PRODUCTION_SELF_HOST;
    } else if (process?.env?.NODE_ENV === 'development' /* npm run start:frontend */) {
      envCache = Environment.DEVELOPMENT_FRONTEND;
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

export function isTracking(): boolean {
  return !isDoNotTrack() && isProd();
}

export function isDoNotTrack(): boolean {
  return windowIso.isSsr
    || windowIso.navigator.doNotTrack === "yes"
    || windowIso.navigator.doNotTrack === "1"
    || windowIso.navigator['msDoNotTrack'] === "1"
    || windowIso.doNotTrack === "yes"
    || windowIso.doNotTrack === "1"
    || windowIso['msDoNotTrack'] === "1";
}

