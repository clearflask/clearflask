// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
export default function stringToSlug(val?: string): string {
  return val
    ? val.toLowerCase().replace(/[^0-9a-z]+/g, '-')
    : '';
}
