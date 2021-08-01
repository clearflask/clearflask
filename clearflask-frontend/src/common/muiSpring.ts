// SPDX-FileCopyrightText: 2019-2020 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only

import { OpaqueConfig, spring } from 'react-motion';

export default function muiSpring(val: number, precision: number = 0.01): OpaqueConfig {
  return spring(val, {
    stiffness: 300,
    damping: 30,
    precision,
  });
}
