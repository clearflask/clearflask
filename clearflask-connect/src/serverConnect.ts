import fetch from 'node-fetch';
import * as Connect from './api/connect';

class ServerConnect {
  static instance: ServerConnect | undefined;
  readonly dispatcher: Connect.Dispatcher;

  constructor() {
    const apiConf: Connect.ConfigurationParameters = {};
    apiConf.basePath = Connect.BASE_PATH.replace(/https:\/\/clearflask\.com/, `http://localhost:8080`);
    apiConf.fetchApi = fetch;

    this.dispatcher = new Connect.Dispatcher(msg => msg.payload,
      new Connect.Api(new Connect.Configuration(apiConf)));
  }

  static get(): ServerConnect {
    if (ServerConnect.instance === undefined) {
      ServerConnect.instance = new ServerConnect();
    }
    return ServerConnect.instance;
  }

  dispatch(): Connect.Dispatcher {
    return this.dispatcher;
  }
}


export default ServerConnect;