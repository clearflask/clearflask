// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
/// <reference path="./@types/transform-media-imports.d.ts"/>
import i18n, { InitOptions } from 'i18next';
import resourcesToBackend from 'i18next-resources-to-backend';
import { initReactI18next, Namespace, TFuncKey } from 'react-i18next';
import FlagAdd from '../public/img/flag/add.png';
import FlagCy from '../public/img/flag/cy.svg';
import FlagDe from '../public/img/flag/de.svg';
import FlagEs from '../public/img/flag/es.svg';
import FlagFr from '../public/img/flag/fr.svg';
import FlagKr from '../public/img/flag/kr.svg';
import FlagMn from '../public/img/flag/mn.svg';
import FlagSk from '../public/img/flag/sk.svg';
import FlagUa from '../public/img/flag/ua.svg';
import FlagEn from '../public/img/flag/us.svg';
import { isProd } from './common/util/detectEnv';

export const defaultLanguage = 'en';
export type SupportedLanguage = {
  code: string;
  label: string;
  perc?: number;
  img: Img;
  isContribute?: boolean;
};
/**
 * Indicates how many texts on the whole site are translatable.
 */
export const percOfSiteTextI18n = 0.8;
export const supportedLanguages: Array<SupportedLanguage>
  /**
   * IMPORTANT:
   * Adding a new language checklist:
   * - You must also specify which countries will defualt to this language by editing Lambda function "clearflask-cloudfront-locale-header".
   *   - Update Lambda function and publish new version at https://console.aws.amazon.com/lambda/home?region=us-east-1#/functions/clearflask-cloudfront-locale-header/versions/5?tab=code
   *   - Update Lambda version in CloudFront: https://console.aws.amazon.com/cloudfront/v3/home?region=us-east-1#/distributions/EQHBQLQZXVKCU/behaviors
   * - Ensure the clearflask-i18n bundles the translation files
   * - Find image in https://github.com/ekwonye-richard/react-flags-select/tree/master/flags
   * - Find language label in https://en.wikipedia.org/wiki/List_of_language_names
   */
  = [
    { code: 'cy', img: FlagCy, label: 'Cymraeg', perc: 0.01 },
    { code: 'de', img: FlagDe, label: 'Deutsch', perc: 0.42 },
    { code: 'en', img: FlagEn, label: 'English', perc: 1 },
    { code: 'es', img: FlagEs, label: 'Español', perc: .04 },
    { code: 'fr', img: FlagFr, label: 'Français', perc: 0.01 },
    { code: 'ko', img: FlagKr, label: '한국어', perc: .03 },
    { code: 'mn', img: FlagMn, label: 'Монгол', perc: 0.35 },
    { code: 'sk', img: FlagSk, label: 'Slovenčina', perc: 0.99 },
    { code: 'uk', img: FlagUa, label: 'Українська', perc: .01 },
    ...(isProd() ? [] : [
      { code: 'cimode', img: FlagAdd, label: 'No translation' },
    ]),
    { code: 'lol', img: FlagAdd, label: 'Help us translate', isContribute: true },
  ];
export const supportedLanguagesSet = new Set(supportedLanguages.map(l => l.code));

export const getI18n = (
  prepare: (i: typeof i18n) => typeof i18n,
  opts?: InitOptions,
) => {
  prepare(i18n).use(
    initReactI18next
  ).use(resourcesToBackend((language, namespace, callback) => {
    if (!supportedLanguagesSet.has(language)) {
      return callback({ name: 'unsupported', message: `Language ${language} not supported` }, null);
    }
    import(/* webpackChunkName: "[request]" */ `./locales/${language}/${namespace}.json`)
      .then(({ default: resources }) => callback(null, resources))
      .catch((error) => callback(error, null))
  })).init({ // Docs: https://www.i18next.com/overview/configuration-options
    initImmediate: false,
    fallbackLng: defaultLanguage,
    supportedLngs: [...supportedLanguagesSet],
    debug: !isProd(),
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
