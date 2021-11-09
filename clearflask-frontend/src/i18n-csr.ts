// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
import i18n from 'i18next';
import BrowserLanguageDetector from 'i18next-browser-languagedetector';
import { htmlDataRetrieve } from './common/util/htmlData';
import windowIso from './common/windowIso';
import { getI18n as getI18nGeneric } from './i18n';

var instance: typeof i18n | undefined;
export const getI18n = () => {
  if (!instance) {
    const initialLanguage = !windowIso.isSsr ? htmlDataRetrieve('__SSR_I18N_INIT_LNG__') : undefined;
    instance = getI18nGeneric(
      initialLanguage,
      htmlDataRetrieve('__SSR_I18N_INIT_STORE__'),
      BrowserLanguageDetector,
      {
        partialBundledLanguages: true,
      }
    );
  }
  return instance;
};
