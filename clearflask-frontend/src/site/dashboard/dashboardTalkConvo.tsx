// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import { createStyles, makeStyles, Theme } from '@material-ui/core/styles';
import React, { useEffect, useRef } from 'react';
import { shallowEqual, useSelector } from 'react-redux';
import { ReduxState, Server, Status } from '../../api/server';
import * as Client from '../../api/client';
import UserWithAvatarDisplay from '../../common/UserWithAvatarDisplay';
import classNames from 'classnames';
import { Alert } from '@material-ui/lab';
import TimeAgoI18n from '../../app/utils/TimeAgoI18n';
import { Typography } from '@material-ui/core';
import { contentScrollApplyStyles, Orientation } from '../../common/ContentScroll';

const styles = (theme: Theme) => createStyles({
  outer: {
    display: 'flex',
    flexDirection: 'column',
    padding: theme.spacing(4),
    height: '100%',
    width: '100%',
    ...contentScrollApplyStyles({
      theme,
      orientation: Orientation.Vertical,
      backgroundColor: theme.palette.background.paper,
    }),
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
}) => {
  const classes = useStyles();
  const status = useSelector<ReduxState, Status | undefined>(state => state.llm.convoDetailsByConvoId[props.convoId]?.status, shallowEqual);
  const messages = useSelector<ReduxState, Client.ConvoMessage[] | undefined>(state => state.llm.convoDetailsByConvoId[props.convoId]?.messages, shallowEqual);
  const loggedInUser = useSelector<ReduxState, Client.User | undefined>(state => state.users.loggedIn.user, shallowEqual);
  const [upcomingMessageStr, setUpcomingMessageStr] = React.useState<string>('');
  const upcomingMessageId = useSelector<ReduxState, string | undefined>(state => state.llm.convoDetailsByConvoId[props.convoId]?.upcomingMessageId, shallowEqual);
  const chatScrollRef = useChatScroll([messages?.length, upcomingMessageStr]);

  useEffect(() => {
    if (status !== undefined) {
      return;
    }
    props.server.dispatch().then(d => d.convoDetails({
      projectId: props.server.getProjectId(),
      convoId: props.convoId,
    }));
  }, [props.convoId, props.server, status]);

  useEffect(() => {
    if (!upcomingMessageId) {
      return;
    }
    const convoId = props.convoId;
    const messageId = upcomingMessageId;
    let partialMsg = '';

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
            setUpcomingMessageStr('');
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
    // eslint-disable-next-line
  }, [upcomingMessageId]);

  return (
    <div className={classes.outer} ref={chatScrollRef}>
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
      {!!upcomingMessageId && (
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
          {upcomingMessageStr || '...'}
        </div>
      )}
    </div>
  );
};

function useChatScroll(deps: any) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.scrollTop = ref.current.scrollHeight;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return ref;
}
