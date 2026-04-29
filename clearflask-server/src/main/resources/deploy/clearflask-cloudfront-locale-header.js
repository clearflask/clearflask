// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0

// Have CloudFront cache separate pages for each language.
// - CloudFront is configured to cache by header x-clearflask-country-to-locale
// - Parse accept-language header and filter by supported languages to minimize extra cache copies

'use strict';

const ALLOWED_LANGUAGES = new Set(['en', 'ar', 'zh-CN', 'cy', 'cs', 'da', 'de', 'el', 'en', 'es', 'fr', 'it', 'ja', 'ko', 'mn', 'nl', 'no', 'pl', 'pt', 'ro', 'ru', 'sk', 'fi', 'sv', 'uk']);
// Legacy 2-letter codes that should resolve to a specific regional variant
// (e.g. plain "zh" is treated as Chinese Simplified). Add zh-TW once it has
// translations.
const LEGACY_LANGUAGE_MAP = { 'zh': 'zh-CN' };
const LANGUAGE_SELECTION_COOKIE_NAME = 'x-cf-lang';

const matchAllowedLanguage = (raw) => {
    if (!raw) return undefined;
    // Strip quality suffix and surrounding whitespace.
    const tag = raw.split(';')[0].trim();
    if (!tag) return undefined;
    // Exact match (covers canonical "zh-CN", "en", etc.).
    if (ALLOWED_LANGUAGES.has(tag)) return tag;
    // Case-insensitive match for tags whose region is sent lowercase by some clients.
    const lower = tag.toLowerCase();
    for (const allowed of ALLOWED_LANGUAGES) {
        if (allowed.toLowerCase() === lower) return allowed;
    }
    // Fall back to the 2-letter primary subtag.
    const primary = lower.split('-')[0];
    if (LEGACY_LANGUAGE_MAP[primary]) return LEGACY_LANGUAGE_MAP[primary];
    if (ALLOWED_LANGUAGES.has(primary)) return primary;
    return undefined;
};

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
    if (languageFromCookie !== undefined) {
        language = matchAllowedLanguage(languageFromCookie);
    }

    if (language === undefined && !!request.headers['accept-language']) {
        const acceptedLanguages = request.headers['accept-language'][0].value.split(',');
        for (const acceptedLanguage of acceptedLanguages) {
            const matched = matchAllowedLanguage(acceptedLanguage);
            if (matched) {
                language = matched;
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
