// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
'use strict';

const { default: connectConfig } = require('../config');
const { default: ServerConnect } = require("../serverConnect");

module.exports.create = function (config) {
	console.log('ClearFlask Greenlock Http Challenge Started');

	return {
		init: function (opts) {
			console.log('challenge.http.init', opts);
			return Promise.resolve(null);
		},

		// data: { challenge: {
		// 	 type: 'http-01'
		//   , identifier: { type: 'dns', value: 'example.com' }
		//   , wildcard: false
		//   , expires: '2012-01-01T12:00:00.000Z'
		//   , token: 'abc123'
		//   , thumbprint: '<<account key thumbprint>>'
		//   , keyAuthorization: 'abc123.xxxx'
		//   , dnsHost: '_acme-challenge.example.com'
		//   , dnsAuthorization: 'yyyy'
		//   , altname: 'example.com'
		//   }
		// }		
		set: async (data) => {
			var ch = data.challenge;
			var key = ch.identifier.value + '#' + ch.token;
			console.log('challenge.http.set', key);

			await ServerConnect.get()
				.dispatch()
				.certChallengeHttpPutConnect({
					key,
					challenge: {
						result: ch.keyAuthorization,
					},
				},
					undefined,
					{ 'x-cf-connect-token': connectConfig.connectToken });

			return null;
		},

		// data: { challenge: {
		// 	type: 'http-01'
		//   , identifier: { type: 'dns', value: 'example.com' }
		//   , wildcard: false
		//   , token: 'abc123'
		//   , altname: 'example.com'
		//   }
		// }
		get: async (data) => {
			var ch = data.challenge;
			var key = ch.identifier.value + '#' + ch.token;
			console.log('challenge.http.get', key);

			try {
				const challenge = await ServerConnect.get()
					.dispatch()
					.certChallengeHttpGetConnect(
						{ key },
						undefined,
						{ 'x-cf-connect-token': connectConfig.connectToken });
				console.log('Challenge found for key', key);
				return {
					keyAuthorization: challenge.result,
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

		// data: { challenge: {
		// 	 type: 'http-01'
		//   , identifier: { type: 'dns', value: 'example.com' }
		//   , wildcard: false
		//   , expires: '2012-01-01T12:00:00.000Z'
		//   , token: 'abc123'
		//   , thumbprint: '<<account key thumbprint>>'
		//   , keyAuthorization: 'abc123.xxxx'
		//   , dnsHost: '_acme-challenge.example.com'
		//   , dnsAuthorization: 'yyyy'
		//   , altname: 'example.com'
		//   }
		// }		
		remove: async (data) => {
			var ch = data.challenge;
			var key = ch.identifier.value + '#' + ch.token;
			console.log('challenge.http.remove', key);

			await ServerConnect.get()
				.dispatch()
				.certChallengeHttpDeleteConnect(
					{ key },
					undefined,
					{ 'x-cf-connect-token': connectConfig.connectToken });
			return null;
		}
	};
};
