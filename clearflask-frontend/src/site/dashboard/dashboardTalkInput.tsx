// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import { Button, InputBase } from '@material-ui/core';
import { createStyles, makeStyles, Theme } from '@material-ui/core/styles';
import React, { useCallback, useState } from 'react';
import AiIcon from '../../common/icon/AiIcon';
import { Server } from '../../api/server';
import * as Client from '../../api/client';

const styles = (theme: Theme) => createStyles({
  input: {
    display: 'flex',
    alignItems: 'center',
    color: theme.palette.text.hint,
  },
  aiIcon: {
    margin: theme.spacing(2),
    marginRight: 0,
  },
  inputText: {
    margin: theme.spacing(1.5),
  },
});
const useStyles = makeStyles(styles);

export const DashboardTalkInput = (props: {
  server: Server;
  onSubmitMessage: (message: string) => Promise<Client.CreateMessageResponse>;
}) => {
  const classes = useStyles();
  const [value, setValue] = React.useState('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

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

  return (
    <div className={classes.input}>
      <AiIcon
        className={classes.aiIcon}
        color="inherit"
      />
      <InputBase
        className={classes.inputText}
        placeholder={'Talk to your customer'}
        multiline
        fullWidth
        value={value}
        disabled={isSubmitting}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onSubmit();
          }
        }}
      />
      <Button disabled={isSubmitting} onClick={() => onSubmit()}>Send</Button>
    </div>
  );
};
