// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import React from 'react';
import { Orientation } from '../../common/ContentScroll';
import setTitle from '../../common/util/titleUtil';
import { Dashboard, DashboardPageContext } from '../Dashboard';
import { DashboardTalkConvoList } from './dashboardTalkConvoList';
import { DashboardTalkInput } from './dashboardTalkInput';
import { DashboardTalkNewConvo } from './dashboardTalkNewConvo';
import { DashboardTalkConvo } from './dashboardTalkConvo';
import CreateIcon from '@material-ui/icons/Create';
import { Button, Chip, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@material-ui/core';
import classNames from 'classnames';
import SubmitButton from '../../common/SubmitButton';
import SettingsIcon from '@material-ui/icons/Settings';
import { DashboardTalkEditPrompt } from './dashboardTalkEditPrompt';

export async function renderTalk(this: Dashboard, context: DashboardPageContext) {
  setTitle('Talk - Dashboard');
  if (!context.activeProject) {
    context.showCreateProjectWarning = true;
    return;
  }
  const activeProject = context.activeProject;

  const onSubmitMessage = async (message: string) => {
    const response = await (await activeProject.server.dispatchAdmin()).messageCreateAdmin({
      projectId: activeProject.server.getProjectId(),
      convoId: this.state.talkSelectedConvoId || 'new',
      convoMessageCreate: {
        content: message,
        overridePrompt: this.state.talkPromptOverride,
      },
    });
    if (this.state.talkSelectedConvoId === undefined) {
      this.setState({ talkSelectedConvoId: response.convoId });
    }
    this.setState({ talkPromptEditShow: false });
    return response;
  };

  context.sections.push({
    name: 'convos',
    breakAction: 'drawer',
    breakPriority: 10,
    size: {
      breakWidth: 200,
      flexGrow: 100,
      width: 'max-content',
      maxWidth: 256,
      scroll: Orientation.Vertical,
    },
    content: layoutState => (
      <DashboardTalkConvoList
        key={activeProject.server.getProjectId()}
        server={activeProject.server}
        selectedConvoId={this.state.talkSelectedConvoId}
        setSelectedConvoId={convoId => this.setState({
          talkSelectedConvoId: convoId,
          talkPromptEditShow: false,
        })}
      />
    ),
  });

  const settingsButton = (
    <Button
      endIcon={<SettingsIcon />}
      className={classNames(this.props.classes.headerAction)}
      onClick={() => this.setState({ talkPromptEditShow: !this.state.talkPromptEditShow })}
      color="inherit"
    >
      {!this.state.talkPromptEditShow ? 'PROMPT' : 'CLOSE'}
    </Button>
  );

  context.sections.push({
    name: 'list',
    size: { breakWidth: 350, flexGrow: 20, maxWidth: 1024 },
    header: {
      title: {
        title: 'Talk',
      },
      left: (
        <Chip
          className={this.props.classes.talkFeaturePreview}
          variant="outlined"
          label="Feature preview"
          size="small"
        />
      ),
      action: (!this.state.talkSelectedConvoId || !!this.state.talkPromptEditShow) ? undefined : {
        label: 'New',
        icon: CreateIcon,
        onClick: () => this.setState({
          talkPromptEditShow: false,
          talkSelectedConvoId: undefined,
        }),
      },
      right: (!this.state.talkSelectedConvoId || !!this.state.talkPromptEditShow) ? settingsButton : (
        <>
          <Button
            className={classNames(this.props.classes.headerAction, this.props.classes.buttonRed)}
            onClick={() => {
              if (!this.state.talkSelectedConvoId) {
                return;
              }
              this.setState({ talkDeleteConvoShowDialog: true });
            }}
            color="inherit"
          >
            DELETE
          </Button>
          {settingsButton}
          <Dialog
            open={!!this.state.talkDeleteConvoShowDialog && !!this.state.talkSelectedConvoId}
            onClose={() => this.setState({ talkDeleteConvoShowDialog: false })}
          >
            <DialogTitle>Delete conversation</DialogTitle>
            <DialogContent>
              <DialogContentText>Are you sure you want to permanently delete this
                conversation?</DialogContentText>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => this.setState({ talkDeleteConvoShowDialog: false })}>Cancel</Button>
              <SubmitButton
                isSubmitting={this.state.talkDeleteConvoIsSubmitting}
                style={{ color: !this.state.talkDeleteConvoIsSubmitting ? this.props.theme.palette.error.main : undefined }}
                onClick={() => {
                  if (this.state.talkSelectedConvoId === undefined) {
                    return;
                  }
                  this.setState({ talkDeleteConvoIsSubmitting: true });
                  activeProject.server.dispatchAdmin().then(d => d.convoDeleteAdmin({
                    projectId: activeProject.server.getProjectId(),
                    convoId: this.state.talkSelectedConvoId!,
                  }).then(() => {
                    this.setState({
                      talkSelectedConvoId: undefined,
                      talkDeleteConvoIsSubmitting: false,
                      talkDeleteConvoShowDialog: false,
                    });
                  })
                    .catch(e => this.setState({ talkDeleteConvoIsSubmitting: false })));
                }}>Delete</SubmitButton>
            </DialogActions>
          </Dialog>
        </>
      ),
    },
    content: (
      <>
        {!!this.state.talkPromptEditShow && (
          <DashboardTalkEditPrompt
            server={activeProject.server}
            overridePrompt={this.state.talkPromptOverride}
            setOverridePrompt={prompt => this.setState({ talkPromptOverride: prompt })}
          />
        )}
        {!this.state.talkPromptEditShow && !this.state.talkSelectedConvoId && (
          <DashboardTalkNewConvo
            onSubmitMessage={onSubmitMessage}
          />
        )}
        {!this.state.talkPromptEditShow && !!this.state.talkSelectedConvoId && (
          <DashboardTalkConvo
            server={activeProject.server}
            convoId={this.state.talkSelectedConvoId}
          />
        )}
      </>
    ),
    barBottom: !!this.state.talkPromptEditShow ? undefined : (layoutState => (
      <DashboardTalkInput
        server={activeProject.server}
        onSubmitMessage={onSubmitMessage}
        convoId={this.state.talkSelectedConvoId}
      />
    )),
  });

  context.showProjectLink = true;
}
