// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import { createStyles, makeStyles, Theme } from '@material-ui/core/styles';
import React, { useEffect, useRef } from 'react';
import { Provider, shallowEqual, useSelector } from 'react-redux';
import { ReduxState, Server, Status } from '../../api/server';
import * as Client from '../../api/client';
import * as Admin from '../../api/admin';
import UserWithAvatarDisplay from '../../common/UserWithAvatarDisplay';
import classNames from 'classnames';
import { Alert } from '@material-ui/lab';
import TimeAgoI18n from '../../app/utils/TimeAgoI18n';
import { Typography } from '@material-ui/core';
import { contentScrollApplyStyles, Orientation } from '../../common/ContentScroll';
import ServerAdmin, { ReduxStateAdmin } from '../../api/serverAdmin';
import MarkdownElement from '../../app/utils/MarkdownElement';

// Estimated token prices; gpt-4o-mini https://openai.com/api/pricing/
const INPUT_TOKEN_PRICE_PER_MILLION = 0.150;
const OUTPUT_TOKEN_PRICE_PER_MILLION = 0.600;

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
  tokens: {
    marginLeft: theme.spacing(1),
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
  const projectId = props.server.getProjectId();
  const classes = useStyles();
  const status = useSelector<ReduxStateAdmin, Status | undefined>(state => state.llm.byProjectId[projectId]?.convoDetailsByConvoId?.[props.convoId]?.status, shallowEqual);
  const messages = useSelector<ReduxStateAdmin, Admin.ConvoMessage[] | undefined>(state => state.llm.byProjectId[projectId]?.convoDetailsByConvoId?.[props.convoId]?.messages, shallowEqual);
  const [upcomingMessageStr, setUpcomingMessageStr] = React.useState<string>('');
  const upcomingMessageId = useSelector<ReduxStateAdmin, string | undefined>(state => state.llm.byProjectId[projectId]?.convoDetailsByConvoId?.[props.convoId]?.upcomingMessageId, shallowEqual);
  const chatScrollRef = useChatScroll([messages?.length, upcomingMessageStr]);

  useEffect(() => {
    if (status !== undefined) {
      return;
    }
    props.server.dispatchAdmin().then(d => d.convoDetailsAdmin({
      projectId,
      convoId: props.convoId,
    }));
  }, [projectId, props.convoId, props.server, status]);

  useEffect(() => {
    if (!upcomingMessageId) {
      return;
    }
    const convoId = props.convoId;
    const messageId = upcomingMessageId;
    let partialMsg = '';

    const eventSourcePromise = props.server.dispatchAdmin().then(d => {
      let eventSource = d.messageStreamGetAdmin({
        projectId,
        convoId,
        messageId,
      });
      eventSource.addEventListener('token', e => {
        if (e['data']) {
          partialMsg += e['data'];
          setUpcomingMessageStr(partialMsg);
        }
      });
      eventSource.onmessage = e => {
        const newMessage: Admin.ConvoMessage = JSON.parse(e.data);
        ServerAdmin.get().getStore().dispatch({
          type: 'llmSetMessage',
          payload: {
            projectId,
            convoId,
            message: newMessage,
          },
        });
        setUpcomingMessageStr('');
        eventSource.close();
      };
      eventSource.onerror = e => {
        ServerAdmin.get().getStore().dispatch({
          type: 'llmSetMessage',
          payload: {
            projectId,
            convoId,
            message: {
              messageId,
              created: new Date(),
              authorType: Admin.ConvoMessageAuthorTypeEnum.ALERT,
              content: 'Failed to retrieve message, try refreshing the page.',
            },
          },
        });
        eventSource.close();
      };
      return eventSource;
    });

    return () => {
      eventSourcePromise.then(eventSource => eventSource.close());
    };
    // eslint-disable-next-line
  }, [upcomingMessageId]);

  const isSuperAdminLoggedIn = ServerAdmin.get().isSuperAdminLoggedIn();

  return (
    <div className={classes.outer} ref={chatScrollRef}>
      {messages?.map(message => (
        <div key={message.messageId} className={classNames(
          classes.inner,
          message.authorType === Admin.ConvoMessageAuthorTypeEnum.USER && classes.innerUser,
          message.authorType === Admin.ConvoMessageAuthorTypeEnum.AI && classes.innerAi,
          message.authorType === Admin.ConvoMessageAuthorTypeEnum.ALERT && classes.innerSystem,
        )}>
          {message.authorType === Admin.ConvoMessageAuthorTypeEnum.ALERT ? (
            <Alert severity="warning">{message.content}</Alert>
          ) : (
            <>
              <div className={classes.messageHeader}>
                {message.authorType === Admin.ConvoMessageAuthorTypeEnum.USER ? (
                  <Provider key={projectId} store={props.server.getStore()}>
                    <MeWithAvatarDisplay />
                  </Provider>
                ) : (
                  <UserWithAvatarDisplay user={LlmUser} baseline />
                )}
                <Typography variant="caption" color="textSecondary">
                  <TimeAgoI18n date={message.created} />
                </Typography>
                {isSuperAdminLoggedIn && message.inputTokenCount !== undefined && message.outputTokenCount !== undefined && (
                  <Typography variant="caption" color="textSecondary" className={classes.tokens}>
                    {((INPUT_TOKEN_PRICE_PER_MILLION * message.inputTokenCount / 1000000)
                      + (OUTPUT_TOKEN_PRICE_PER_MILLION * message.outputTokenCount / 1000000))
                      .toLocaleString('en-US', {
                        style: 'currency',
                        currency: 'USD',
                        maximumSignificantDigits: 2,
                      })
                    } [IN:{message.inputTokenCount}] [OUT:{message.outputTokenCount}]
                  </Typography>
                )}
              </div>
              <Typography variant="body1">
                {message.authorType === Admin.ConvoMessageAuthorTypeEnum.AI ? (
                  <MarkdownElement text={message.content} />
                ) : (
                  message.content
                )}
              </Typography>
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
          <Typography variant="body1">
            <MarkdownElement text={upcomingMessageStr || '...'} />
          </Typography>
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

export const MeWithAvatarDisplay = (props: React.ComponentProps<typeof UserWithAvatarDisplay>) => {
  const loggedInUser = useSelector<ReduxState, Client.User | undefined>(state => state.users.loggedIn.user, shallowEqual);
  return (
    <UserWithAvatarDisplay user={loggedInUser} {...props} />
  );
};
