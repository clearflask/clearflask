// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import { Link as MuiLink, TableCell, Typography } from '@material-ui/core';
import { ReduxState, Server, Status } from '../../api/server';
import Loading from '../../app/utils/Loading';
import { createStyles, makeStyles, Theme } from '@material-ui/core/styles';
import React, { useEffect } from 'react';
import { shallowEqual, useSelector } from 'react-redux';
import { Convo } from '../../api/client';
import TimeAgoI18n from '../../app/utils/TimeAgoI18n';
import { DashboardEmptyPlaceholder } from '../DashboardEmptyPlaceholder';
import { TabFragment, TabsVertical } from '../../common/util/tabsUtil';
import { truncateWithElipsis } from '../../common/util/stringUtil';


const styles = (theme: Theme) => createStyles({
  convo: {
    padding: theme.spacing(2),
  },
});
const useStyles = makeStyles(styles);

export const DashboardTalkConvoList = (props: {
  server: Server;
  selectedConvoId?: string;
  setSelectedConvoId: (convoId: string | undefined) => void;
}) => {
  const classes = useStyles();
  const status = useSelector<ReduxState, Status | undefined>(state => state.llm.convoList?.status, shallowEqual);
  const convos = useSelector<ReduxState, Convo[] | undefined>(state => state.llm.convoList?.convos, shallowEqual);
  useEffect(() => {
    if (status !== undefined) {
      return;
    }

    props.server.dispatch().then(d => d.convoList({
      projectId: props.server.getProjectId(),
    }));
  }, [props.server, status]);

  if (!convos?.length) {
    return (
      <DashboardEmptyPlaceholder message={'No threads'} />
    );
  }

  return (
    <>
      <TabsVertical
        selected={props.selectedConvoId}
        onClick={convoId => props.setSelectedConvoId(convoId)}
      >
        {convos.map(convo => (
          <TabFragment
            key={convo.convoId}
            value={convo.convoId}
          >
            <MuiLink
              className={classes.convo}
              onClick={() => props.setSelectedConvoId(convo.convoId)}
              underline="none"
              style={{ cursor: 'pointer' }}
              color="inherit"
            >
              <Typography variant="caption" color="textSecondary">
                <TimeAgoI18n date={convo.created} />
              </Typography>
              <Typography>
                {truncateWithElipsis(100, convo.title)}
              </Typography>
            </MuiLink>
          </TabFragment>
        ))}
      </TabsVertical>
      {status === Status.PENDING && (
        <TableCell key="pending">
          <Loading />
        </TableCell>
      )}
      {status === Status.REJECTED && (
        <TableCell key="rejected">
          Failed to load conversations
        </TableCell>
      )}
    </>
  );
};
