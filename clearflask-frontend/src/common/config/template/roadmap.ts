// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import * as Admin from "../../../api/admin";
import { T } from "../../../i18n";
import stringToSlug from "../../util/slugger";
import randomUuid from "../../util/uuid";
import * as ConfigEditor from "../configEditor";
import Templater from "../configTemplater";
import { FeedbackInstance } from "./feedback";
import { CategoryAndIndex } from "./templateUtils";

const RoadmapCategoryIdPrefix = 'roadmap-';
const RoadmapPageIdPrefix = 'roadmap-';
const RoadmapStatusBacklogPrefix = 'backlog-';
const RoadmapStatusClosedPrefix = 'closed-';
const RoadmapStatusCompletedPrefix = 'completed-';

export type PageWithBoard = Admin.Page & Required<Pick<Admin.Page, 'board'>>;
export interface RoadmapInstance {
  categoryAndIndex: CategoryAndIndex;
  pageAndIndex?: {
    page: PageWithBoard;
    index: number;
  },
  statusIdBacklog?: string;
  statusIdClosed?: string;
  statusIdCompleted?: string;
}

export async function roadmapGet(this: Templater): Promise<RoadmapInstance | undefined> {
  const categoryAndIndex = await this._findCategoryByPrefix(RoadmapCategoryIdPrefix, 'Roadmap Task');
  if (!categoryAndIndex) return undefined;

  const pageAndIndex = await this._findPageByPrefix(RoadmapPageIdPrefix, 'Roadmap', page => !!page.board);

  const roadmap: RoadmapInstance = {
    categoryAndIndex,
    pageAndIndex: pageAndIndex as (RoadmapInstance['pageAndIndex'] | undefined),
    statusIdBacklog: categoryAndIndex.category.workflow.statuses
      .find(s => s.statusId.startsWith(RoadmapStatusBacklogPrefix))?.statusId,
    statusIdClosed: categoryAndIndex.category.workflow.statuses
      .find(s => s.statusId.startsWith(RoadmapStatusClosedPrefix))?.statusId,
    statusIdCompleted: categoryAndIndex.category.workflow.statuses
      .find(s => s.statusId.startsWith(RoadmapStatusCompletedPrefix))?.statusId,
  };

  return roadmap;
}
export async function roadmapOn(this: Templater): Promise<RoadmapInstance> {
  var roadmap = await this.roadmapGet();

  // Create Category
  if (!roadmap) {
    const categoriesProp = this._get<ConfigEditor.PageGroup>(['content', 'categories']);
    const categoryId = RoadmapCategoryIdPrefix + randomUuid();

    const statusIdBacklog = RoadmapStatusBacklogPrefix + randomUuid();
    const statusIdLater = randomUuid();
    const statusIdNext = randomUuid();
    const statusIdNow = randomUuid();
    const statusIdCompleted = RoadmapStatusCompletedPrefix + randomUuid();
    const statusIdCancelled = RoadmapStatusClosedPrefix + randomUuid();
    const workflow = Admin.WorkflowToJSON({
      entryStatus: statusIdBacklog,
      statuses: [
        // Alternative names: Gathering Feedback, Maturing, Listening, Ideation, Growing, Finalizing, Seeking
        { name: T<'app'>('ideas'), nextStatusIds: [statusIdLater, statusIdCancelled], color: this.workflowColorNew, statusId: statusIdBacklog, disableFunding: false, disableExpressions: false, disableVoting: false, disableComments: false, disableIdeaEdits: false },
        { name: T<'app'>('later'), nextStatusIds: [statusIdNext, statusIdCancelled], color: this.workflowColorNeutralest, statusId: statusIdLater, disableFunding: false, disableExpressions: false, disableVoting: false, disableComments: false, disableIdeaEdits: false },
        { name: T<'app'>('next'), nextStatusIds: [statusIdNow, statusIdCancelled], color: this.workflowColorNeutraler, statusId: statusIdNext, disableFunding: false, disableExpressions: false, disableVoting: false, disableComments: false, disableIdeaEdits: false },
        { name: T<'app'>('now'), nextStatusIds: [statusIdCancelled, statusIdCompleted], color: this.workflowColorNeutral, statusId: statusIdNow, disableFunding: false, disableExpressions: false, disableVoting: false, disableComments: false, disableIdeaEdits: false },
        { name: T<'app'>('completed'), nextStatusIds: [], color: this.workflowColorComplete, statusId: statusIdCompleted, disableFunding: false, disableExpressions: false, disableVoting: false, disableComments: false, disableIdeaEdits: false },
        { name: T<'app'>('cancelled'), nextStatusIds: [], color: this.workflowColorFail, statusId: statusIdCancelled, disableFunding: false, disableExpressions: false, disableVoting: false, disableComments: false, disableIdeaEdits: false },
      ],
    });

    categoriesProp.insert().setRaw(Admin.CategoryToJSON({
      categoryId, name: T<'app'>('task'),
      userCreatable: false,
      workflow,
      support: {
        vote: {
          enableDownvotes: false,
          iWantThis: {},
        },
        comment: true,
        fund: false,
      },
      tagging: { tags: [], tagGroups: [] },
    }));

    roadmap = (await this.roadmapGet())!;
    this.feedbackUpdateWithRoadmap(roadmap);
  } else {
    // Category exists - check if built-in statuses are missing and recreate them
    const categoryIndex = roadmap.categoryAndIndex.index;
    const workflowProp = this._get<ConfigEditor.ArrayProperty>(['content', 'categories', categoryIndex, 'workflow', 'statuses']);
    const statuses = roadmap.categoryAndIndex.category.workflow.statuses;

    // Check and recreate missing built-in statuses
    const statusesToAdd: Admin.IdeaStatus[] = [];

    if (!roadmap.statusIdBacklog) {
      const statusIdBacklog = RoadmapStatusBacklogPrefix + randomUuid();
      statusesToAdd.push({
        name: T<'app'>('ideas'),
        nextStatusIds: [], // Will be updated after all statuses are added
        color: this.workflowColorNew,
        statusId: statusIdBacklog,
        disableFunding: false,
        disableExpressions: false,
        disableVoting: false,
        disableComments: false,
        disableIdeaEdits: false
      });
    }

    if (!roadmap.statusIdCompleted) {
      const statusIdCompleted = RoadmapStatusCompletedPrefix + randomUuid();
      statusesToAdd.push({
        name: T<'app'>('completed'),
        nextStatusIds: [],
        color: this.workflowColorComplete,
        statusId: statusIdCompleted,
        disableFunding: false,
        disableExpressions: false,
        disableVoting: false,
        disableComments: false,
        disableIdeaEdits: false
      });
    }

    if (!roadmap.statusIdClosed) {
      const statusIdClosed = RoadmapStatusClosedPrefix + randomUuid();
      statusesToAdd.push({
        name: T<'app'>('cancelled'),
        nextStatusIds: [],
        color: this.workflowColorFail,
        statusId: statusIdClosed,
        disableFunding: false,
        disableExpressions: false,
        disableVoting: false,
        disableComments: false,
        disableIdeaEdits: false
      });
    }

    // Add missing statuses
    if (statusesToAdd.length > 0) {
      for (const status of statusesToAdd) {
        workflowProp.insert().setRaw(Admin.IdeaStatusToJSON(status));
      }

      // Update entryStatus if missing
      if (!roadmap.categoryAndIndex.category.workflow.entryStatus) {
        const backlogStatus = roadmap.categoryAndIndex.category.workflow.statuses
          .find(s => s.statusId.startsWith(RoadmapStatusBacklogPrefix));
        if (backlogStatus) {
          this._get<ConfigEditor.StringProperty>(['content', 'categories', categoryIndex, 'workflow', 'entryStatus'])
            .set(backlogStatus.statusId);
        }
      }

      roadmap = (await this.roadmapGet())!;
    }
  }

  // Create page
  if (!roadmap.pageAndIndex) {
    const page: PageWithBoard = {
      pageId: RoadmapPageIdPrefix + randomUuid(),
      name: T<'app'>('roadmap'),
      slug: stringToSlug('roadmap'),
      icon: 'Roadmap',
      panels: [],
      board: Admin.PageBoardToJSON({
        title: T<'app'>('heres-our-plan'),
        panels: roadmap.categoryAndIndex.category.workflow.statuses
          .filter(s => !s.statusId.startsWith(RoadmapStatusClosedPrefix)
            && !s.statusId.startsWith(RoadmapStatusCompletedPrefix)
            && !s.statusId.startsWith(RoadmapStatusBacklogPrefix))
          .reverse()
          .map(status => Admin.PagePanelWithHideIfEmptyToJSON({
            title: status.name,
            color: status.color,
            hideIfEmpty: false,
            display: {
              titleTruncateLines: 2,
              descriptionTruncateLines: 4,
              responseTruncateLines: 0,
              showCommentCount: false,
              showCategoryName: false,
              showCreated: false,
              showAuthor: false,
              showStatus: false,
              showTags: false,
              showVoting: true,
              showVotingCount: false,
              showFunding: false,
              showExpression: false,
            },
            search: Admin.IdeaSearchToJSON({
              sortBy: Admin.IdeaSearchSortByEnum.DragAndDrop,
              filterCategoryIds: [roadmap!.categoryAndIndex.category.categoryId],
              filterStatusIds: [status.statusId],
            })
          })),
      }),
    };
    const pagesProp = this._get<ConfigEditor.PageGroup>(['layout', 'pages']);
    pagesProp.insert().setRaw(page);

    roadmap = (await this.roadmapGet())!;
  }

  // Add page to menu
  const isInMenu = this.editor.getConfig().layout.menu.some(menu => menu.pageIds.some(pageId => pageId === roadmap?.pageAndIndex?.page.pageId));
  if (!isInMenu) {
    const menuProp = this._get<ConfigEditor.ArrayProperty>(['layout', 'menu']);
    (menuProp.insert() as ConfigEditor.ObjectProperty).setRaw(Admin.MenuToJSON({
      menuId: randomUuid(),
      pageIds: [roadmap.pageAndIndex!.page.pageId],
    }));
  }

  // Add to landing page
  const landing = await this.landingGet();
  const isInLanding = landing?.pageAndIndex.page.landing.links.some(link => link.linkToPageId === roadmap?.pageAndIndex?.page.pageId);
  if (!!landing && !isInLanding) {
    this.landingOn(new Set([roadmap.pageAndIndex!.page.pageId]));
  }

  return roadmap;
}

export async function roadmapPageOff(this: Templater, roadmap?: RoadmapInstance): Promise<void> {
  if (!roadmap) roadmap = await this.roadmapGet();
  if (!roadmap) return;
  if (roadmap.pageAndIndex) {
    this._pageDelete(roadmap.pageAndIndex.page.pageId);
  }
  roadmap = (await this.roadmapGet())!;
  this.feedbackUpdateWithRoadmap(roadmap);
}

export async function feedbackAndRoadmapGet(this: Templater): Promise<{ feedback: FeedbackInstance | undefined, roadmap: RoadmapInstance | undefined }> {
  const feedback = await this.feedbackGet();
  const roadmap = await this.roadmapGet();
  return { feedback, roadmap }
}
