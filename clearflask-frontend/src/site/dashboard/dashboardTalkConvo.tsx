// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import { createStyles, makeStyles, Theme } from '@material-ui/core/styles';
import React, { useEffect } from 'react';
import { shallowEqual, useSelector } from 'react-redux';
import { ReduxState, Server, Status } from '../../api/server';
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
  server: Server;
  convoId: string;
  talkUpcomingMessageId?: string;
}) => {
  const classes = useStyles();
  const status = useSelector<ReduxState, Status | undefined>(state => state.llm.convoDetailsByConvoId[props.convoId]?.status, shallowEqual);
  const messages = useSelector<ReduxState, Client.ConvoMessage[] | undefined>(state => state.llm.convoDetailsByConvoId[props.convoId]?.messages, shallowEqual);
  const loggedInUser = useSelector<ReduxState, Client.User | undefined>(state => state.users.loggedIn.user, shallowEqual);
  const [upcomingMessageStr, setUpcomingMessageStr] = React.useState<string>('');

  useEffect(() => {
    if (status !== undefined) {
      return;
    }
    props.server.dispatch().then(d => d.convoDetails({
      projectId: props.server.getProjectId(),
      convoId: props.convoId,
    }));
  }, [props.convoId, props.server, status]);

  const upcomingMessageArrived = messages?.some(m => m.messageId === props.talkUpcomingMessageId);
  useEffect(() => {
    if (!props.talkUpcomingMessageId || upcomingMessageArrived) {
      return;
    }
    const convoId = props.convoId;
    const messageId = props.talkUpcomingMessageId;
    var partialMsg = '';

    const eventSourcePromise = props.server.dispatch().then(d => d.messageStreamGet({
      projectId: props.server.getProjectId(),
      convoId,
      messageId,
    })).then(eventSource => {
      eventSource.onmessage = e => {
        switch (e.type) {
          case 'token':
            partialMsg += e.data;
            setUpcomingMessageStr(partialMsg);
            break;
          case 'message':
            const newMessage: Client.ConvoMessage = JSON.parse(e.data);
            props.server.getStore().dispatch({
              type: 'llmSetMessage',
              payload: {
                convoId,
                message: newMessage,
              },
            });
            eventSource.close();
            break;
        }
      };
      eventSource.onerror = e => {
        props.server.getStore().dispatch({
          type: 'llmSetMessage',
          payload: {
            convoId,
            message: {
              messageId,
              created: new Date(),
              authorType: Client.ConvoMessageAuthorTypeEnum.ALERT,
              content: 'Failed to retrieve message, try refreshing the page.',
            },
          },
        });
      };
      return eventSource;
    });

    return () => {
      eventSourcePromise.then(eventSource => eventSource.close());
    };
  }, [
    props.convoId,
    props.server,
    props.talkUpcomingMessageId,
    upcomingMessageArrived,
  ]);

  return (
    <div className={classes.outer}>
      {messages?.map(message => (
        <div key={message.messageId} className={classNames(
          classes.inner,
          message.authorType === Client.ConvoMessageAuthorTypeEnum.USER && classes.innerUser,
          message.authorType === Client.ConvoMessageAuthorTypeEnum.AI && classes.innerAi,
          message.authorType === Client.ConvoMessageAuthorTypeEnum.ALERT && classes.innerSystem,
        )}>
          {message.authorType === Client.ConvoMessageAuthorTypeEnum.ALERT ? (
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
      {!!props.talkUpcomingMessageId && !upcomingMessageArrived && (
        <div key="upcoming" className={classNames(
          classes.inner,
          classes.innerAi,
        )}>
          <div className={classes.messageHeader}>
            <UserWithAvatarDisplay
              user={LlmUser}
              baseline
            />
            <Typography variant="caption" color="textSecondary">
              <TimeAgoI18n date={new Date()} />
            </Typography>
          </div>
          {upcomingMessageStr}
        </div>
      )}
    </div>
  );
};
