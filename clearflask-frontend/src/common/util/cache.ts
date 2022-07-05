// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0

export default class Cache<T = any> {
	_expiryInMs;
	_cache = new Map<string, {
		expires: number,
		item: T,
	}>();

	constructor(expiryInMs: number = 3000) {
		this._expiryInMs = expiryInMs;
	}

	get(key: string): T | undefined {
		const val = this._cache.get(key);
		if (val) {
			if (val.expires > new Date().getTime()) {
				return val.item;
			} else {
				this._cache.delete(key);
			}
		}
		return undefined;
	}

	put(key: string, val: T, expiryInMsOverride?: number): void {
		const expiryInMs = expiryInMsOverride === undefined ? this._expiryInMs : expiryInMsOverride;
		this._cache.set(key, {
			expires: new Date().getTime() + expiryInMs,
			item: val,
		});
	}

	cleanup(): void {
		const now = new Date().getTime();
		this._cache.forEach((value, key) => {
			const expires = value.expires;
			if (expires === undefined || expires < now) {
				this._cache.delete(key);
			}
		})
	}
}
