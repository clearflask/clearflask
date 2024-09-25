// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import { createStyles, makeStyles, Theme } from '@material-ui/core/styles';
import React from 'react';
import * as Client from '../../api/client';
import { Link as MuiLink, Table, TableBody, TableCell, TableRow, Typography } from '@material-ui/core';

const PredefinedQuestions = [
  'What is the most requested feature and which customers are asking for it?',
  'What is the most relevant feedback in the past week?',
  'Which customers are the most frustrated?',
];

const styles = (theme: Theme) => createStyles({
  outer: {
    height: '100%',
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inner: {
    margin: theme.spacing(4),
    maxWidth: 512,
  },
});
const useStyles = makeStyles(styles);

export const DashboardTalkNewConvo = (props: {
  onSubmitMessage: (message: string) => Promise<Client.CreateMessageResponse>;
}) => {
  const classes = useStyles();

  return (
    <div className={classes.outer}>
      <Table size="medium" className={classes.inner}>
        <Typography variant="h4">Ask me anything</Typography>
        <p>
          <Typography variant="body2">I am trained on your users' feedback daily.</Typography>
        </p>
        <TableBody>
          {PredefinedQuestions.map(question => (
            <TableRow
              key={question}
              hover
              component={MuiLink}
              onClick={() => props.onSubmitMessage(question)}
              underline="none"
              style={{ cursor: 'pointer' }}
            >
              <TableCell><Typography>{question}</Typography></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
