// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
/// <reference path="./@types/transform-media-imports.d.ts"/>
import i18n, { InitOptions, Resource } from 'i18next';
import resourcesToBackend from 'i18next-resources-to-backend';
import { initReactI18next, Namespace, TFuncKey } from 'react-i18next';
import FlagAdd from '../public/img/flag/add.png';
import FlagMn from '../public/img/flag/mn.svg';
import FlagSk from '../public/img/flag/sk.svg';
import FlagEn from '../public/img/flag/us.svg';
import { isProd } from './common/util/detectEnv';

export const defaultLanguage = 'en';
export type SupportedLanguage = {
  code: string;
  label: string;
  img: Img;
  isContribute?: boolean;
};
export const supportedLanguages: Array<SupportedLanguage>
  /**
   * IMPORTANT:
   * Adding a new language checklist:
   * - You must also specify which countries will defualt to this language by editing Lambda function "clearflask-cloudfront-locale-header".
   * - Ensure the clearflask-i18n bundles the translation files
   * - Find image in https://github.com/ekwonye-richard/react-flags-select/tree/master/flags
   * - Find language label in https://en.wikipedia.org/wiki/List_of_language_names
   */
  = [
    { code: 'en', img: FlagEn, label: 'English' },
    ...(isProd() ? [] : [
      { code: 'mn', img: FlagMn, label: 'Монгол' },
      { code: 'sk', img: FlagSk, label: 'Slovenčina' },
      { code: 'cimode', img: FlagAdd, label: 'No translation' },
    ]),
    { code: 'lol', img: FlagAdd, label: 'Help us translate', isContribute: true },
  ];
export const supportedLanguagesSet = new Set(supportedLanguages.map(l => l.code));

export const getI18n = (
  initialLng: string | undefined,
  initialStore: Resource | undefined,
  languageDetector,
  opts?: InitOptions,
) => {
  i18n
    .use(initReactI18next)
    .use(languageDetector)
    .use(resourcesToBackend((language, namespace, callback) => {
      if (!supportedLanguagesSet.has(language)) {
        return callback({ name: 'unsupported', message: `Language ${language} not supported` }, null);
      }
      import(/* webpackChunkName: "[request]" */ `./locales/${language}/${namespace}.json`)
        .then(({ default: resources }) => callback(null, resources))
        .catch((error) => callback(error, null))
    }))
    // Docs: https://www.i18next.com/overview/configuration-options
    .init({
      initImmediate: false,
      lng: initialLng,
      fallbackLng: defaultLanguage,
      supportedLngs: [...supportedLanguagesSet],
      debug: !isProd(),
      resources: initialStore,
      missingKeyNoValueFallbackToKey: false,
      ns: ['app', 'site'],
      defaultNS: 'app',
      ...opts,
      interpolation: {
        escapeValue: false, // not needed for react as it escapes by default
        ...opts?.interpolation,
      },
      react: {
        useSuspense: false,
        wait: true,
        transWrapTextNodes: 'span',
        ...opts?.react,
      },
    });
  return i18n;
};

// For type-checking standalone strings without the use of t function
export const T = <N extends Namespace>(key: TFuncKey<N>): string => key;
