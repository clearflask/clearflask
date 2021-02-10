"use strict";

const { default: connectConfig } = require('../config');
const { default: ServerConnect } = require("../serverConnect");

var Manager = module.exports;

// https://git.rootprojects.org/root/greenlock.js#ssl-certificate-domain-management
Manager.create = function (opts) {
    console.log('ClearFlask Greenlock Manager Started');
    var manager = {};

    manager.get = async function (opts) {
        console.log('manager.get', opts);
        try {
            const result = await ServerConnect.get()
                .dispatch()
                .certGetConnect(
                    { domain: opts.servername },
                    undefined,
                    { 'x-cf-connect-token': connectConfig.connectToken });
            console.log('Manager get found for servername', opts.servername);
            return result;
        } catch (response) {
            if (response.status === 404) {
                console.log('Manager get not found for servername', opts.servername);
                // Tell Greenlock to create one 
                return {
                    subject: opts.servername,
                    altnames: [opts.servername],
                };
            }
            if (response.status === 401) {
                console.log('Manager get not allowed for servername', opts.servername);
                // Tell Greenlock to not bother
                return null;
            }
            console.log('Manager get unknown error for servername', opts.servername, response);
            throw response;
        }
    };

    manager.set = async function (opts) {
        console.log('manager.set', opts.domain);
        await ServerConnect.get()
            .dispatch()
            .certPutConnect(
                {
                    domain: opts.domain,
                    cert: {
                        cert: opts.cert,
                        chain: opts.chain,
                        subject: opts.domain,
                        altnames: opts.altnames,
                        issuedAt: opts.issuedAt,
                        expiresAt: opts.expiresAt,
                    }
                },
                undefined,
                { 'x-cf-connect-token': connectConfig.connectToken });
        return null;
    };

    //
    // Optional (Fully Automatic Renewal)
    //
    manager.find = async function (opts) {
        console.log('manager.find', opts);
        if (opts.servername) return [await manager.get({ servername: opts.servername })];
        if (opts.servernames) return await Promise.all(opts.servernames.map(servername => manager.get({ servername })));
        return []; // TODO implement warming up cache

        // return [{ subject, altnames, renewAt, deletedAt }];
    };

    //
    // Optional (Special Remove Functionality)
    // The default behavior is to set `deletedAt`
    //
    manager.remove = async function (opts) {
        console.log('manager.remove', opts.subject);
        await ServerConnect.get()
            .dispatch()
            .certDeleteConnect(
                {
                    domain: opts.subject,
                },
                undefined,
                { 'x-cf-connect-token': connectConfig.connectToken });
        return null;
    };

    //
    // Optional (special settings save)
    // Implemented here because this module IS the fallback
    //
    var mconf = {
        directoryUrl: connectConfig.acmeDirectoryUrl,
    };
    manager.defaults = async function (conf) {
        if (conf) {
            mconf = {
                ...mconf,
                ...conf,
            };
        }
        return mconf;
    };

    //
    // Optional (for common deps and/or async initialization)
    //
    /*
    manager.init = async function(deps) {
        manager.request = deps.request;
        return null;
    };
    //*/

    return manager;
};
