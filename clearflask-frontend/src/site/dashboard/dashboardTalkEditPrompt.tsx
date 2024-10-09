// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import { createStyles, makeStyles, Theme } from '@material-ui/core/styles';
import React, { useEffect } from 'react';
import { InputBase, Typography } from '@material-ui/core';
import { useDebounceProp } from './ProjectSettings';
import { shallowEqual, useSelector } from 'react-redux';
import { Server } from '../../api/server';
import { ReduxStateAdmin } from '../../api/serverAdmin';
import { contentScrollApplyStyles, Orientation, Side } from '../../common/ContentScroll';

const styles = (theme: Theme) => createStyles({
  outer: {
    height: '100%',
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    padding: theme.spacing(4),
    gap: theme.spacing(2),
    ...contentScrollApplyStyles({ theme, side: Side.Center, orientation: Orientation.Vertical }),
  },
});
const useStyles = makeStyles(styles);

export const DashboardTalkEditPrompt = (props: {
  server: Server;
  overridePrompt: string | undefined;
  setOverridePrompt: (prompt: string | undefined) => void;
}) => {
  const classes = useStyles();

  const promptOriginal = useSelector<ReduxStateAdmin, string | undefined>(state => state.llm.prompt?.prompt, shallowEqual);
  const [prompt, setPrompt, setPromptInitial] = useDebounceProp<string | undefined>(
    props.overridePrompt !== undefined ? props.overridePrompt : promptOriginal,
    newValue => props.setOverridePrompt(newValue));

  const promptStatus = useSelector<ReduxStateAdmin, string | undefined>(state => state.llm.prompt?.status, shallowEqual);
  useEffect(() => {
    if (promptStatus !== undefined) return;
    props.server.dispatchAdmin().then(d => d.promptGetSuperAdmin({
      projectId: props.server.getProjectId(),
    })).then(result => {
      setPromptInitial(result.prompt);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [promptStatus]);

  return (
    <div className={classes.outer}>
      <div>
        <Typography variant="h4">Edit prompt</Typography>
        <Typography variant="body1">Temporarily changes prompt for all future messages. Changes are lost if you refresh
          the page</Typography>
      </div>
      <InputBase
        placeholder={promptStatus === 'FULFILLED' ? undefined : 'Loading...'}
        multiline
        fullWidth
        value={prompt}
        onChange={e => setPrompt(e.target.value)}
        autoFocus
      />
    </div>
  );
};
