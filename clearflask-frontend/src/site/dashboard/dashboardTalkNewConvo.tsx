// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import { Button, TextField } from '@material-ui/core';
import { createStyles, makeStyles, Theme } from '@material-ui/core/styles';
import React from 'react';

const styles = (theme: Theme) => createStyles({});
const useStyles = makeStyles(styles);

export const DashboardTalkNewConvo = (props: {
}) => {
  const classes = useStyles();

  return (
    <div>
      Create a new conversation
    </div>
  );
};
