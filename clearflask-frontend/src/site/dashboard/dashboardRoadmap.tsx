// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
import { Button } from '@material-ui/core';
import AddIcon from '@material-ui/icons/Add';
import CreateIcon from '@material-ui/icons/Create';
import VisibilityIcon from '@material-ui/icons/Visibility';
import React from 'react';
import { Provider } from 'react-redux';
import * as Admin from '../../api/admin';
import { getSearchKey } from '../../api/server';
import { PanelTitle } from '../../app/comps/Panel';
import { MaxContentWidth, MinContentWidth } from '../../app/comps/Post';
import { tourSetGuideState } from '../../common/ClearFlaskTourProvider';
import { Orientation } from '../../common/ContentScroll';
import HoverArea from '../../common/HoverArea';
import { Section } from '../../common/Layout';
import { TourAnchor, TourDefinitionGuideState } from '../../common/tour';
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
    var tourAnchor;
    if (status.statusId === this.state.roadmap.statusIdBacklog) {
      tourAnchor = {
        props: { anchorId: 'roadmap-page-section-backlog', placement: 'right-start' },
        location: 'section',
      };
    } else if (status.statusId === this.state.roadmap.statusIdCompleted) {
      tourAnchor = {
        props: { anchorId: 'roadmap-page-section-completed', placement: 'left-start' },
        location: 'section',
      };
    }
    return renderTaskSection({
      hideIfEmpty: false,
      title: status.name,
      display: {},
      search: {
        filterCategoryIds: [this.state.roadmap.categoryAndIndex.category.categoryId],
        filterStatusIds: [status.statusId],
      },
    }, breakStackWithName, tourAnchor);
  }
  const renderTaskSection = (
    panel: Admin.PagePanelWithHideIfEmpty | undefined,
    breakStackWithName?: string,
    tourAnchor?: {
      props: React.ComponentProps<typeof TourAnchor>,
      location: 'section' | 'add',
    }
  ): Section | undefined => {
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
          dragSelectedTourAnchorProps={{
            anchorId: 'roadmap-page-selected-drag-me',
            disablePortal: true,
          }}
          {...PostListProps}
        />
      );
    }
    list = (
      <Provider key={activeProject.projectId} store={activeProject.server.getStore()}>
        {list}
      </Provider>
    );

    return {
      name: getSearchKey(panel.search),
      size: { breakWidth: MinContentWidth, flexGrow: 1, maxWidth: MaxContentWidth, scroll: Orientation.Vertical },
      content: (
        <HoverArea disableHoverBelow='sm'>
          {(hoverAreaProps, isHovering, isHoverDisabled) => {
            var content = (
              <>
                <PanelTitle
                  className={this.props.classes.roadmapSectionTitle}
                  text={panel.title || onlyStatus?.name} color={onlyStatus?.color}
                  iconAction={!onlyStatus ? undefined : {
                    icon: (<AddIcon />),
                    onClick: () => {
                      this.setState({
                        previewShowOnPage: 'roadmap',
                        roadmapPreview: { type: 'create-post', defaultStatusId: onlyStatus.statusId },
                      });
                    },
                    transparent: !isHovering && !isHoverDisabled,
                    tourAnchorProps: tourAnchor?.location === 'add' ? tourAnchor.props : undefined
                  }}
                />
                <div className={this.props.classes.roadmapTaskList}>
                  {list}
                </div>
              </>
            );

            content = tourAnchor?.location === 'section' ? (
              <TourAnchor {...tourAnchor.props} className={this.props.classes.roadmapTaskSection} DivProps={hoverAreaProps}>
                {content}
              </TourAnchor>
            ) : (
              <div className={this.props.classes.roadmapTaskSection} {...hoverAreaProps}>
                {content}
              </div>
            );

            return content;
          }}
        </HoverArea>
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

    // Roadmap may be displayed in reverse order of completion, ie "Now, Next, Later",
    // But the dashboard goes left to right from ideas to completed.
    // So let's sort the roadmap panels based on the Workflow here
    const panels = [...this.state.roadmap.pageAndIndex.page.board.panels];
    if (this.state.roadmap.categoryAndIndex.category.workflow.entryStatus) {
      const statusWeight: { [statusId: string]: number } = {};
      const workflowSeenStatusIds: Set<string> = new Set([this.state.roadmap.categoryAndIndex.category.workflow.entryStatus]);
      const bfsQ = [this.state.roadmap.categoryAndIndex.category.workflow.entryStatus];
      var currWeight = 0;
      while (!!bfsQ.length) {
        const nextStatusId = bfsQ.shift();
        if (!nextStatusId) break;
        currWeight++;
        statusWeight[nextStatusId] = currWeight;
        this.state.roadmap.categoryAndIndex.category.workflow.statuses.find(s => s.statusId === nextStatusId)
          ?.nextStatusIds
          ?.forEach(childStatusId => {
            if (!workflowSeenStatusIds.has(childStatusId)) {
              workflowSeenStatusIds.add(childStatusId);
              bfsQ.push(childStatusId);
            }
          });
      }
      panels.sort((l, r) => (l.search.filterStatusIds?.reduce((prev, curr) => Math.max(prev, statusWeight[curr] || 0), 0) || 0)
        - (r.search.filterStatusIds?.reduce((prev, curr) => Math.max(prev, statusWeight[curr] || 0), 0) || 0));
    }

    const roadmapSections = panels
      .map((panel, index) => renderTaskSection(panel, undefined, index === 0 ? {
        props: { anchorId: 'roadmap-page-section-roadmap-create-btn', placement: 'bottom' },
        location: 'add',
      } : undefined))
      .filter(notEmpty);
    if (!roadmapSections.length) return undefined;

    const conf = activeProject.server.getStore().getState().conf.conf;
    const projectLink = !!conf && getProjectLink(conf);
    const roadmapLink = !projectLink ? undefined : `${projectLink}/${this.state.roadmap.pageAndIndex?.page.slug}`;

    return {
      name: 'roadmap',
      header: {
        title: {
          title: this.props.t('roadmap'),
          help: 'View your public roadmap. Drag and drop tasks between columns to prioritize your roadmap.'
            + (this.state.changelog?.pageAndIndex ? ' Completed tasks can be added to an announcement on the next page.' : '')
        },
        action: {
          label: this.props.t('create'),
          icon: CreateIcon,
          onClick: () => this.pageClicked('post'),
        },
        right: roadmapLink && (
          <TourAnchor anchorId='roadmap-page-public-view' placement='bottom' zIndex={zb => zb.appBar + 1}>
            {(next, isActive, anchorRef) => (
              <Button
                ref={anchorRef}
                className={this.props.classes.headerAction}
                component={'a' as any}
                onClick={() => {
                  next();
                  tourSetGuideState('visit-project', TourDefinitionGuideState.Completed);
                }}
                href={roadmapLink}
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
      size: {
        ...roadmapSections[0],
        breakWidth: roadmapSections.reduce((width, section) => width + (section.size?.breakWidth || 0), 0),
      },
      content: (
        <TourAnchor anchorId='roadmap-page-section-roadmap' placement='left' className={this.props.classes.roadmapContainer}>
          {roadmapSections.map(section => (
            <div className={this.props.classes.roadmapSection}>
              {section.content}
            </div>
          ))}
        </TourAnchor>
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
  const closedSection = renderStatusSection(this.state.roadmap.statusIdClosed);
  const completedSection = renderStatusSection(this.state.roadmap.statusIdCompleted, closedSection?.name);
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
