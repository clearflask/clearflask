// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import i18n from 'i18next';
import BrowserLanguageDetector from 'i18next-browser-languagedetector';
import { htmlDataRetrieve } from './common/util/htmlData';
import { getI18n as getI18nGeneric } from './i18n';

var instance: typeof i18n | undefined;
export const getI18n = () => {
  if (!instance) {
    instance = getI18nGeneric(
      i18n => i18n.use(BrowserLanguageDetector),
      {
        lng: htmlDataRetrieve('__SSR_I18N_INIT_LNG__'),
        resources: htmlDataRetrieve('__SSR_I18N_INIT_STORE__'),
        partialBundledLanguages: true,
      }
    );
  }
  return instance;
};
