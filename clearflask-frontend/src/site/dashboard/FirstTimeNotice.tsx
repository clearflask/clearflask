// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import {
    Button,
    Checkbox,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    FormControlLabel,
} from '@material-ui/core';
import { createStyles, makeStyles, Theme } from '@material-ui/core/styles';
import classNames from 'classnames';
import React, { useImperativeHandle, useRef, useState } from 'react';
import { shallowEqual, useSelector } from 'react-redux';
import ServerAdmin, { ReduxStateAdmin } from '../../api/serverAdmin';

const ConfirmedButShowAgain: string = 'show';
const ConfirmedAndDontShowAgain: string = 'hide';

const styles = (theme: Theme) => createStyles({
  dontShowAgainCheckbox: {
    marginLeft: theme.spacing(1),
    flexGrow: 1,
  },
  dontShowAgainCheckboxRed: {
    color: theme.palette.error.main,
  },
});
const useStyles = makeStyles(styles);
export type FirstTimeNoticeHandle = {
  invoke: () => Promise<boolean>;
}
const FirstTimeNotice = React.forwardRef((props: {
  id: string;
  title: string;
  description: string;
  confirmButtonTitle?: string;
  confirmButtonRed?: boolean;
}, ref: React.Ref<FirstTimeNoticeHandle>) => {
  const classes = useStyles();
  const dialogId = `notice-${props.id}`;
  const noticeStatus = useSelector<ReduxStateAdmin, string | undefined>(state => state.account.account.account?.attrs?.[dialogId], shallowEqual);
  const [dontShowAgain, setDontShowAgain] = useState(noticeStatus !== ConfirmedButShowAgain);
  const isHidden = noticeStatus === ConfirmedAndDontShowAgain;
  const isHiddenOnFirstRender = useRef(isHidden);
  const [dialogState, setDialogState] = useState<((confirmed: boolean, dontShowAgain: boolean) => void) | undefined>(undefined);
  useImperativeHandle(ref, () => ({
    invoke: isHidden ? () => Promise.resolve(true) : async () => {
      const dialogResult = await new Promise<{ confirmed: boolean, dontShowAgain: boolean }>(resolve =>
        setDialogState(() => (confirmed, dontShowAgain) =>
          resolve({ confirmed, dontShowAgain })));
      if (dialogResult.confirmed) {
        const newNoticeStatus = dialogResult.dontShowAgain ? ConfirmedAndDontShowAgain : ConfirmedButShowAgain;
        if (newNoticeStatus !== noticeStatus)
          // Update in the background
          ServerAdmin.get().dispatchAdmin().then(dispatcher => dispatcher.accountAttrsUpdateAdmin({
            accountAttrsUpdateAdmin: {
              attrs: { [dialogId]: newNoticeStatus },
            },
          }));
      }
      return dialogResult.confirmed;
    },
  }), [isHidden, noticeStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isHiddenOnFirstRender.current) return null;

  const dialogConfirm = (confirmed: boolean) => {
    dialogState?.(confirmed, dontShowAgain);
    setDialogState(undefined);
  };
  return (
    <Dialog
      open={!!dialogState}
      onClose={() => dialogConfirm(false)}
    >
      <DialogTitle>{props.title}</DialogTitle>
      <DialogContent>
        <DialogContentText>{props.description}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <FormControlLabel
          label="Do not show this message again"
          className={classes.dontShowAgainCheckbox}
          control={(
            <Checkbox
              size="small"
              color="default"
              checked={dontShowAgain}
              onChange={e => setDontShowAgain(!dontShowAgain)}
            />
          )}
        />
        <Button onClick={() => dialogConfirm(false)}>Back</Button>
        <Button onClick={() => dialogConfirm(true)}
                color={props.confirmButtonRed ? undefined : 'primary'}
                className={classNames(props.confirmButtonRed && classes.dontShowAgainCheckboxRed)}
        >{props.confirmButtonTitle || 'Continue'}</Button>
      </DialogActions>
    </Dialog>
  );
});
FirstTimeNotice.displayName = 'FirstTimeNotice';
export default FirstTimeNotice;
