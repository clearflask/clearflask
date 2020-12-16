'use strict';

const { default: connectConfig } = require('../config');
const { default: ServerConnect } = require("../serverConnect");

module.exports.create = function (config) {
	console.log('ClearFlask Greenlock Http Challenge Started');

	return {
		init: function (opts) {
			console.log('challenge.init', opts);
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
			console.log('challenge.set', key);

			await ServerConnect.get()
				.dispatch()
				.certChallengePutConnect({
					key,
					challenge: {
						result: ch.keyAuthorization,
					},
				},
				undefined,
				{'x-cf-connect-token': connectConfig.connectToken});

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
			console.log('challenge.get', key);

			try {
				const challenge = await ServerConnect.get()
					.dispatch()
					.certChallengeGetConnect(
						{ key },
						undefined,
						{'x-cf-connect-token': connectConfig.connectToken});
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
			console.log('challenge.remove', key);

			await ServerConnect.get()
				.dispatch()
				.certChallengeDeleteConnect(
					{ key },
					undefined,
					{'x-cf-connect-token': connectConfig.connectToken});
			return null;
		}
	};
};
