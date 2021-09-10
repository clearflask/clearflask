// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
import { Fade, IconButton } from '@material-ui/core';
import CheckIcon from '@material-ui/icons/Check';
import PrevIcon from '@material-ui/icons/NavigateBefore';
import NextIcon from '@material-ui/icons/NavigateNext';
import classNames from 'classnames';
import React from 'react';
import { Provider } from 'react-redux';
import * as Admin from '../../api/admin';
import { getSearchKey } from '../../api/server';
import ServerAdmin from '../../api/serverAdmin';
import { Orientation } from '../../common/ContentScroll';
import { LayoutState, Section } from '../../common/Layout';
import { TourAnchor } from '../../common/tour';
import setTitle from "../../common/util/titleUtil";
import { Dashboard, DashboardPageContext, PostPreviewSize } from "../Dashboard";
import { dashboardOnDragEnd, droppableDataSerialize } from "./dashboardDndActionHandler";
import DashboardPostFilterControls from './DashboardPostFilterControls';
import DashboardQuickActions, { FallbackClickHandler, QuickActionPostList } from './DashboardQuickActions';
import DashboardSearchControls from './DashboardSearchControls';
import DragndropPostList from './DragndropPostList';

const helperMerge = 'Merge duplicate feedback into one. Combined content, comments, votes and subscribers.';
const helperLink = 'Link with a related task and mark feedback as accepted. Subscribers will be notified.';
export async function renderFeedback(this: Dashboard, context: DashboardPageContext) {
  setTitle('Feedback - Dashboard');
  if (!context.activeProject) {
    context.showCreateProjectWarning = true;
    return;
  }
  const activeProject = context.activeProject;

  const selectedPostId = this.state.feedbackPreview?.type === 'post' ? this.state.feedbackPreview.id : undefined;

  context.onDndPreHandling = async (to, post) => {
    if (post.ideaId === selectedPostId) {
      // Open next posts
      const success = await this.feedbackListRef.current?.next();

      // If not next post, at least close the current one 
      if (!success) this.setState({ feedbackPreview: undefined });
    }
  };

  context.onDndHandled = async (to, post, createdId) => {
    // Show snackbar for certain actions
    if (to.type === 'quick-action-create-task-from-feedback-with-status' && createdId) {
      this.setState({
        feedbackPreviewRight: { type: 'post', id: createdId, headerTitle: 'Created task', headerIcon: CheckIcon },
        previewShowOnPage: 'feedback',
      });
    } else if (to.type === 'quick-action-feedback-merge-duplicate') {
      this.showSnackbar({
        key: to.type + post.ideaId,
        message: 'Merged with duplicate',
        actions: [{
          title: 'Open feedback',
          onClick: close => {
            close();
            this.setState({
              feedbackPreviewRight: { type: 'post', id: to.postId, headerTitle: 'Merged feedback', headerIcon: CheckIcon },
              previewShowOnPage: 'feedback',
            });
          },
        }]
      });
    } else if (to.type === 'quick-action-feedback-link-with-task-and-accept') {
      this.showSnackbar({
        key: to.type + post.ideaId,
        message: 'Linked with task',
        actions: [{
          title: 'Open task',
          onClick: close => {
            close();
            this.setState({
              feedbackPreviewRight: { type: 'post', id: to.postId, headerTitle: 'Linked task', headerIcon: CheckIcon },
              previewShowOnPage: 'feedback',
            });
          },
        }]
      });
    }
  };

  const feedbackPostSearch = this.state.feedbackPostSearch || {
    sortBy: Admin.IdeaSearchAdminSortByEnum.New,
    ...(this.state.feedback?.categoryAndIndex.category.workflow.entryStatus ? {
      filterStatusIds: [this.state.feedback.categoryAndIndex.category.workflow.entryStatus],
    } : {}),
  };
  if (this.state.feedback) feedbackPostSearch.filterCategoryIds = [this.state.feedback.categoryAndIndex.category.categoryId];
  if (this.similarPostWasClicked && this.similarPostWasClicked.similarPostId !== this.state.feedbackPreview?.['id']) {
    this.similarPostWasClicked = undefined;
  }
  const feedbackPostListDroppableId = droppableDataSerialize({
    type: 'feedback-search',
    searchKey: getSearchKey(feedbackPostSearch),
  });
  const fallbackClickHandler: FallbackClickHandler = async (draggableId, dstDroppableId) => {
    if (!activeProject
      || this.state.feedbackPreview?.type !== 'post') return false;
    return await dashboardOnDragEnd(
      activeProject,
      feedbackPostListDroppableId,
      0,
      draggableId,
      dstDroppableId,
      0,
      this.state.feedback || undefined,
      this.state.roadmap || undefined,
      context.onDndHandled);
  };
  const renderRelatedContent = (type: 'feedback' | 'task', isTourActive?: boolean): React.ReactNode | null => {
    if (this.state.feedbackPreview?.type !== 'post') return null;
    const categoryId = type === 'feedback' ? this.state.feedback?.categoryAndIndex.category.categoryId : this.state.roadmap?.categoryAndIndex.category.categoryId;
    if (!categoryId) return null;
    return (
      <div className={this.props.classes.feedbackColumnRelated}>
        <Provider key={activeProject.projectId} store={activeProject.server.getStore()}>
          <QuickActionPostList
            key={activeProject.server.getProjectId()}
            server={activeProject.server}
            title={type === 'feedback' ? {
              name: 'Merge feedback',
              helpDescription: helperMerge,
            } : {
              name: 'Link to task',
              helpDescription: helperLink,
            }}
            getDroppableId={post => {
              if (post.categoryId === this.state.feedback?.categoryAndIndex.category.categoryId) {
                return droppableDataSerialize({
                  type: 'quick-action-feedback-merge-duplicate',
                  dropbox: true,
                  postId: post.ideaId,
                });
              } else if (post.categoryId === this.state.roadmap?.categoryAndIndex.category.categoryId) {
                return droppableDataSerialize({
                  type: 'quick-action-feedback-link-with-task-and-accept',
                  dropbox: true,
                  postId: post.ideaId,
                });
              }
              return undefined;
            }}
            selectedPostId={selectedPostId}
            draggingPostIdSubscription={this.draggingPostIdSubscription}
            dragDropSensorApi={this.state.dragDropSensorApi}
            fallbackClickHandler={fallbackClickHandler}
            statusColorGivenCategories={[categoryId]}
            PostListProps={{
              search: {
                sortBy: Admin.IdeaSearchAdminSortByEnum.New,
                filterCategoryIds: [categoryId],
                limit: 3,
                similarToIdeaId: this.state.feedbackPreview.id,
              },
            }}
            showSampleItem={!isTourActive ? undefined : `Sample related ${type}`}
            disabledDuringTour={!!isTourActive}
            FirstTimeNoticeProps={type === 'feedback' ? {
              id: 'feedback-merge',
              title: 'Merge feedback',
              description: helperMerge,
              confirmButtonTitle: 'Merge',
            } : {
              id: 'feedback-link-task',
              title: 'Link to task',
              description: helperLink,
              confirmButtonTitle: 'Link',
            }}
          />
        </Provider>
      </div>
    );
  };
  const sectionRelated: Section = {
    name: `related`,
    breakAction: 'hide', breakPriority: 30,
    size: { breakWidth: 200, flexGrow: 0, maxWidth: 'max-content', scroll: Orientation.Vertical },
    noPaper: true, collapseRight: true, collapseLeft: true, collapseTopBottom: true,
    content: layoutState => (
      <div className={classNames(layoutState.enableBoxLayout && this.props.classes.feedbackQuickActionsTopMargin)}>
        <Provider store={ServerAdmin.get().getStore()}>
          <TourAnchor anchorId='feedback-page-link-or-merge' placement='left'>
            {(next, isActive, anchorRef) => (
              <span ref={anchorRef}>
                {renderRelatedContent('task', isActive)}
                {renderRelatedContent('feedback', isActive)}
              </span>
            )}
          </TourAnchor>
        </Provider>
      </div>
    ),
  };

  const sectionPreview = this.renderPreview({
    project: activeProject,
    stateKey: 'feedbackPreview',
    renderEmpty: 'No feedback selected',
    createCategoryIds: this.state.feedback ? [this.state.feedback.categoryAndIndex.category.categoryId] : undefined,
    extra: {
      size: PostPreviewSize,
      collapseBottom: true,
      breakAction: 'show',
      header: {
        title: { title: 'Feedback', help: 'Explore feedback left by your users. Decide how to respond to each new feedback by dragging and dropping it into one of the buckets.' },
        middle: (
          <Fade in={this.state.feedbackPreview?.type === 'post'}>
            <div>
              <IconButton
                className={this.props.classes.feedbackNavigatorIcon}
                disabled={!this.feedbackListRef.current?.hasPrevious()}
                onClick={() => this.feedbackListRef.current?.previous()}
              >
                <PrevIcon fontSize='inherit' />
              </IconButton>
              <IconButton
                className={this.props.classes.feedbackNavigatorIcon}
                disabled={!this.feedbackListRef.current?.hasNext()}
                onClick={() => this.feedbackListRef.current?.next()}
              >
                <NextIcon fontSize='inherit' />
              </IconButton>
            </div>
          </Fade>
        ),
        action: {
          label: 'Create',
          onClick: () => this.pageClicked('post'),
          tourAnchorProps: {
            anchorId: 'feedback-page-create-btn',
          },
        },
      },
    },
  });


  const sectionPreviewRight = this.renderPreview({
    project: activeProject,
    stateKey: 'feedbackPreviewRight',
    createCategoryIds: [
      ...(this.state.feedback ? [this.state.feedback.categoryAndIndex.category.categoryId] : []),
      ...(this.state.roadmap ? [this.state.roadmap.categoryAndIndex.category.categoryId] : []),
    ],
    extra: previewState => ({
      name: 'preview2',
      breakAlways: true,
      breakAction: 'drawer',
      ...(previewState?.type === 'create-post' ? {
        header: { title: { title: 'New task' } },
      } : {}),
      size: PostPreviewSize,
    }),
  });

  const feedbackFilters = (layoutState: LayoutState) => (
    <Provider key={activeProject.projectId} store={activeProject.server.getStore()}>
      <DashboardPostFilterControls
        key={activeProject.server.getProjectId()}
        server={activeProject.server}
        search={feedbackPostSearch}
        allowSearch={{ enableSearchByCategory: false }}
        permanentSearch={{ filterCategoryIds: this.state.feedback ? [this.state.feedback.categoryAndIndex.category.categoryId] : undefined }}
        onSearchChanged={feedbackPostSearch => this.setState({ feedbackPostSearch })}
        horizontal={layoutState.isShown('filters') !== 'show'}
      />
    </Provider>
  );

  const sectionFilters: Section = {
    name: 'filters',
    breakAction: 'hide',
    breakPriority: 50,
    collapseLeft: true, collapseTopBottom: true,
    size: { breakWidth: 200, flexGrow: 100, width: 'max-content', maxWidth: 'max-content', scroll: Orientation.Vertical },
    content: layoutState => layoutState.isShown('filters') !== 'show' ? null : feedbackFilters(layoutState),
  };

  const sectionList: Section = {
    name: 'list',
    breakAction: 'menu', breakPriority: 40,
    size: { breakWidth: 300, flexGrow: 20, maxWidth: 1024, scroll: Orientation.Vertical },
    collapseLeft: true, collapseTopBottom: true,
    barTop: layoutState => (
      <DashboardSearchControls
        placeholder='Search for feedback'
        key={'feedback-search-bar' + activeProject.server.getProjectId()}
        searchText={feedbackPostSearch.searchText || ''}
        onSearchChanged={searchText => this.setState({
          feedbackPostSearch: {
            ...this.state.feedbackPostSearch,
            searchText,
          }
        })}
        filters={layoutState.isShown('filters') === 'show' ? null : feedbackFilters(layoutState)}
      />
    ),
    content: (
      <Provider key={activeProject.projectId} store={activeProject.server.getStore()}>
        <DragndropPostList
          scroll
          key={activeProject.server.getProjectId()}
          droppableId={feedbackPostListDroppableId}
          server={activeProject.server}
          search={feedbackPostSearch}
          onClickPost={postId => this.pageClicked('post', [postId])}
          onUserClick={userId => this.pageClicked('user', [userId])}
          selectable='highlight'
          selected={selectedPostId}
          PanelPostProps={{
            navigatorRef: this.feedbackListRef,
            navigatorChanged: () => this.forceUpdate(),
          }}
        />
      </Provider>
    ),
  };

  const sectionQuickActions: Section = {
    name: 'quick-actions',
    breakAction: 'hide', breakPriority: 10,
    size: { breakWidth: 200, flexGrow: 20, maxWidth: 'max-content', scroll: Orientation.Vertical },
    noPaper: true, collapseRight: true, collapseLeft: true, collapseTopBottom: true,
    content: layoutState => (
      <div className={classNames(layoutState.enableBoxLayout && this.props.classes.feedbackQuickActionsTopMargin)}>
        <Provider key={activeProject.projectId} store={activeProject.server.getStore()}>
          <DashboardQuickActions
            activeProject={activeProject}
            onClickPost={postId => this.pageClicked('post', [postId])}
            onUserClick={userId => this.pageClicked('user', [userId])}
            searchKey={getSearchKey(feedbackPostSearch)}
            selectedPostId={selectedPostId}
            draggingPostIdSubscription={this.draggingPostIdSubscription}
            feedback={this.state.feedback}
            roadmap={this.state.roadmap}
            dragDropSensorApi={this.state.dragDropSensorApi}
            fallbackClickHandler={fallbackClickHandler}
          />
        </Provider>
      </div>
    ),
  };

  context.sections.push(sectionFilters);
  context.sections.push(sectionList);
  context.sections.push(sectionQuickActions);
  sectionPreview && context.sections.push(sectionPreview);
  context.sections.push(sectionRelated);
  sectionPreviewRight && context.sections.push(sectionPreviewRight);

  context.showProjectLink = true;
}
