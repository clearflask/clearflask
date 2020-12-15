'use strict';

const { default: ServerConnect } = require("../serverConnect");

module.exports.create = function (config) {
	console.log('ClearFlask Greenlock Http Challenge Started');

	return {
		init: function (opts) {
			console.log('challenge init', data);
			return Promise.resolve(null);
		},

		set: async (data) => {
			console.log('Add Key Auth URL', data);
			var ch = data.challenge;
			var key = ch.identifier.value + '#' + ch.token;

			await ServerConnect.get()
				.dispatch()
				.certChallengePutConnect({
					key,
					challenge: {
						result: ch.keyAuthorization,
					},
				});

			return null;
		},

		get: async (data) => {
			console.log('List Key Auth URL', data);
			var ch = data.challenge;
			var key = ch.identifier.value + '#' + ch.token;

			if (memdb[key]) {
				return { keyAuthorization: memdb[key] };
			}

			try {
				const challenge = await ServerConnect.get()
					.dispatch()
					.certChallengeGetConnect({ key });
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
			console.log('Remove Key Auth URL', data);
			var ch = data.challenge;
			var key = ch.identifier.value + '#' + ch.token;

			await ServerConnect.get()
				.dispatch()
				.certChallengeDeleteConnect({ key });
			return null;
		}
	};
};
