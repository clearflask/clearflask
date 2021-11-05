// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
import BrowserLanguageDetector from 'i18next-browser-languagedetector';
import { htmlDataRetrieve } from './common/util/htmlData';
import windowIso from './common/windowIso';
import { getI18n as getI18nGeneric } from './i18n';

export const getI18n = () => {
  const initialLanguage = !windowIso.isSsr ? htmlDataRetrieve('__SSR_INIT_LNG__') : undefined;
  return getI18nGeneric(
    initialLanguage,
    BrowserLanguageDetector,
  );
};
