// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import { Button, InputBase } from '@material-ui/core';
import { createStyles, makeStyles, Theme } from '@material-ui/core/styles';
import React, { useCallback, useState } from 'react';
import AiIcon from '../../common/icon/AiIcon';
import { Server } from '../../api/server';
import * as Admin from '../../api/admin';
import { shallowEqual, useSelector } from 'react-redux';
import { ReduxStateAdmin } from '../../api/serverAdmin';

const styles = (theme: Theme) => createStyles({
  input: {
    display: 'flex',
    alignItems: 'center',
    color: theme.palette.text.hint,
  },
  aiIcon: {
    margin: theme.spacing(3),
    marginRight: 0,
  },
  inputText: {
    margin: theme.spacing(3),
  },
  sendButton: {
    margin: theme.spacing(3),
  },
});
const useStyles = makeStyles(styles);

export const DashboardTalkInput = (props: {
  server: Server;
  convoId?: string;
  onSubmitMessage: (message: string) => Promise<Admin.CreateMessageResponse>;
}) => {
  const classes = useStyles();
  const [value, setValue] = React.useState('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const hasUpcomingMessage = useSelector<ReduxStateAdmin, boolean>(state => !!props.convoId && !!state.llm.convoDetailsByConvoId[props.convoId]?.upcomingMessageId, shallowEqual);

  const onSubmit = useCallback(async () => {
    if (!value.trim().length) {
      return;
    }
    setIsSubmitting(true);
    try {
      await props.onSubmitMessage(value);
    } finally {
      setIsSubmitting(false);
    }

    setValue('');
  }, [props, value]);

  const isDisabled = isSubmitting || hasUpcomingMessage;

  return (
    <div className={classes.input}>
      <AiIcon
        className={classes.aiIcon}
        color="inherit"
      />
      <InputBase
        className={classes.inputText}
        placeholder={'Ask'}
        multiline
        fullWidth
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (!isDisabled) {
              onSubmit();
            }
          }
        }}
      />
      <Button
        className={classes.sendButton}
        disabled={isDisabled}
        onClick={() => onSubmit()}
      >
        Send
      </Button>
    </div>
  );
};
