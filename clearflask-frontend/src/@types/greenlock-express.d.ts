// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
// From https://git.rootprojects.org/root/greenlock-express.js/issues/50#issue-2750
declare module "greenlock-express" {
    import * as Express from "express";
    import * as Http from "http";
    import * as Http2 from "http2";
    import * as Https from "https";

    function init(options: initOptions & { [key: string]: any }): initReturnFunction & initReturnFunctionCluster

    interface initOptions {
        packageRoot: string;
        configDir: string;
        maintainerEmail: string;
        cluster?: boolean
        workers?: number
    }

    interface initReturnFunction {
        serve(func: (req: Http.IncomingMessage | Http2.Http2ServerRequest, res: Http.ServerResponse | Http2.Http2ServerResponse) => void): void;

        serve(express: Express.Application): void;
    }

    interface initReturnFunctionCluster {
        ready(func: (glx: glx) => void): initReturnFunctionCluster;

        master(func: () => void): initReturnFunctionCluster;
    }

    class glx {
        httpServer(func?: (req: Http.IncomingMessage, res: Http.ServerResponse) => void): Http.Server;

        httpsServer(func?: (req: Http.IncomingMessage, res: Http.ServerResponse) => void): Https.Server
        httpsServer(serverOptions: null | Https.ServerOptions, func: (req: Http.IncomingMessage, res: Http.ServerResponse) => void): Https.Server

        http2Server(func?: (req: Http.IncomingMessage | Http2.Http2ServerRequest, res: Http.ServerResponse | Http2.Http2ServerResponse) => void): Http2.Http2Server
        http2Server(serverOptions: null | Http2.ServerOptions, func: (req: Http.IncomingMessage | Http2.Http2ServerRequest, res: Http.ServerResponse | Http2.Http2ServerResponse) => void): Http2.Http2Server

        serveApp(func: (req: Http.IncomingMessage | Http2.Http2ServerRequest, res: Http.ServerResponse | Http2.Http2ServerResponse) => void): void;

    }
}
