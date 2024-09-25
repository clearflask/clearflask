// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import { createStyles, makeStyles, Theme } from '@material-ui/core/styles';
import React from 'react';
import { shallowEqual, useSelector } from 'react-redux';
import { ReduxState } from '../../api/server';
import * as Client from '../../api/client';
import UserWithAvatarDisplay from '../../common/UserWithAvatarDisplay';
import classNames from 'classnames';
import { Alert } from '@material-ui/lab';
import TimeAgoI18n from '../../app/utils/TimeAgoI18n';
import { Typography } from '@material-ui/core';

const styles = (theme: Theme) => createStyles({
  outer: {
    display: 'flex',
    flexDirection: 'column',
    padding: theme.spacing(4),
  },
  inner: {
    display: 'flex',
    flexDirection: 'column',
    margin: theme.spacing(1, 2),
    padding: theme.spacing(1, 2),
    maxWidth: '70%',
    width: 'fit-content',
  },
  innerAi: {
    marginRight: 'auto',
  },
  innerUser: {
    marginLeft: 'auto',
    whiteSpace: 'pre',
  },
  innerSystem: {
    marginRight: 'auto',
    marginLeft: 'auto',
  },
  messageHeader: {
    display: 'flex',
    justifyContent: 'left',
    alignItems: 'baseline',
  },
});
const useStyles = makeStyles(styles);

const LlmUser = {
  userId: 'llm',
  name: 'ClearFlask AI',
  isMod: true,
};

export const DashboardTalkConvo = (props: {
  convoId: string;
}) => {
  const classes = useStyles();
  const messages = useSelector<ReduxState, Client.ConvoMessage[] | undefined>(state => state.llm.convoDetailsByConvoId[props.convoId]?.messages, shallowEqual);
  const loggedInUser = useSelector<ReduxState, Client.User | undefined>(state => state.users.loggedIn.user, shallowEqual);

  return (
    <div className={classes.outer}>
      {messages?.map(message => (
        <div key={message.messageId} className={classNames(
          classes.inner,
          message.authorType === Client.ConvoMessageAuthorTypeEnum.USER && classes.innerUser,
          message.authorType === Client.ConvoMessageAuthorTypeEnum.AI && classes.innerAi,
          message.authorType === Client.ConvoMessageAuthorTypeEnum.SYSTEM && classes.innerSystem,
        )}>
          {message.authorType === Client.ConvoMessageAuthorTypeEnum.SYSTEM ? (
            <Alert severity="warning">{message.content}</Alert>
          ) : (
            <>
              <div className={classes.messageHeader}>
                <UserWithAvatarDisplay
                  user={message.authorType === Client.ConvoMessageAuthorTypeEnum.USER ? loggedInUser : LlmUser}
                  baseline
                />
                <Typography variant="caption" color="textSecondary">
                  <TimeAgoI18n date={message.created} />
                </Typography>
              </div>
              {message.content}
            </>
          )}
        </div>
      ))}
    </div>
  );
};
