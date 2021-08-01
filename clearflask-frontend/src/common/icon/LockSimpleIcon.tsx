// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
import SvgIcon from "@material-ui/core/SvgIcon";
import React from 'react';

export default function LockSimpleIcon(props) {
  return (
    <SvgIcon {...props}>
      <svg width="24" height="24" viewBox="0 0 24 24">
        <path d="M 18 8 h -1 V 6 c 0 -2.76 -2.24 -5 -5 -5 S 7 3.24 7 6 v 2 H 6 c -1.1 0 -2 0.9 -2 2 v 10 c 0 1.1 0.9 2 2 2 h 12 c 1.1 0 2 -0.9 2 -2 V 10 c 0 -1.1 -0.9 -2 -2 -2 z z m -6 0 H 8.9 V 6 c 0 -1.71 1.39 -3.1 3.1 -3.1 c 1.71 0 3.1 1.39 3.1 3.1 v 2 z" />
      </svg>
    </SvgIcon>
  );
}
