'use strict';

const { default: ServerConnect } = require("../serverConnect");

// TODO https://git.rootprojects.org/root/greenlock-store-memory.js

module.exports.create = function (opts) {
    console.log('ClearFlask Greenlock Store Started');
    const store = {};
    store.options = {};
    store.accounts = {};
    store.certificates = {};


    store.accounts.setKeypair = async (opts) => {
        console.log('accounts.setKeypair:', opts.account, opts.email);
        var id = opts.email || opts.account.id || 'default';
        var keypair = opts.keypair;

        await ServerConnect.get()
            .dispatch()
            .accountKeypairPutConnect({
                id,
                keypair: {
                    privateKeyPem: keypair.privateKeyPem,
                    privateKeyJwkJson: JSON.stringify(keypair.privateKeyJwk),
                },
            });

        return null;
    };

    store.accounts.checkKeypair = async (opts) => {
        console.log('accounts.checkKeypair:', opts.account, opts.email);
        var id = opts.email || opts.account.id || 'default';

        try {
            const keyPair = await ServerConnect.get()
                .dispatch()
                .accountKeypairGetConnect({ id });
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
        console.log('certificates.setKeypair:', opts.certificate, opts.subject);
        var id = opts.subject || opts.certificate.kid || opts.certificate.id;
        var keypair = opts.keypair;

        await ServerConnect.get()
            .dispatch()
            .certKeypairPutConnect({
                id,
                keypair: {
                    privateKeyPem: keypair.privateKeyPem,
                    privateKeyJwkJson: JSON.stringify(keypair.privateKeyJwk),
                },
            });

        return null;
    };

    // You won't be able to use a certificate without it's private key, gotta save it
    store.certificates.checkKeypair = async (opts) => {
        console.log('certificates.checkKeypair:', opts.certificate, opts.subject);
        var id = opts.subject || opts.certificate.kid || opts.certificate.id;

        try {
            const keyPair = await ServerConnect.get()
                .dispatch()
                .certKeypairGetConnect({ id });
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
        console.log('certificates.set:', opts.certificate, opts.subject);
        var id = opts.certificate.id || opts.subject;
        var pems = opts.pems;

        await ServerConnect.get()
            .dispatch()
            .certPutConnect({
                id,
                cert: {
                    cert: pems.cert,
                    chain: pems.chain,
                    subject: pems.subject,
                    altnames: pems.altnames,
                    issuedAt: pems.issuedAt,
                    expiresAt: pems.expiresAt,
                },
            });

        return null;
    };

    // This is actually the first thing to be called after approveDomins(),
    // but it's easiest to implement last since it's not useful until there
    // are certs that can actually be loaded from storage.
    store.certificates.check = async (opts) => {
        console.log('certificates.check:', opts.certificate, opts.subject);
        var id = opts.certificate.id || opts.subject;

        try {
            const cert = await ServerConnect.get()
                .dispatch()
                .certGetConnect({ id });
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
