// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import { Button, TextField } from '@material-ui/core';
import { createStyles, makeStyles, Theme } from '@material-ui/core/styles';
import React from 'react';

const styles = (theme: Theme) => createStyles({});
const useStyles = makeStyles(styles);

export const DashboardTalkConvo = (props: {
  convoId: string;
}) => {
  const classes = useStyles();

  return (
    <pre>
      Hello

      How are you doing

      I am fine

      what about you
    </pre>
  );
};
