// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import { OpaqueConfig, spring } from 'react-motion';

export default function muiSpring(val: number, precision: number = 0.01): OpaqueConfig {
  return spring(val, {
    stiffness: 300,
    damping: 30,
    precision,
  });
}
