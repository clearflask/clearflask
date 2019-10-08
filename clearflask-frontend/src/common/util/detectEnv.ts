
var envCache:Environment|undefined = undefined;
var betaCache:boolean|undefined = undefined;

enum Environment {
  DEVELOPMENT_FRONTEND = 'FRONTEND',
  DEVELOPMENT_LOCAL = 'LOCAL',
  PRODUCTION = 'PROD',
}

function isBeta():boolean {
  if(betaCache === undefined){
    if(!isProd()) {
      betaCache = true;
    } else {
      betaCache = window.location.search.substr(1).split("&").includes('beta');
    }
  }
  return betaCache;
}

function detectEnv():Environment {
  if(envCache === undefined) {
    if(window.location.hostname.match('clearflask.com')) {
      envCache = Environment.PRODUCTION;
    } else if (!process.env.NODE_ENV || process.env.NODE_ENV === 'development') {
      envCache = Environment.DEVELOPMENT_FRONTEND;
    } else {
      envCache = Environment.DEVELOPMENT_LOCAL;
    }
  }
  return envCache;
}

function isProd():boolean {
  return detectEnv() === Environment.PRODUCTION;
}

export { isProd, isBeta, detectEnv, Environment };
