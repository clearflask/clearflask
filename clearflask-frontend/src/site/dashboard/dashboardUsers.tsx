import { Divider } from '@material-ui/core';
import React from 'react';
import { Provider } from 'react-redux';
import { Orientation } from '../../common/ContentScroll';
import { Section } from '../../common/Layout';
import UserFilterControls from '../../common/search/UserFilterControls';
import setTitle from "../../common/util/titleUtil";
import { Dashboard, DashboardPageContext, UserPreviewSize } from "../Dashboard";
import DashboardSearchControls from './DashboardSearchControls';
import UserList from './UserList';

export async function renderUsers(this: Dashboard, context: DashboardPageContext) {
  setTitle('Users - Dashboard');
  if (!context.activeProject) {
    context.showCreateProjectWarning = true;
    return;
  }
  const activeProject = context.activeProject;

  context.sections.push({
    name: 'menu',
    breakAction: 'menu',
    size: { breakWidth: 200, flexGrow: 100, width: 'max-content', maxWidth: 'max-content', scroll: Orientation.Vertical },
    content: (
      <Provider key={activeProject.projectId} store={activeProject.server.getStore()}>
        <UserFilterControls
          key={activeProject.server.getProjectId()}
          search={this.state.usersUserFilter}
          onSearchChanged={usersUserFilter => this.setState({ usersUserFilter })}
        />
      </Provider>
    ),
  });

  context.sections.push({
    name: 'main',
    size: { breakWidth: 250, flexGrow: 20, maxWidth: 250 },
    content: (
      <>
        <DashboardSearchControls
          placeholder='Search for user'
          key={'user-search-bar' + activeProject.server.getProjectId()}
          searchText={this.state.usersUserSearch}
          onSearchChanged={searchText => this.setState({ usersUserSearch: searchText })}
        />
        <Divider />
        <Provider key={activeProject.projectId} store={activeProject.server.getStore()}>
          <UserList
            scroll
            server={activeProject.server}
            search={{
              ...this.state.usersUserFilter,
              searchText: this.state.usersUserSearch,
            }}
            selectable
            selected={this.state.usersPreview?.type === 'user' ? this.state.usersPreview.id : undefined}
            onUserClick={userId => this.pageClicked('user', [userId])}
          />
        </Provider>
      </>
    ),
  });

  var previewUser: Section;
  if (this.state.usersPreview?.type === 'create') {
    previewUser = this.renderPreviewUserCreate(activeProject);
  } else if (this.state.usersPreview?.type === 'user') {
    previewUser = this.renderPreviewUser(this.state.usersPreview.id, activeProject);
  } else {
    previewUser = this.renderPreviewEmpty('No user selected', UserPreviewSize);
  }
  previewUser.header = {
    title: { title: 'Users' },
    action: { label: 'Add', onClick: () => this.pageClicked('user') },
  };
  context.sections.push(previewUser);

  context.showProjectLink = true;
}
