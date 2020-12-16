'use strict';

const { default: connectConfig } = require('../config');
const { default: ServerConnect } = require("../serverConnect");

// TODO https://git.rootprojects.org/root/greenlock-store-memory.js

module.exports.create = function (opts) {
    console.log('ClearFlask Greenlock Store Started');
    const store = {};
    store.options = {};
    store.accounts = {};
    store.certificates = {};


    store.accounts.setKeypair = async (opts) => {
        var id = opts?.email || opts?.account?.id || 'default';
        console.log('accounts.setKeypair:', id);
        var keypair = opts.keypair;

        await ServerConnect.get()
            .dispatch()
            .accountKeypairPutConnect(
                {
                    id,
                    keypair: {
                        privateKeyPem: keypair.privateKeyPem,
                        privateKeyJwkJson: JSON.stringify(keypair.privateKeyJwk),
                    },
                },
				undefined,
				{'x-cf-connect-token': connectConfig.connectToken});

        return null;
    };

    store.accounts.checkKeypair = async (opts) => {
        var id = opts?.email || opts?.account?.id || 'default';
        console.log('accounts.checkKeypair:', id);

        try {
            const keypair = await ServerConnect.get()
                .dispatch()
                .accountKeypairGetConnect(
                    { id },
                    undefined,
                    {'x-cf-connect-token': connectConfig.connectToken});
            return {
                privateKeyPem: keypair.privateKeyPem,
                privateKeyJwk: JSON.parse(keypair.privateKeyJwkJson),
            };
        } catch (response) {
            if (response?.status === 404) {
                return null;
            }
            throw response;
        }
    };

    // We can optionally implement ACME account storage and retrieval
    // (to reduce API calls), but it's really not necessary.
    /*
      store.accounts.set = function (opts) {
        console.log('accounts.set:', opts);
        return null;
      };
      store.accounts.check = function (opts) {
        var id = opts.account.id || opts.email || 'default';
        console.log('accounts.check:', opts);
        return null;
      };
    */


    // The certificate keypairs (properly named privkey.pem, though sometimes sutpidly called cert.key)
    // https://community.letsencrypt.org/t/what-are-those-pem-files/18402
    // Certificate Keypairs must not be used for Accounts and vice-versamust not be the same as any account keypair
    //
    store.certificates.setKeypair = async (opts) => {
        var id = opts.subject || opts.certificate?.id || opts.certificate?.kid;
        console.log('certificates.setKeypair:', id);
        var keypair = opts.keypair;

        await ServerConnect.get()
            .dispatch()
            .certKeypairPutConnect(
                    {
                    id,
                    keypair: {
                        privateKeyPem: keypair.privateKeyPem,
                        privateKeyJwkJson: JSON.stringify(keypair.privateKeyJwk),
                    },
                },
				undefined,
				{'x-cf-connect-token': connectConfig.connectToken});

        return null;
    };

    // You won't be able to use a certificate without it's private key, gotta save it
    store.certificates.checkKeypair = async (opts) => {
        var id = opts.subject || opts.certificate?.id || opts.certificate?.kid;
        console.log('certificates.checkKeypair:', id);

        try {
            const keyPair = await ServerConnect.get()
                .dispatch()
                .certKeypairGetConnect(
                    { id },
                    undefined,
                    {'x-cf-connect-token': connectConfig.connectToken});
            return {
                privateKeyPem: keypair.privateKeyPem,
                privateKeyJwk: JSON.parse(keypair.privateKeyJwkJson),
            };
        } catch (response) {
            if (response?.status === 404) {
                return null;
            }
            throw response;
        }
    };


    // And you'll also need to save certificates. You may find the metadata useful to save
    // (perhaps to delete expired keys), but the same information can also be redireved from
    // the key using the "cert-info" package.
    store.certificates.set = async (opts) => {
        var id = opts.subject || opts.certificate?.id;
        console.log('certificates.set:', id);
        var pems = opts.pems;

        await ServerConnect.get()
            .dispatch()
            .certPutConnect(
                {
                    domain: id,
                    cert: {
                        cert: pems.cert,
                        chain: pems.chain,
                        subject: pems.subject,
                        altnames: pems.altnames,
                        issuedAt: pems.issuedAt,
                        expiresAt: pems.expiresAt,
                    },
                },
				undefined,
				{'x-cf-connect-token': connectConfig.connectToken});

        return null;
    };

    // This is actually the first thing to be called after approveDomins(),
    // but it's easiest to implement last since it's not useful until there
    // are certs that can actually be loaded from storage.
    store.certificates.check = async (opts) => {
        var id = opts.subject || opts.certificate?.id;
        console.log('certificates.check:', id);

        try {
            const cert = await ServerConnect.get()
                .dispatch()
                .certGetConnect(
                    { domain: id },
                    undefined,
                    {'x-cf-connect-token': connectConfig.connectToken});
            return {
                cert: cert.cert,
                chain: cert.chain,
                subject: cert.subject,
                altnames: cert.altnames,
                issuedAt: cert.issuedAt,
                expiresAt: cert.expiresAt,
            };
        } catch (response) {
            if (response?.status === 404) {
                return null;
            }
            throw response;
        }
    };

    return store;
};
