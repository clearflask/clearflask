// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import he from 'he';
import windowIso from '../windowIso';

export function htmlDataCreate(id: string, data: any): string {
  return `<script id="${id}" type="application/json" ver="2">${he.encode(JSON.stringify(data))}</script>`;
}

export function htmlDataRetrieve(id: string): any {
  if (windowIso.isSsr) return undefined;
  const el = windowIso.document.getElementById(id);
  if (!el) return undefined;
  try {
    const content = el.getAttribute("ver") === "2" ? he.decode(el.innerHTML) : el.innerHTML;
    return JSON.parse(content);
  } catch (e) {
    return undefined;
  }
}
