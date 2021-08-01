// SPDX-FileCopyrightText: 2019-2020 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only

export default function stringToSlug(val?: string): string {
  return val
    ? val.toLowerCase().replace(/[^0-9a-z]+/g, '-')
    : '';
}
