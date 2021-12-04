// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
import CountryLocaleMap from 'country-locale-map';
import i18nMiddleware from 'i18next-http-middleware';
import { defaultLanguage, getI18n as getI18nGeneric, supportedLanguagesSet } from './i18n';

export const getI18n = () => {
  var languageDetector;
  if (process.env.ENV === 'production') {
    languageDetector = new i18nMiddleware.LanguageDetector();
    languageDetector.addDetector((req, res, lng, options) => {
      const languages = CountryLocaleMap.getCountryByAlpha2(req.header('x-clearflask-country-to-locale')).languages;
      return languages?.find(language => supportedLanguagesSet.has(language)) || defaultLanguage;
    });
  } else {
    languageDetector = i18nMiddleware.LanguageDetector;
  }

  return getI18nGeneric(
    undefined,
    undefined,
    languageDetector,
    {
      preload: [...supportedLanguagesSet],
      ns: [
        'app',
        'site',
      ],
    },
  );
};
