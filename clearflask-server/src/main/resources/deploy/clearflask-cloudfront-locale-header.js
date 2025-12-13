// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0

// Have CloudFront cache separate pages for each language.
// - CloudFront is configured to cache by header x-clearflask-country-to-locale
// - Parse accept-language header and filter by supported languages to minimize extra cache copies

'use strict';

const ALLOWED_LANGUAGES = new Set(['en', 'ar', 'zh', 'cy', 'cs', 'da', 'de', 'el', 'en', 'es', 'fr', 'it', 'ja', 'ko', 'mn', 'nl', 'no', 'pl', 'pt', 'ro', 'ru', 'sk', 'fi', 'sv', 'uk']);
const LANGUAGE_SELECTION_COOKIE_NAME = 'x-cf-lang';

const getCookieValue = (headers, cookieKey) => {
    if (headers.cookie) {
        for (let cookieHeader of headers.cookie) {
            const cookies = cookieHeader.value.split(';');
            for (let cookie of cookies) {
                const [key, val] = cookie.split('=');
                if (key.trim() === cookieKey) {
                    return val.trim();
                }
            }
        }
    }
    return undefined;
}

exports.handler = (event, context, callback) => {
    const request = event.Records[0].cf.request;

    var language = undefined;

    const languageFromCookie = getCookieValue(request.headers, LANGUAGE_SELECTION_COOKIE_NAME);
    if (languageFromCookie !== undefined && ALLOWED_LANGUAGES.has(languageFromCookie)) {
        language = languageFromCookie;
    }

    if (language === undefined && !!request.headers['accept-language']) {
        const acceptedLanguages = request.headers['accept-language'][0].value.split(',');
        for (var acceptedLanguage of acceptedLanguages) {
            acceptedLanguage = acceptedLanguage.substr(0, 2).toLowerCase();
            if (ALLOWED_LANGUAGES.has(acceptedLanguage)) {
                language = acceptedLanguage;
                break;
            }
        }
    }

    if (language === undefined) {
        language = 'en';
    }

    request.headers['x-clearflask-country-to-locale'] = [{
        key: 'X-ClearFlask-Country-To-Locale',
        value: language,
    }];

    return callback(null, request);
}
