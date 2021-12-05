// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
import CountryLocaleMap from 'country-locale-map';
import i18nMiddleware from 'i18next-http-middleware';
import { defaultLanguage, getI18n as getI18nGeneric, supportedLanguagesSet } from './i18n';

export const getI18n = () => {
  var languageDetector = new i18nMiddleware.LanguageDetector();
  languageDetector.addDetector({
    name: 'detection-via-cloudfront-header',
    lookup: (req, res, options) => {
      const headerCountry = req.header('x-clearflask-country-to-locale')?.toUpperCase();
      console.info(`x-clearflask-country-to-locale: ${headerCountry}`);
      if (!headerCountry) return defaultLanguage;
      return CountryLocaleMap.getCountryByAlpha2(headerCountry)?.languages?.find(language =>
        supportedLanguagesSet.has(language.toLowerCase()))
        || defaultLanguage;
    },
    cacheUserLanguage: function (req, res, lng, options) {
      // Don't store it
    }
  });

  return getI18nGeneric(
    i18n => i18n.use(languageDetector),
    {
      preload: [...supportedLanguagesSet],
    },
  );
};
