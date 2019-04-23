import React from 'react';
import * as Client from './client';
import * as Admin from './admin';
import { Server } from './server';

export default class ServerAdmin {
  readonly apiOverride?:Client.ApiInterface&Admin.ApiInterface;
  readonly projectIdToServer:{[projectId:string]:Server} = {};
  readonly dispatcherClient:Client.Dispatcher;
  readonly dispatcherAdmin:Promise<Admin.Dispatcher>;

  constructor(apiOverride?:Client.ApiInterface&Admin.ApiInterface) {
    this.apiOverride = apiOverride;
    const dispatchers = Server.getDispatchers(this._dispatch.bind(this), apiOverride);
    this.dispatcherClient = dispatchers.client;
    this.dispatcherAdmin = dispatchers.adminPromise;
  }

  getServers():Server[] {
    return Object.values(this.projectIdToServer);
  }

  dispatch(projectId?:string):Client.Dispatcher {
    return projectId === undefined ? this.dispatcherClient : this.projectIdToServer[projectId].dispatch();
  }

  dispatchAdmin(projectId?:string):Promise<Admin.Dispatcher> {
    return projectId === undefined ? this.dispatcherAdmin : this.projectIdToServer[projectId].dispatchAdmin();
  }

  createServer(projectId:string):Server {
    if(!this.projectIdToServer[projectId]) {
      this.projectIdToServer[projectId] = new Server(projectId, this.apiOverride);
    }
    return this.projectIdToServer[projectId];
  }

  async _dispatch(msg:any):Promise<any>{
    return await msg.payload;
  }
}
