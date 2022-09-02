// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import CountryLocaleMap from 'country-locale-map';
import i18nMiddleware from 'i18next-http-middleware';
import { defaultLanguage, getI18n as getI18nGeneric, LANGUAGE_SELECTION_COOKIE_NAME, setLangIsUserSelected, supportedLanguagesSet } from './i18n';

export const getI18n = () => {
  var languageDetector = new i18nMiddleware.LanguageDetector();
  languageDetector.addDetector({
    name: 'detection-via-header',
    lookup: (req, res, options) => {
      // Selected language preferece from cookie
      const cookieLanguage = req.cookies?.[LANGUAGE_SELECTION_COOKIE_NAME];
      if (cookieLanguage && supportedLanguagesSet.has(cookieLanguage)) {
        setLangIsUserSelected();
        return cookieLanguage;
      }

      // Language provided by cloudfront's Lambda@Edge function
      const cloudfrontLanguageHeader = req.header('x-clearflask-country-to-locale')?.toUpperCase();
      if (cloudfrontLanguageHeader) {
        const cloudfrontLanguage = CountryLocaleMap.getCountryByAlpha2(cloudfrontLanguageHeader)?.languages?.find(language =>
          supportedLanguagesSet.has(language.toLowerCase()));
        if (cloudfrontLanguage) {
          return cloudfrontLanguage
        }
      }

      // For custom domains, there is no cloudfront, determine language ourselves
      if (req.header('accept-language')) {
        const acceptLanguage = req.header('accept-language')?.substr(0, 2).toUpperCase();
        if (acceptLanguage && supportedLanguagesSet.has(acceptLanguage)) {
          return acceptLanguage;
        }
      }

      return defaultLanguage;
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
