"use strict";

const { default: ServerConnect } = require("../serverConnect");

var Manager = module.exports;

Manager.create = function (opts) {
    console.log('ClearFlask Greenlock Manager Started');
    var manager = {};

    manager.get = async function (opts) {
        console.log('manager.get', opts);
        try {
            const result = JSON.parse(await ServerConnect.get()
                .dispatch()
                .certGetConnect({ domain: opts.servername })?.json);
            console.log('Manager get found for servername', opts.servername);
            return result;
        } catch (response) {
            if (response === 404) {
                console.log('Manager get not found for servername', opts.servername);
                return null;
            }
            throw response;
        }
    };

    manager.set = async function (opts) {
        console.log('manager.set', opts);
        return await ServerConnect.get()
            .dispatch()
            .certPutConnect({
                domain: opts.domain,
                cert: { json: JSON.stringify(opts) }
            });
    };

    //
    // Optional (Fully Automatic Renewal)
    //
    manager.find = async function (opts) {
        console.log('manager.find', opts);
        // { subject, servernames, altnames, renewBefore }
        if (opts.servername) return await manager.get({ servername: opts.servername });

        return opts.servernames
            ? await Promise.all(opts.servernames.map(servername => manager.get({ servername })))
            : [];

        // return [{ subject, altnames, renewAt, deletedAt }];
    };

    //
    // Optional (Special Remove Functionality)
    // The default behavior is to set `deletedAt`
    //
    /*
    manager.remove = async function(opts) {
        return mfs.remove(opts);
    };
    //*/

    //
    // Optional (special settings save)
    // Implemented here because this module IS the fallback
    //
    /*
    manager.defaults = async function(opts) {
        if (opts) {
            return setDefaults(opts);
        }
        return getDefaults();
    };
    //*/

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
