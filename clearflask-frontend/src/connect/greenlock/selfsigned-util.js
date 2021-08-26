// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
'use strict';

const selfsigned = require('selfsigned');
const keypairs = require('keypairs');

var instance;
const create = function () {
    console.log('SelfSigned Util Started');
    const store = {};

    async function generateKeypair() {
        console.log('Generating keypair');
        const jwk = await keypairs.generate({
            kty: 'RSA',
            modulusLength: 2048,
        });
        const pem = await keypairs.export({
            jwk: jwk.private,
            encoding: 'pem',
        });
        const keypair = {
            privateKeyPem: pem,
            privateKeyJwk: jwk.private,
        };
        return JSON.stringify(keypair);
    }

    async function generateCertificate(id) {
        console.log('Generating self-signed cert for', id);
        const keypair = JSON.parse(await store.getKeypair());
        const publicKeyPem = await keypairs.export({
            jwk: keypair.privateKeyJwk,
            encoding: 'pem',
            public: true,
        });
        const pems = selfsigned.generate({
            name: id,
            value: id,
        }, {
            days: 365,
            keyPair: {
                publicKey: publicKeyPem,
                privateKey: keypair.privateKeyPem,
            },
        });
        const certificateBlob = JSON.stringify({
            cert: pems.cert,
            chain: undefined,
            subject: id,
            altnames: [id],
            issuedAt: new Date(Date.now() - 60 * 1000).valueOf(),
            expiresAt: new Date(Date.now() + (365 * 24 * 60 * 60 * 1000)).valueOf(),
        });
        store.saveCertificate(id, certificateBlob);

        return certificateBlob;
    }

    const cache = {
        accounts: {},
        certificates: {},
        keypair: undefined,
    };

    store.saveCertificate = (id, blob) => { cache.certificates[id] = blob; return null; }
    store.getCertificate = async (id) => {
        var certBlob = cache.certificates[id];
        if (!certBlob) certBlob = await generateCertificate(id);
        return certBlob;
    }
    store.saveKeypair = (id, blob) => { return null; }
    store.getKeypair = async (id) => {
        if (!cache.keypair) cache.keypair = await generateKeypair();
        return cache.keypair;
    }

    return store;
};

module.exports.create = function () {
    if (!instance) instance = create();
    return instance;
}