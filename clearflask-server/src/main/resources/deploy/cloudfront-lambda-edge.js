// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only

// Have CloudFront cache separate pages for each language.
// - CloudFront is configured to cache by header x-clearflask-country-to-locale
// - Parse accept-language header and filter by supported languages to minimize extra cache copies

'use strict';

// ADD NEW LANGUAGE HERE
const allowedLanguages = new Set(['en', 'mn', 'sk', 'fr', 'de']);

exports.handler = (event, context, callback) => {
  const request = event.Records[0].cf.request;
  const headers = request.headers;

  var language = 'en';

  if (!!headers['accept-language']) {
    const acceptedLanguages = headers['accept-language'][0].value.split(',');
    for (var acceptedLanguage of acceptedLanguages) {
      acceptedLanguage = acceptedLanguage.substr(0, 2).toLowerCase();
      if (allowedLanguages.has(acceptedLanguage)) {
        language = acceptedLanguage;
        break;
      }
    }
  }

  request.headers['x-clearflask-country-to-locale'] = [{
    key: 'X-ClearFlask-Country-To-Locale',
    value: language,
  }];

  return callback(null, request);
}
