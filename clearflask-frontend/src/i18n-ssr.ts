// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
import CountryLocaleMap from 'country-locale-map';
import i18nMiddleware, { LanguageDetector } from 'i18next-http-middleware';
import { defaultLanguage, getI18n as getI18nGeneric, supportedLanguagesSet } from './i18n';

export const getI18n = () => {
  var languageDetector: LanguageDetector | undefined;
  if (process.env.ENV === 'production') {
    languageDetector = new i18nMiddleware.LanguageDetector();
    languageDetector.addDetector({
      name: 'asd',
      lookup: (req, res, options) => {
        const headerCountry = req.header('x-clearflask-country-to-locale')?.toUpperCase();
        if (!headerCountry) return defaultLanguage;
        return CountryLocaleMap.getCountryByAlpha2(headerCountry)?.languages?.find(language =>
          supportedLanguagesSet.has(language.toLowerCase()))
          || defaultLanguage;
      },
    });
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
