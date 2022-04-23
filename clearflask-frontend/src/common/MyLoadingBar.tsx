// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import { useTheme } from "@material-ui/core";
import React from 'react';
import LoadingBar from 'react-redux-loading-bar';

export default function MyLoadingBar() {
  const theme = useTheme();
  return (
    <LoadingBar
      style={{
        backgroundColor: theme.palette.primary.light,
      }}
      showFastActions
      maxProgress={90}
    />
  );
}
