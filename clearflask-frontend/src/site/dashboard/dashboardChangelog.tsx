// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
import { Button, Divider } from '@material-ui/core';
import VisibilityIcon from '@material-ui/icons/Visibility';
import React from 'react';
import { Provider } from 'react-redux';
import * as Admin from '../../api/admin';
import { tourSetGuideState } from '../../common/ClearFlaskTourProvider';
import { Orientation } from '../../common/ContentScroll';
import { LayoutState } from '../../common/Layout';
import { TourAnchor, TourDefinitionGuideState } from '../../common/tour';
import setTitle from "../../common/util/titleUtil";
import { Dashboard, DashboardPageContext, getProjectLink, PostPreviewSize } from "../Dashboard";
import DashboardPostFilterControls from './DashboardPostFilterControls';
import DashboardSearchControls from './DashboardSearchControls';
import PostList from './PostList';

export async function renderChangelog(this: Dashboard, context: DashboardPageContext) {
  setTitle('Changelog - Dashboard');
  if (!context.activeProject) {
    context.showCreateProjectWarning = true;
    return;
  }
  const activeProject = context.activeProject;

  const changelogPostSearch = this.state.changelogPostSearch || {
    sortBy: Admin.IdeaSearchAdminSortByEnum.New,
  };
  if (this.state.changelog) changelogPostSearch.filterCategoryIds = [this.state.changelog.categoryAndIndex.category.categoryId];

  const changelogFilters = (layoutState: LayoutState) => (
    <Provider key={activeProject.projectId} store={activeProject.server.getStore()}>
      <DashboardPostFilterControls
        key={activeProject.server.getProjectId()}
        server={activeProject.server}
        search={changelogPostSearch}
        allowSearch={{ enableSearchByCategory: false }}
        permanentSearch={{ filterCategoryIds: this.state.changelog ? [this.state.changelog.categoryAndIndex.category.categoryId] : undefined }}
        onSearchChanged={changelogPostSearch => this.setState({ changelogPostSearch })}
        horizontal={layoutState.isShown('filters') !== 'show'}
      />
    </Provider>
  );
  context.sections.push({
    name: 'filters',
    breakAction: 'menu',
    size: { breakWidth: 200, flexGrow: 100, width: 'max-content', maxWidth: 'max-content', scroll: Orientation.Vertical },
    collapseRight: true,
    content: layoutState => layoutState.isShown('filters') !== 'show' ? null : changelogFilters(layoutState),
  });
  if (this.similarPostWasClicked && this.similarPostWasClicked.similarPostId !== this.state.feedbackPreview?.['id']) {
    this.similarPostWasClicked = undefined;
  }
  context.sections.push({
    name: 'main',
    size: { breakWidth: 350, flexGrow: 20, maxWidth: 1024 },
    content: layoutState => (
      <div className={this.props.classes.listWithSearchContainer}>
        <DashboardSearchControls
          placeholder='Search for changelog entries'
          key={'changelog-entries-search-bar' + activeProject.server.getProjectId()}
          searchText={changelogPostSearch.searchText || ''}
          onSearchChanged={searchText => this.setState({
            changelogPostSearch: {
              ...this.state.changelogPostSearch,
              searchText,
            }
          })}
          filters={layoutState.isShown('filters') === 'show' ? null : changelogFilters(layoutState)}
        />
        <Divider />
        <div className={this.props.classes.listContainer}>
          <Provider key={activeProject.projectId} store={activeProject.server.getStore()}>
            <PostList
              key={activeProject.server.getProjectId()}
              server={activeProject.server}
              search={changelogPostSearch}
              onClickPost={postId => this.pageClicked('post', [postId])}
              onUserClick={userId => this.pageClicked('user', [userId])}
              selectable='highlight'
              selected={this.state.changelogPreview?.type === 'post' ? this.state.changelogPreview.id : undefined}
              displayOverride={{
                showCategoryName: false,
              }}
              PanelPostProps={{
                showDrafts: {
                  onClickDraft: draftId => this.setState({
                    previewShowOnPage: 'changelog',
                    changelogPreview: { type: 'create-post', draftId },
                  }),
                  selectedDraftId: this.state.changelogPreview?.type === 'create-post' ? this.state.changelogPreview.draftId : undefined,
                },
              }}
            />
          </Provider>
        </div>
      </div>
    ),
  });

  const conf = activeProject.server.getStore().getState().conf.conf;
  const projectLink = !!conf && getProjectLink(conf);
  const changelogLink = (!this.state.changelog || !projectLink) ? undefined : `${projectLink}/${this.state.changelog.pageAndIndex?.page.slug}`;
  const preview = this.renderPreview({
    project: activeProject,
    stateKey: 'changelogPreview',
    renderEmpty: 'No entry selected',
    createCategoryIds: this.state.changelog ? [this.state.changelog.categoryAndIndex.category.categoryId] : undefined,
    createAllowDrafts: true,
    extra: {
      size: PostPreviewSize,
      header: {
        title: { title: 'Changelog' },
        action: {
          label: 'Create',
          onClick: () => this.pageClicked('post'),
          tourAnchorProps: {
            anchorId: 'changelog-page-create-btn',
          },
        },
        right: changelogLink && (
          <TourAnchor anchorId='changelog-page-public-view' placement='bottom'>
            {(next, isActive, anchorRef) => (
              <Button
                ref={anchorRef}
                className={this.props.classes.headerAction}
                component={'a' as any}
                onClick={() => {
                  next();
                  tourSetGuideState('visit-project', TourDefinitionGuideState.Completed);
                }}
                href={changelogLink}
                target='_blank'
                underline='none'
                rel='noopener nofollow'
              >
                Public view
                &nbsp;
                <VisibilityIcon fontSize='inherit' />
              </Button>
            )}
          </TourAnchor>
        ),
      },
    },
  });
  preview && context.sections.push(preview);

  context.showProjectLink = true;
}
