// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import CountryLocaleMap from 'country-locale-map';
import i18nMiddleware from 'i18next-http-middleware';
import { defaultLanguage, getI18n as getI18nGeneric, LANGUAGE_SELECTION_COOKIE_NAME, setLangIsUserSelected, supportedLanguagesSet } from './i18n';

export const getI18n = () => {
  var languageDetector = new i18nMiddleware.LanguageDetector();
  languageDetector.addDetector({
    name: 'detection-via-header',
    lookup: (req, res, options) => {
      // Selected language preferece from cookie. Legacy "zh" cookies (set when
      // there was a single Chinese locale) map to Chinese Simplified.
      let cookieLanguage = req.cookies?.[LANGUAGE_SELECTION_COOKIE_NAME];
      if (cookieLanguage === 'zh') cookieLanguage = 'zh-CN';
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

      // For custom domains (and currently the apex too — clearflask.com is no
      // longer behind CloudFront) determine language from Accept-Language.
      const acceptLanguageHeader = req.header('accept-language');
      if (acceptLanguageHeader) {
        const matched = matchAcceptLanguage(acceptLanguageHeader);
        if (matched) return matched;
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
      // Without an explicit order, i18next-http-middleware falls back to its
      // default detector chain (path/session/querystring/cookie/header) and
      // never invokes our custom 'detection-via-header'.
      detection: {
        order: ['detection-via-header'],
        caches: false,
      },
    },
  );
};

// Pick the highest-quality Accept-Language tag that we support. Tries exact
// match first (covers "zh-CN"), then the primary subtag (covers "zh"). Legacy
// "zh" is treated as Chinese Simplified.
const matchAcceptLanguage = (header: string): string | undefined => {
  const tags = header.split(',')
    .map(part => part.split(';')[0].trim())
    .filter(Boolean);
  const lowerSupported = new Map<string, string>();
  for (const lng of supportedLanguagesSet) {
    lowerSupported.set(lng.toLowerCase(), lng);
  }
  for (const tag of tags) {
    const lower = tag.toLowerCase();
    if (lowerSupported.has(lower)) return lowerSupported.get(lower);
    const primary = lower.split('-')[0];
    if (primary === 'zh') return 'zh-CN';
    if (lowerSupported.has(primary)) return lowerSupported.get(primary);
  }
  return undefined;
};
