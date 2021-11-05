// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only

const entityMap = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;'
};

// https://stackoverflow.com/a/12034334
export const escapeHtml = (text?: string): string => {
  if (text === undefined) return '';
  return String(text).replace(/[&<>"'`=/]/g, (s) => entityMap[s]);
}
