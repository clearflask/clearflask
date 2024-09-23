// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import { Button, IconButton, InputBase, TextField } from '@material-ui/core';
import { createStyles, makeStyles, Theme } from '@material-ui/core/styles';
import React from 'react';
import AiIcon from '../../common/icon/AiIcon';

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
  onSubmit: (input: string) => void;
}) => {
  const classes = useStyles();
  const [value, setValue] = React.useState('');

  const isInputDisabled = value.trim().length === 0;
  const onSubmit = () => {
    if(isInputDisabled) {
      return
    }
    props.onSubmit(value);
    setValue('');
  }

  return (
    <div className={classes.input}>
      <AiIcon
        className={classes.aiIcon}
        color='inherit'
      />
      <InputBase
        className={classes.inputText}
        placeholder={'Talk to your customer'}
        multiline
        fullWidth
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onSubmit();
          }
        }}
      />
      <Button disabled={isInputDisabled} onClick={() => onSubmit()}>Send</Button>
    </div>
  );
};
