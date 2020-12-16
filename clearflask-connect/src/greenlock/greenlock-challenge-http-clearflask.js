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

		get: async (data) => {
			var ch = data.challenge;
			var key = ch.identifier.value + '#' + ch.token;
			console.log('challenge.get', key);

			if (memdb[key]) {
				return { keyAuthorization: memdb[key] };
			}

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
				throw response;
			}
		},

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
