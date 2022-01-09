// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
import { Button, Divider } from '@material-ui/core';
import CreateIcon from '@material-ui/icons/Create';
import VisibilityIcon from '@material-ui/icons/Visibility';
import classNames from 'classnames';
import React from 'react';
import { Provider } from 'react-redux';
import * as Admin from '../../api/admin';
import { tourSetGuideState } from '../../common/ClearFlaskTourProvider';
import { Orientation } from '../../common/ContentScroll';
import { LayoutState, Section } from '../../common/Layout';
import { TourAnchor, TourDefinitionGuideState } from '../../common/tour';
import setTitle from "../../common/util/titleUtil";
import { Dashboard, DashboardPageContext, getProjectLink, PostPreviewSize } from "../Dashboard";
import DashboardPostFilterControls from './DashboardPostFilterControls';
import { LinkQuickActionPostList } from './DashboardQuickActions';
import DashboardSearchControls from './DashboardSearchControls';
import PostList from './PostList';

export async function renderChangelog(this: Dashboard, context: DashboardPageContext) {
  setTitle('announcements - Dashboard');
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
  const sectionFilters: Section = {
    name: 'filters',
    breakAction: 'menu',
    size: { breakWidth: 200, flexGrow: 100, width: 'max-content', maxWidth: 'max-content', scroll: Orientation.Vertical },
    collapseRight: true,
    content: layoutState => layoutState.isShown('filters') !== 'show' ? null : changelogFilters(layoutState),
  };
  if (this.similarPostWasClicked && this.similarPostWasClicked.similarPostId !== this.state.feedbackPreview?.['id']) {
    this.similarPostWasClicked = undefined;
  }
  const sectionMain: Section = {
    name: 'main',
    size: { breakWidth: 350, flexGrow: 20, maxWidth: 1024 },
    content: layoutState => (
      <div className={this.props.classes.listWithSearchContainer}>
        <DashboardSearchControls
          placeholder='Search for announcements'
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
  };

  const sectionQuickLink: Section | undefined = !this.state.roadmap ? undefined : {
    name: 'quick-link',
    breakAction: 'hide', breakPriority: 10,
    size: { breakWidth: 200, flexGrow: 20, maxWidth: 'max-content', scroll: Orientation.Vertical },
    noPaper: true, collapseRight: true, collapseLeft: true, collapseTopBottom: true,
    content: layoutState => (
      <div className={classNames(layoutState.enableBoxLayout && this.props.classes.feedbackQuickActionsTopMargin)}>
        <div className={this.props.classes.feedbackColumnRelated}>
          <Provider key={activeProject.projectId} store={activeProject.server.getStore()}>
            <LinkQuickActionPostList
              key={activeProject.server.getProjectId()}
              postId={this.state.changelogPreview?.type === 'post' ? this.state.changelogPreview.id : undefined}
              postDraftExternalControlRef={this.changelogPostDraftExternalControlRef}
              server={activeProject.server}
              title={{
                name: 'Link task',
                helpDescription: 'Reference a completed task in your announcement by linking to it.',
              }}
              PostListProps={{
                search: {
                  filterCategoryIds: this.state.roadmap ? [this.state.roadmap.categoryAndIndex.category.categoryId] : undefined,
                  filterStatusIds: this.state.roadmap?.statusIdCompleted ? [this.state.roadmap.statusIdCompleted] : undefined,
                  limit: 6,
                },
              }}
            />
          </Provider>
        </div>
      </div>
    ),
  };


  const conf = activeProject.server.getStore().getState().conf.conf;
  const projectLink = !!conf && getProjectLink(conf);
  const changelogLink = (!this.state.changelog || !projectLink) ? undefined : `${projectLink}/${this.state.changelog.pageAndIndex?.page.slug}`;
  const sectionPreview = this.renderPreview({
    project: activeProject,
    stateKey: 'changelogPreview',
    renderEmpty: 'No entry selected',
    createCategoryIds: this.state.changelog ? [this.state.changelog.categoryAndIndex.category.categoryId] : undefined,
    createAllowDrafts: true,
    postDraftExternalControlRef: this.changelogPostDraftExternalControlRef,
    extra: {
      size: PostPreviewSize,
      header: {
        title: { title: 'Announcements' },
        action: {
          label: this.props.t('create'),
          icon: CreateIcon,
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
                {this.props.t('public-view')}
                &nbsp;
                <VisibilityIcon fontSize='inherit' />
              </Button>
            )}
          </TourAnchor>
        ),
      },
    },
  });


  context.sections.push(sectionFilters);
  context.sections.push(sectionMain);
  sectionPreview && context.sections.push(sectionPreview);
  sectionQuickLink && context.sections.push(sectionQuickLink);

  context.showProjectLink = true;
}
