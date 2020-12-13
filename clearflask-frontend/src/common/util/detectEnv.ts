import windowIso from "../windowIso";

var envCache: Environment | undefined = undefined;

enum Environment {
  SSR = 'SSR',
  DEVELOPMENT_FRONTEND = 'FRONTEND',
  DEVELOPMENT_LOCAL = 'LOCAL',
  PRODUCTION = 'PROD',
}

function detectEnv(): Environment {
  if (envCache === undefined) {
    if (windowIso.isSsr) {
      envCache = Environment.SSR;
    } else if (windowIso.location.host.match('clearflask.com')) {
      envCache = Environment.PRODUCTION;
    } else if (!process.env.NODE_ENV || process.env.NODE_ENV === 'development') {
      envCache = Environment.DEVELOPMENT_FRONTEND;
    } else {
      envCache = Environment.DEVELOPMENT_LOCAL;
    }
  }
  return envCache;
}

function isProd(): boolean {
  return detectEnv() === Environment.PRODUCTION;
}

function isTracking(): boolean {
  return !isDoNotTrack() && isProd();
}

function isDoNotTrack(): boolean {
  return navigator.doNotTrack === "yes" || navigator.doNotTrack === "1" || navigator['msDoNotTrack'] === "1" || window.doNotTrack === "yes" || window.doNotTrack === "1" || window['msDoNotTrack'] === "1";
}

export { isProd, isTracking, detectEnv, Environment };

