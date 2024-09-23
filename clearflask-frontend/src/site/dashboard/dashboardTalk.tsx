// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import CreateIcon from '@material-ui/icons/Create';
import React from 'react';
import { Provider } from 'react-redux';
import * as Admin from '../../api/admin';
import { Orientation } from '../../common/ContentScroll';
import { LayoutState } from '../../common/Layout';
import setTitle from "../../common/util/titleUtil";
import { Dashboard, DashboardPageContext, PostPreviewSize } from "../Dashboard";
import DashboardPostFilterControls from './DashboardPostFilterControls';
import DashboardSearchControls from './DashboardSearchControls';
import PostList from './PostList';
import { DashboardTalkConvoList, dashboardTalkConvoList } from './dashboardTalkConvoList';
import { DashboardTalkInput } from './dashboardTalkInput';
import { DashboardTalkNewConvo } from './dashboardTalkNewConvo';
import { DashboardTalkConvo } from './dashboardTalkConvo';

export async function renderTalk(this: Dashboard, context: DashboardPageContext) {
  setTitle('Talk - Dashboard');
  if (!context.activeProject) {
    context.showCreateProjectWarning = true;
    return;
  }
  const activeProject = context.activeProject;

  context.sections.push({
    name: 'convos',
    breakAction: 'drawer',
    breakPriority: 10,
    collapseRight: true,
    size: { breakWidth: 200, flexGrow: 100, width: 'max-content', maxWidth: 'max-content', scroll: Orientation.Vertical },
    content:  layoutState => (
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
    content: !this.state.talkSelectedConvoId ? (
      <Provider key={activeProject.projectId} store={activeProject.server.getStore()}>
        <DashboardTalkNewConvo />
      </Provider>
    ) : (
      <Provider key={activeProject.projectId} store={activeProject.server.getStore()}>
        <DashboardTalkConvo convoId={this.state.talkSelectedConvoId} />
      </Provider>
    ),
    barBottom: layoutState => (
      <DashboardTalkInput
        onSubmit={input => {
          // TODO: Send input to server
        }}
      />
    ),
  });

  context.showProjectLink = true;
}
