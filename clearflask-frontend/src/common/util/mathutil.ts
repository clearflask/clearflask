// SPDX-FileCopyrightText: 2019-2020 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only

function minmax(min: number, input: number, max: number) {
  if (input < min) return min;
  if (input > max) return max;
  return input;
}

export default minmax;