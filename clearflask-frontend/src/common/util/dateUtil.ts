// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0

var timezoneOffsetInMinCached: number | undefined;
export const getTimezoneOffsetInMin = (): number => {
  if (timezoneOffsetInMinCached === undefined) {
    timezoneOffsetInMinCached = (new Date().getTimezoneOffset?.() || 0) * -1;
  }
  return timezoneOffsetInMinCached;
}
