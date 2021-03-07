/* tslint:disable */
// eslint-disable-next-line no-unused-vars
import { Configuration } from '../runtime';
// eslint-disable-next-line no-unused-vars
import * as SniConnectApi from './SniConnectApi';

export * from './SniConnectApi';

export interface ApiInterface extends SniConnectApi.SniConnectApiInterface {};
export class Api {
    apis: any

    constructor(configuration?:Configuration, apiOverride?:ApiInterface) {
        this.apis = {};
        this.apis.SniConnectApi = apiOverride || new SniConnectApi.SniConnectApi(configuration);
    }

    getSniConnectApi():SniConnectApi.SniConnectApi {
        return this.apis.SniConnectApi;
    }
};
