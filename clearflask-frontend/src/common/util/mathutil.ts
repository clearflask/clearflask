// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
function minmax(min: number, input: number, max: number) {
  if (input < min) return min;
  if (input > max) return max;
  return input;
}

export default minmax;