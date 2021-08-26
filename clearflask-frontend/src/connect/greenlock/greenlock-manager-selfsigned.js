// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
"use strict";

const { default: connectConfig } = require('../config');
const selfsignUtil = require('./selfsigned-util');

var Manager = module.exports;

// https://git.rootprojects.org/root/greenlock.js#ssl-certificate-domain-management
Manager.create = function (opts) {
    console.log('SelfSigned Greenlock Manager Started');
    var manager = {};
    const selfsign = selfsignUtil.create();

    manager.get = async function (opts) {
        console.log('manager.get', opts);
        const servername = opts.servername;

        var certblob = await selfsign.getCertificate(servername);

        if (!certblob) { return null; }

        return JSON.parse(certblob);
    };

    manager.set = async function (opts) {
        console.log('manager.set', opts.domain);
        if (opts.domain === undefined) return; // Greenlock sometimes calls us with nothing

        return selfsign.saveCertificate(opts.domain, JSON.stringify({
            cert: pems.cert           // string PEM
            , chain: pems.chain         // string PEM
            , subject: pems.subject     // string name 'example.com
            , altnames: pems.altnames   // Array of string names [ 'example.com', '*.example.com', 'foo.bar.example.com' ]
            , issuedAt: pems.issuedAt   // date number in ms (a.k.a. NotBefore)
            , expiresAt: pems.expiresAt // date number in ms (a.k.a. NotAfter)
        })); // Must return or Promise `null` instead of `undefined`
    };

    //
    // Optional (Fully Automatic Renewal)
    //
    manager.find = async function (opts) {
        console.log('manager.find', opts);
        if (opts.servername) return [await manager.get({ servername: opts.servername })];
        if (opts.servernames) return await Promise.all(opts.servernames.map(servername => manager.get({ servername })));
        return [await manager.get({ servername: connectConfig.parentDomain })];

        // return [{ subject, altnames, renewAt, deletedAt }];
    };

    //
    // Optional (Special Remove Functionality)
    // The default behavior is to set `deletedAt`
    //
    manager.remove = async function (opts) {
        console.log('manager.remove', opts.subject);

        return selfsign.saveCertificate(opts.subject, undefined);
    };

    //
    // Optional (special settings save)
    // Implemented here because this module IS the fallback
    //
    var mconf = {
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
