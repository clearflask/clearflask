// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
'use strict';

const { default: connectConfig } = require('../config');
const { default: ServerConnect } = require("../serverConnect");

module.exports.create = function (config) {
	console.log('ClearFlask Greenlock DNS Challenge Started');

	return {
		init: async ({ request }) => {
			console.log('challenge.dns.init');
			return Promise.resolve(null);
		},

		zones: async ({ dnsHosts }) => {
			console.log('challenge.dns.zones', dnsHosts);

			return [connectConfig.parentDomain];
		},

		set: async ({ challenge: { dnsZone, dnsPrefix, dnsHost, keyAuthorizationDigest } }) => {
			console.log('challenge.dns.set', dnsZone, dnsPrefix, dnsHost);

			await ServerConnect.get()
				.dispatch()
				.certChallengeDnsPutConnect(
					{
						host: dnsHost,
						challenge: {
							result: keyAuthorizationDigest,
						},
					},
					undefined,
					{ 'x-cf-connect-token': connectConfig.connectToken });

			return null;
		},

		get: async ({ challenge: { dnsZone, dnsPrefix, dnsHost, keyAuthorizationDigest } }) => {
			console.log('challenge.dns.get', dnsZone, dnsPrefix, dnsHost);

			try {
				const challenge = await ServerConnect.get()
					.dispatch()
					.certChallengeDnsGetConnect(
						{ host: dnsHost },
						undefined,
						{ 'x-cf-connect-token': connectConfig.connectToken });
				console.log('Challenge found for key', key);
				return {
					dnsAuthorization: challenge.result,
				};
			} catch (response) {
				if (response?.status === 404) {
					console.log('Challenge not found for key', key);
					return null;
				}
				console.log('Challenge failed for key', key, response);
				throw response;
			}
		},

		remove: async ({ challenge: { dnsZone, dnsPrefix, dnsHost, keyAuthorizationDigest } }) => {
			console.log('challenge.dns.remove', dnsZone, dnsPrefix, dnsHost);

			await ServerConnect.get()
				.dispatch()
				.certChallengeDnsDeleteConnect(
					{
						host: dnsHost,
						challenge: {
							result: keyAuthorizationDigest,
						},
					},
					undefined,
					{ 'x-cf-connect-token': connectConfig.connectToken });
			return null;
		},
	};
};
