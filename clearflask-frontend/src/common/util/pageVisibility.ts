// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import windowIso from "../windowIso";

export function isPageVisible(): boolean {
  return windowIso.isSsr || !windowIso.document.hidden;
}

export function waitUntilPageVisible(): Promise<void> {
  if (windowIso.isSsr || !document.hidden) {
    return Promise.resolve();
  }
  return new Promise(resolve => {
    if (!document.hidden) {
      resolve();
      return;
    }
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        resolve();
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
  })
}
