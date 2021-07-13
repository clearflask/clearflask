import React from 'react';
import { Provider } from 'react-redux';
import * as Admin from '../../api/admin';
import { Orientation } from '../../common/ContentScroll';
import { LayoutState, Section } from '../../common/Layout';
import setTitle from "../../common/util/titleUtil";
import { Dashboard, DashboardPageContext, PostPreviewSize } from "../Dashboard";
import DashboardPostFilterControls from './DashboardPostFilterControls';
import DashboardSearchControls from './DashboardSearchControls';
import PostList from './PostList';

export async function renderExplore(this: Dashboard, context: DashboardPageContext) {
  setTitle('Explore - Dashboard');
  if (!context.activeProject) {
    context.showCreateProjectWarning = true;
    return;
  }
  const activeProject = context.activeProject;

  const explorerPostSearch = {
    ...this.state.explorerPostSearch,
    // This along with forceSingleCategory ensures one and only one category is selected
    filterCategoryIds: this.state.explorerPostSearch?.filterCategoryIds?.length
      ? this.state.explorerPostSearch.filterCategoryIds
      : (activeProject.editor.getConfig().content.categories.length
        ? [activeProject.editor.getConfig().content.categories[0]?.categoryId]
        : undefined),
    // Sort by new by default
    sortBy: this.state.explorerPostSearch?.sortBy || Admin.IdeaSearchAdminSortByEnum.New,
  };
  const explorerFilters = (layoutState: LayoutState) => (
    <Provider key={activeProject.projectId} store={activeProject.server.getStore()}>
      <DashboardPostFilterControls
        key={activeProject.server.getProjectId()}
        server={activeProject.server}
        search={explorerPostSearch}
        onSearchChanged={explorerPostSearch => this.setState({ explorerPostSearch })}
        horizontal={layoutState.isShown('filters') !== 'show'}
      />
    </Provider>
  );

  context.sections.push({
    name: 'filters',
    breakAction: 'hide',
    breakPriority: 10,
    collapseLeft: true, collapseTopBottom: true,
    size: { breakWidth: 200, flexGrow: 100, width: 'max-content', maxWidth: 'max-content', scroll: Orientation.Vertical },
    content: layoutState => layoutState.isShown('filters') !== 'show' ? null : explorerFilters(layoutState),
  });

  context.sections.push({
    name: 'list',
    size: { breakWidth: 350, flexGrow: 20, maxWidth: 1024, scroll: Orientation.Vertical },
    collapseLeft: true, collapseTopBottom: true,
    barTop: layoutState => (
      <DashboardSearchControls
        placeholder='Search all content'
        key={'explorer-search-bar' + activeProject.server.getProjectId()}
        searchText={explorerPostSearch.searchText || ''}
        onSearchChanged={searchText => this.setState({
          explorerPostSearch: {
            ...this.state.explorerPostSearch,
            searchText,
          }
        })}
        filters={layoutState.isShown('filters') === 'show' ? null : explorerFilters(layoutState)}
      />
    ),
    content: (
      <Provider key={activeProject.projectId} store={activeProject.server.getStore()}>
        <PostList
          key={activeProject.server.getProjectId()}
          server={activeProject.server}
          search={explorerPostSearch}
          onClickPost={postId => this.pageClicked('post', [postId])}
          onUserClick={userId => this.pageClicked('user', [userId])}
          selectable
          selected={this.state.explorerPreview?.type === 'post' ? this.state.explorerPreview.id : undefined}
        />
      </Provider>
    ),
  });

  var preview: Section;
  if (this.state.explorerPreview?.type === 'create') {
    preview = this.renderPreviewPostCreate(activeProject);
  } else if (this.state.explorerPreview?.type === 'post') {
    preview = this.renderPreviewPost(this.state.explorerPreview.id, activeProject);
  } else {
    preview = this.renderPreviewEmpty('No post selected', PostPreviewSize);
  }
  preview.header = {
    title: { title: 'Explore' },
    action: { label: 'Create', onClick: () => this.pageClicked('post') },
  };
  context.sections.push(preview);

  context.showProjectLink = true;
}
