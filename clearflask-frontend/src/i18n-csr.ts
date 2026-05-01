// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import i18n from 'i18next';
import BrowserLanguageDetector from 'i18next-browser-languagedetector';
import Cookies from './common/util/cookies';
import { htmlDataRetrieve } from './common/util/htmlData';
import { getI18n as getI18nGeneric, LANGUAGE_SELECTION_COOKIE_NAME, setLangIsUserSelected, supportedLanguages } from './i18n';

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

const isContributeOnlyCode = (code?: string): boolean =>
  !!code && !!supportedLanguages.find(l => l.code === code)?.isContribute;

// Contribute-only locales (currently just "lol", the Crowdin in-context-editor
// slot) are persisted in sessionStorage instead of the long-lived cookie.
// Cookie semantics would trap the user: closing the contribute dialog or the
// browser would leave the entire app rendered as crwdns###:0crwdne###:0
// markers on every subsequent visit. sessionStorage is tab-scoped so it
// survives in-tab navigations (so a translator can edit multi-page strings)
// but resets on tab close.
const CONTRIBUTE_LANG_SESSION_KEY = 'cf-contribute-lang';

const getSessionStorage = (): Storage | undefined => {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage : undefined;
  } catch (e) {
    return undefined;
  }
};

export const rememberUserSelection = (language?: string): void => {
  const ss = getSessionStorage();
  if (!!language && isContributeOnlyCode(language)) {
    ss?.setItem(CONTRIBUTE_LANG_SESSION_KEY, language);
    Cookies.getInstance().unset(LANGUAGE_SELECTION_COOKIE_NAME);
    return;
  }
  ss?.removeItem(CONTRIBUTE_LANG_SESSION_KEY);
  if (!!language) {
    Cookies.getInstance().set(LANGUAGE_SELECTION_COOKIE_NAME, language, 365);
  } else {
    Cookies.getInstance().unset(LANGUAGE_SELECTION_COOKIE_NAME);
  }
};
export const getUserSelection = (): string | undefined => {
  // In-tab contribute mode wins (only set during an active translate session).
  const sessionLanguage = getSessionStorage()?.getItem(CONTRIBUTE_LANG_SESSION_KEY);
  if (sessionLanguage && isContributeOnlyCode(sessionLanguage)) {
    return sessionLanguage;
  }

  const stored = Cookies.getInstance().get(LANGUAGE_SELECTION_COOKIE_NAME);
  // Legacy "zh" cookies were set when there was a single Chinese locale.
  // Map them to Chinese Simplified so returning users keep their language.
  if (stored === 'zh') return 'zh-CN';
  // Recover users whose cookie was stuck on a contribute-only slot before the
  // rememberUserSelection guard above was deployed: drop the cookie and let
  // normal detection take over.
  if (isContributeOnlyCode(stored)) {
    Cookies.getInstance().unset(LANGUAGE_SELECTION_COOKIE_NAME);
    return undefined;
  }
  return stored;
};
