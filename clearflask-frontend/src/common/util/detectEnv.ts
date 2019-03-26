
var envCache:Environment|undefined = undefined;
var betaCache:boolean|undefined = undefined;

enum Environment {
  DEVELOPMENT_FRONTEND = 'FRONTEND',
  DEVELOPMENT_LOCAL = 'LOCAL',
  PRODUCTION_GOOGLE_CLOUD = 'PROD',
}

function isBeta():boolean {
  if(betaCache === undefined){
    if(!isProd()) {
      betaCache = true;
    } else {
      betaCache = location.search.substr(1).split("&").includes('beta');
    }
  }
  return betaCache;
}

function detectEnv():Environment {
  if(envCache === undefined) {
    if(location.hostname.match('clearflask.com')) {
      envCache = Environment.PRODUCTION_GOOGLE_CLOUD;
    } else if (!process.env.NODE_ENV || process.env.NODE_ENV === 'development') {
      envCache = Environment.DEVELOPMENT_FRONTEND;
    } else {
      envCache = Environment.DEVELOPMENT_LOCAL;
    }
  }
  return envCache;
}

function isProd():boolean {
  return detectEnv() === Environment.PRODUCTION_GOOGLE_CLOUD;
}

export { isProd, isBeta, detectEnv, Environment };
