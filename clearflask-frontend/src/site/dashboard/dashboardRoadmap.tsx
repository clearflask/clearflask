// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
import { Button, Link as MuiLink } from '@material-ui/core';
import VisibilityIcon from '@material-ui/icons/Visibility';
import React from 'react';
import { Provider } from 'react-redux';
import * as Admin from '../../api/admin';
import { getSearchKey } from '../../api/server';
import { PanelTitle } from '../../app/comps/Panel';
import { MaxContentWidth, MinContentWidth } from '../../app/comps/Post';
import { Orientation } from '../../common/ContentScroll';
import { Section } from '../../common/Layout';
import { notEmpty } from '../../common/util/arrayUtil';
import setTitle from "../../common/util/titleUtil";
import { Dashboard, DashboardPageContext, getProjectLink } from "../Dashboard";
import { droppableDataSerialize } from "./dashboardDndActionHandler";
import DragndropPostList from './DragndropPostList';
import PostList from './PostList';

export async function renderRoadmap(this: Dashboard, context: DashboardPageContext) {
  setTitle('Roadmap - Dashboard');
  if (!context.activeProject) {
    context.showCreateProjectWarning = true;
    return;
  }
  const activeProject = context.activeProject;

  if (!this.state.roadmap) {
    context.showWarning = 'Oops, roadmap not enabled';
    return;
  }

  // TODO Changelog; just remember that:
  // - Add an action container for creating new draft entry
  // - Show Draft entries, on drop, add as linked entry
  // - Show published entries, on drop, add as linked entry
  // Caveats:
  // - Drafts must support adding linked post ids in IdeaCreateAdmin
  // - When you drop into the changelog list, the status changes to Completed and will show up
  //   in the Completed dropbox. It's the logical thing, but it looks weird. Figure it out.
  // - Also, the Completed search column must be also updated when dropped into changelog.
  // const renderDropboxForChangelog = (changelog: ChangelogInstance, expandableStateKey?: string) => {
  //  const search = {
  //    filterCategoryIds: [changelog.categoryAndIndex.category.categoryId],
  //  };
  //  return this.renderDropbox('changelog', (
  //    <>
  //      <DragndropPostList
  //        className={this.props.classes.dropboxList}
  //        droppable
  //        droppableId={droppableDataSerialize({
  //          type: 'changelog-panel',
  //          searchKey: getSearchKey(search),
  //        })}
  //        key={statusId}
  //        server={this.props.server}
  //        search={search}
  //        onClickPost={this.props.onClickPost}
  //        onUserClick={this.props.onUserClick}
  //        selectable
  //        selected={this.props.selectedPostId}
  //        displayOverride={{
  //          showCategoryName: false,
  //          showStatus: false,
  //        }}
  //      />
  //    </>
  //  ), 'Changelog', undefined, expandableStateKey);
  // }

  const seenStatusIds = new Set<string>();
  const renderStatusSection = (statusOrId: string | Admin.IdeaStatus | undefined, breakStackWithName?: string): Section | undefined => {
    if (!statusOrId || !this.state.roadmap) return undefined;
    const status: Admin.IdeaStatus | undefined = typeof statusOrId !== 'string' ? statusOrId
      : this.state.roadmap?.categoryAndIndex.category.workflow.statuses.find(s => s.statusId === statusOrId);
    if (!status) return undefined;
    return renderTaskSection({
      hideIfEmpty: false,
      title: status.name,
      display: {},
      search: {
        filterCategoryIds: [this.state.roadmap.categoryAndIndex.category.categoryId],
        filterStatusIds: [status.statusId],
      },
    }, breakStackWithName);
  }
  const renderTaskSection = (panel: Admin.PagePanelWithHideIfEmpty | undefined, breakStackWithName?: string): Section | undefined => {
    if (!panel || !this.state.roadmap) return undefined;
    const isTaskCategory = panel.search.filterCategoryIds?.length === 1 && panel.search.filterCategoryIds[0] === this.state.roadmap.categoryAndIndex.category.categoryId;
    const onlyStatus = !isTaskCategory || panel.search.filterStatusIds?.length !== 1 ? undefined : this.state.roadmap.categoryAndIndex.category.workflow.statuses.find(s => s.statusId === panel.search.filterStatusIds?.[0]);
    if (onlyStatus) seenStatusIds.add(onlyStatus.statusId);

    const PostListProps: React.ComponentProps<typeof PostList> = {
      server: activeProject.server,
      search: panel.search as Admin.IdeaSearchAdmin,
      onClickPost: postId => this.pageClicked('post', [postId]),
      onUserClick: userId => this.pageClicked('user', [userId]),
      selectable: 'highlight',
      selected: (this.state.previewShowOnPage === 'roadmap' && this.state.roadmapPreview?.type === 'post') ? this.state.roadmapPreview.id : undefined,
      displayOverride: {
        showCategoryName: false,
        showStatus: false,
      },
    };
    var list;
    if (!isTaskCategory) {
      list = (
        <PostList
          {...PostListProps}
        />
      );
    } else {
      list = (
        <DragndropPostList
          droppable={!!onlyStatus}
          droppableId={droppableDataSerialize({
            type: 'roadmap-panel',
            searchKey: getSearchKey(panel.search),
            statusId: onlyStatus?.statusId,
          })}
          {...PostListProps}
        />
      );
    }
    return {
      name: getSearchKey(panel.search),
      size: { breakWidth: MinContentWidth, flexGrow: 1, maxWidth: MaxContentWidth, scroll: Orientation.Vertical },
      content: (
        <div className={this.props.classes.roadmapTaskSection}>
          <PanelTitle
            className={this.props.classes.roadmapSectionTitle}
            text={panel.title || onlyStatus?.name} color={onlyStatus?.color}
          />
          <div className={this.props.classes.roadmapTaskList}>
            <Provider key={activeProject.projectId} store={activeProject.server.getStore()}>
              {list}
            </Provider>
          </div>
        </div>
      ),
      ...(breakStackWithName ? {
        breakAction: 'stack',
        stackLevel: -1,
        stackWithSectionName: breakStackWithName,
      } : {
        breakAction: 'show',
      }),
    };
  };
  const renderRoadmapSection = (): Section | undefined => {
    if (!this.state.roadmap?.pageAndIndex) return undefined;
    const roadmapSections = this.state.roadmap.pageAndIndex.page.board.panels
      .map(panel => renderTaskSection(panel))
      .filter(notEmpty);
    if (!roadmapSections.length) return undefined;

    const conf = activeProject.server.getStore().getState().conf.conf;
    const projectLink = !!conf && getProjectLink(conf);
    const roadmapLink = !projectLink ? undefined : `${projectLink}/${this.state.roadmap.pageAndIndex?.page.slug}`;

    return {
      name: 'roadmap',
      header: {
        title: {
          title: 'Roadmap',
          help: 'View your public roadmap. Drag and drop tasks between columns to prioritize your roadmap.'
            + (this.state.changelog?.pageAndIndex ? ' Completed tasks can be added to a Changelog entry on the next page.' : '')
        },
        action: { label: 'Create', onClick: () => this.pageClicked('post') },
        right: roadmapLink && (
          <Button
            className={this.props.classes.headerAction}
            component={MuiLink}
            href={roadmapLink}
            target='_blank'
            underline='none'
            rel='noopener nofollow'
          >
            Public view
            &nbsp;
            <VisibilityIcon fontSize='inherit' />
          </Button>
        ),
      },
      size: {
        ...roadmapSections[0],
        breakWidth: roadmapSections.reduce((width, section) => width + (section.size?.breakWidth || 0), 0),
      },
      content: (
        <div className={this.props.classes.roadmapContainer}>
          {roadmapSections.map(section => (
            <div className={this.props.classes.roadmapSection}>
              {section.content}
            </div>
          ))}
        </div>
      ),
    };
  }


  const roadmapSectionPreview = this.renderPreview({
    project: activeProject,
    stateKey: 'roadmapPreview',
    createCategoryIds: [this.state.roadmap.categoryAndIndex.category.categoryId],
    extra: {
      breakAlways: true,
    },
  });

  const roadmapSection = renderRoadmapSection();
  const backlogSection = renderStatusSection(this.state.roadmap.statusIdBacklog);
  const completedSection = renderStatusSection(this.state.roadmap.statusIdCompleted);
  const closedSection = renderStatusSection(this.state.roadmap.statusIdClosed, completedSection?.name);
  const missingStatusSections = this.state.roadmap.categoryAndIndex.category.workflow.statuses
    .filter(status => !seenStatusIds.has(status.statusId))
    .map(status => renderStatusSection(status))
    .filter(notEmpty);


  backlogSection && context.sections.push(backlogSection);
  missingStatusSections.length && missingStatusSections.forEach(section => context.sections.push(section));
  roadmapSection && context.sections.push(roadmapSection);
  completedSection && context.sections.push(completedSection);
  closedSection && context.sections.push(closedSection);
  roadmapSectionPreview && context.sections.push(roadmapSectionPreview);

  context.showProjectLink = true;
}
