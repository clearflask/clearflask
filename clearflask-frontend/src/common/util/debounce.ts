// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only

// https://github.com/jashkenas/underscore/blob/master/modules/debounce.js
// When a sequence of calls of the returned function ends, the argument
// function is triggered. The end of a sequence is defined by the `wait`
// parameter. If `immediate` is passed, the argument function will be
// triggered at the beginning of the sequence instead of at the end.
export default function debounce<T extends any[]>(
	func: (...argary: T) => void,
	wait: number = SearchTypeDebounceTime,
	immediate: boolean = false,
) {
	var timeout, previous, args, result, context;

	var later = function () {
		var passed = new Date().getTime() - previous;
		if (wait > passed) {
			timeout = setTimeout(later, wait - passed);
		} else {
			timeout = null;
			if (!immediate) result = func.apply(context, args);
			// This check is needed because `func` can recursively invoke `debounced`.
			if (!timeout) args = context = null;
		}
	};

	var debounced: any = restArguments(function (this: any, _args) {
		context = this;
		args = _args;
		previous = new Date().getTime();
		if (!timeout) {
			timeout = setTimeout(later, wait);
			if (immediate) result = func.apply(context, args);
		}
		return result;
	});

	debounced.cancel = function () {
		clearTimeout(timeout);
		timeout = args = context = null;
	};

	return debounced;
}

// https://github.com/jashkenas/underscore/blob/master/modules/restArguments.js
// Some functions take a variable number of arguments, or a few expected
// arguments at the beginning and then a variable number of values to operate
// on. This helper accumulates all remaining arguments past the function’s
// argument length (or an explicit `startIndex`), into an array that becomes
// the last argument. Similar to ES6’s "rest parameter".
function restArguments(func, startIndexMaybeNull: number | null = null) {
	const startIndex = startIndexMaybeNull == null ? func.length - 1 : +startIndexMaybeNull;
	return function (this: any) {
		var length = Math.max(arguments.length - startIndex, 0),
			rest = Array(length),
			index = 0;
		for (; index < length; index++) {
			rest[index] = arguments[index + startIndex];
		}
		switch (startIndex) {
			case 0: return func.call(this, rest);
			case 1: return func.call(this, arguments[0], rest);
			case 2: return func.call(this, arguments[0], arguments[1], rest);
		}
		var args = Array(startIndex + 1);
		for (index = 0; index < startIndex; index++) {
			args[index] = arguments[index];
		}
		args[startIndex] = rest;
		return func.apply(this, args);
	};
}

export const SearchTypeDebounceTime = 300;

export const SimilarTypeDebounceTime = 3000;
