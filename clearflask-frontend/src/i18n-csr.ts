// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import i18n from 'i18next';
import BrowserLanguageDetector from 'i18next-browser-languagedetector';
import Cookies from './common/util/cookies';
import { htmlDataRetrieve } from './common/util/htmlData';
import { getI18n as getI18nGeneric, LANGUAGE_SELECTION_COOKIE_NAME, setLangIsUserSelected } from './i18n';

var instance: typeof i18n | undefined;
export const getI18n = () => {
  if (!instance) {
    var languageDetector = new BrowserLanguageDetector();
    languageDetector.addDetector({
      name: 'detection-via-cookie',
      lookup: (options) => {
        const userSelectedLanguage = getUserSelection();
        if (!!userSelectedLanguage) {
          setLangIsUserSelected();
          return userSelectedLanguage;
        }
        return undefined;
      },
      cacheUserLanguage: function (lng, options) {
        // Don't store it
      }
    });

    instance = getI18nGeneric(
      i18n => i18n.use(languageDetector),
      {
        lng: htmlDataRetrieve('__SSR_I18N_INIT_LNG__'),
        resources: htmlDataRetrieve('__SSR_I18N_INIT_STORE__'),
        partialBundledLanguages: true,
        detection: {
          order: ['querystring', 'detection-via-cookie', 'navigator'],
          caches: [],
          lookupLocalStorage: undefined,
          lookupSessionStorage: undefined,
        },
      },
      lng => rememberUserSelection(lng),
    );
  }
  return instance;
};

export const rememberUserSelection = (language?: string): void => {
  if (!!language) {
    Cookies.getInstance().set(LANGUAGE_SELECTION_COOKIE_NAME, language, 365);
  } else {
    Cookies.getInstance().unset(LANGUAGE_SELECTION_COOKIE_NAME);
  }
};
export const getUserSelection = (): string | undefined => {
  return Cookies.getInstance().get(LANGUAGE_SELECTION_COOKIE_NAME);
};
