// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
//
// Based on https://git.rootprojects.org/root/greenlock-store-memory.js
//
// Copyright 2019 AJ ONeal
// 
// This is open source software; you can redistribute it and/or modify it under the
// terms of either:
// 
//    a) the "MIT License"
//    b) the "Apache-2.0 License"
// 
// MIT License
// 
//    Permission is hereby granted, free of charge, to any person obtaining a copy
//    of this software and associated documentation files (the "Software"), to deal
//    in the Software without restriction, including without limitation the rights
//    to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
//    copies of the Software, and to permit persons to whom the Software is
//    furnished to do so, subject to the following conditions:
// 
//    The above copyright notice and this permission notice shall be included in all
//    copies or substantial portions of the Software.
// 
//    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
//    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
//    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
//    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
//    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
//    OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
//    SOFTWARE.
// 
// Apache-2.0 License Summary
// 
//    Licensed under the Apache License, Version 2.0 (the "License");
//    you may not use this file except in compliance with the License.
//    You may obtain a copy of the License at
// 
//      http://www.apache.org/licenses/LICENSE-2.0
// 
//    Unless required by applicable law or agreed to in writing, software
//    distributed under the License is distributed on an "AS IS" BASIS,
//    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//    See the License for the specific language governing permissions and
//    limitations under the License.
'use strict';

const selfsignUtil = require('./selfsigned-util');

module.exports.create = function (opts) {
    console.log('SelfSigned Greenlock Store Started');
    const store = {};
    store.options = {};
    store.accounts = {};
    store.certificates = {};
    const selfsign = selfsignUtil.create();

    store.accounts.setKeypair = async (opts) => {
        var id = opts?.email || opts?.account?.id || 'default';
        console.log('accounts.setKeypair:', id);
        var keypair = opts.keypair;

        return selfsign.saveKeypair(id, JSON.stringify({
            privateKeyPem: keypair.privateKeyPem // string PEM
            , privateKeyJwk: keypair.privateKeyJwk // object JWK
        })); // Must return or Promise `null` instead of `undefined`
    };

    store.accounts.checkKeypair = async (opts) => {
        var id = opts?.email || opts?.account?.id || 'default';
        console.log('accounts.checkKeypair:', id);

        var keyblob = await selfsign.getKeypair(id);

        if (!keyblob) { return null; }

        return JSON.parse(keyblob);
    };

    // The certificate keypairs (properly named privkey.pem, though sometimes sutpidly called cert.key)
    // https://community.letsencrypt.org/t/what-are-those-pem-files/18402
    // Certificate Keypairs must not be used for Accounts and vice-versamust not be the same as any account keypair
    //
    store.certificates.setKeypair = async (opts) => {
        var id = opts.subject || opts.certificate?.id || opts.certificate?.kid;
        console.log('certificates.setKeypair:', id);
        var keypair = opts.keypair;

        return selfsign.saveKeypair(id, JSON.stringify({
            privateKeyPem: keypair.privateKeyPem // string PEM
            , privateKeyJwk: keypair.privateKeyJwk // object JWK
        })); // Must return or Promise `null` instead of `undefined`

    };

    // You won't be able to use a certificate without it's private key, gotta save it
    store.certificates.checkKeypair = async (opts) => {
        var id = opts.subject || opts.certificate?.id || opts.certificate?.kid;
        console.log('certificates.checkKeypair:', id);

        const keyblob = await selfsign.getKeypair(id);
        if (!keyblob) { return null; }

        return JSON.parse(keyblob);
    };


    // And you'll also need to save certificates. You may find the metadata useful to save
    // (perhaps to delete expired keys), but the same information can also be redireved from
    // the key using the "cert-info" package.
    store.certificates.set = async (opts) => {
        var id = opts.subject || opts.certificate?.id;
        console.log('certificates.set:', id);
        var pems = opts.pems;

        return selfsign.saveCertificate(id, JSON.stringify({
            cert: pems.cert           // string PEM
            , chain: pems.chain         // string PEM
            , subject: pems.subject     // string name 'example.com
            , altnames: pems.altnames   // Array of string names [ 'example.com', '*.example.com', 'foo.bar.example.com' ]
            , issuedAt: pems.issuedAt   // date number in ms (a.k.a. NotBefore)
            , expiresAt: pems.expiresAt // date number in ms (a.k.a. NotAfter)
        })); // Must return or Promise `null` instead of `undefined`
    };

    // This is actually the first thing to be called after approveDomins(),
    // but it's easiest to implement last since it's not useful until there
    // are certs that can actually be loaded from storage.
    store.certificates.check = async (opts) => {
        var id = opts.subject || opts.certificate?.id;
        console.log('certificates.check:', id);

        var certblob = await selfsign.getCertificate(id);

        if (!certblob) { return null; }

        return JSON.parse(certblob);
    };

    return store;
};
