// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import React from 'react';
import { Provider } from 'react-redux';
import { Orientation } from '../../common/ContentScroll';
import setTitle from '../../common/util/titleUtil';
import { Dashboard, DashboardPageContext } from '../Dashboard';
import { DashboardTalkConvoList } from './dashboardTalkConvoList';
import { DashboardTalkInput } from './dashboardTalkInput';
import { DashboardTalkNewConvo } from './dashboardTalkNewConvo';
import { DashboardTalkConvo } from './dashboardTalkConvo';
import CreateIcon from '@material-ui/icons/Create';
import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@material-ui/core';
import classNames from 'classnames';
import SubmitButton from '../../common/SubmitButton';

export async function renderTalk(this: Dashboard, context: DashboardPageContext) {
  setTitle('Talk - Dashboard');
  if (!context.activeProject) {
    context.showCreateProjectWarning = true;
    return;
  }
  const activeProject = context.activeProject;

  const onSubmitMessage = async (message: string) => {
    const response = await (await activeProject.server.dispatch()).messageCreate({
      projectId: activeProject.server.getProjectId(),
      convoId: this.state.talkSelectedConvoId,
      convoMessageCreate: {
        content: message,
      },
    });
    if (this.state.talkSelectedConvoId === undefined) {
      this.setState({ talkSelectedConvoId: response.convoId });
    }
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
      <Provider key={activeProject.projectId} store={activeProject.server.getStore()}>
        <DashboardTalkConvoList
          key={activeProject.server.getProjectId()}
          server={activeProject.server}
          selectedConvoId={this.state.talkSelectedConvoId}
          setSelectedConvoId={convoId => this.setState({ talkSelectedConvoId: convoId })}
        />
      </Provider>
    ),
  });

  context.sections.push({
    name: 'list',
    size: { breakWidth: 350, flexGrow: 20, maxWidth: 1024, scroll: Orientation.Vertical },
    header: {
      title: { title: 'Talk' },
      action: !this.state.talkSelectedConvoId ? undefined : {
        label: 'New',
        icon: CreateIcon,
        onClick: () => this.setState({ talkSelectedConvoId: undefined }),
      },
      right: !this.state.talkSelectedConvoId ? undefined : (
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
          <Dialog
            open={!!this.state.talkDeleteConvoShowDialog && !!this.state.talkSelectedConvoId}
            onClose={() => this.setState({ talkDeleteConvoShowDialog: false })}
          >
            <DialogTitle>Delete conversation</DialogTitle>
            <DialogContent>
              <DialogContentText>Are you sure you want to permanently delete this conversation?</DialogContentText>
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
                  activeProject.server.dispatch().then(d => d.convoDelete({
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
    content: !this.state.talkSelectedConvoId ? (
      <Provider key={activeProject.projectId} store={activeProject.server.getStore()}>
        <DashboardTalkNewConvo
          onSubmitMessage={onSubmitMessage}
        />
      </Provider>
    ) : (
      <Provider key={activeProject.projectId} store={activeProject.server.getStore()}>
        <DashboardTalkConvo
          server={activeProject.server}
          convoId={this.state.talkSelectedConvoId}
        />
      </Provider>
    ),
    barBottom: layoutState => (
      <Provider key={activeProject.projectId} store={activeProject.server.getStore()}>
        <DashboardTalkInput
          server={activeProject.server}
          onSubmitMessage={onSubmitMessage}
        />
      </Provider>
    ),
  });

  context.showProjectLink = true;
}
