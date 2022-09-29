// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import SvgIcon from "@material-ui/core/SvgIcon";
import React from 'react';

export default function LogoutIcon(props) {
  return (
    <SvgIcon {...props}>
      <svg width="24" height="24" viewBox="0 0 24 24">
        <path d="M6 2h9a2 2 0 0 1 2 2v2h-2V4H6v16h9v-2h2v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" />
        <path d="M16.09 15.59L17.5 17l5-5-5-5-1.41 1.41L18.67 11H9v2h9.67z" />
      </svg>
    </SvgIcon>
  );
}
