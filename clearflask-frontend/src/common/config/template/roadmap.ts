import * as Admin from "../../../api/admin";
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
        { name: 'Ideation', nextStatusIds: [statusIdLater, statusIdNext, statusIdNow, statusIdCancelled], color: this.workflowColorNew, statusId: statusIdBacklog, disableFunding: false, disableExpressions: false, disableVoting: false, disableComments: false, disableIdeaEdits: false },
        { name: 'Later', nextStatusIds: [statusIdNext, statusIdNow, statusIdCancelled], color: this.workflowColorNeutralest, statusId: statusIdLater, disableFunding: false, disableExpressions: false, disableVoting: false, disableComments: false, disableIdeaEdits: false },
        { name: 'Next', nextStatusIds: [statusIdLater, statusIdNow, statusIdCancelled], color: this.workflowColorNeutraler, statusId: statusIdNext, disableFunding: false, disableExpressions: false, disableVoting: false, disableComments: false, disableIdeaEdits: false },
        { name: 'Now', nextStatusIds: [statusIdLater, statusIdNext, statusIdCancelled, statusIdCompleted], color: this.workflowColorNeutral, statusId: statusIdNow, disableFunding: false, disableExpressions: false, disableVoting: false, disableComments: false, disableIdeaEdits: false },
        { name: 'Completed', nextStatusIds: [], color: this.workflowColorComplete, statusId: statusIdCompleted, disableFunding: false, disableExpressions: false, disableVoting: false, disableComments: false, disableIdeaEdits: false },
        { name: 'Cancelled', nextStatusIds: [], color: this.workflowColorFail, statusId: statusIdCancelled, disableFunding: false, disableExpressions: false, disableVoting: false, disableComments: false, disableIdeaEdits: false },
      ],
    });

    categoriesProp.insert().setRaw(Admin.CategoryToJSON({
      categoryId, name: 'Task',
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
  }

  // Create page
  if (!roadmap.pageAndIndex) {
    const page: PageWithBoard = {
      pageId: RoadmapPageIdPrefix + randomUuid(),
      name: 'Roadmap',
      slug: stringToSlug('roadmap'),
      icon: 'Roadmap',
      panels: [],
      board: Admin.PageBoardToJSON({
        title: "Here's our plan",
        panels: roadmap.categoryAndIndex.category.workflow.statuses
          .filter(s => !s.statusId.startsWith(RoadmapStatusClosedPrefix)
            && !s.statusId.startsWith(RoadmapStatusCompletedPrefix)
            && !s.statusId.startsWith(RoadmapStatusBacklogPrefix))
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
              sortBy: Admin.IdeaSearchSortByEnum.New,
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

export async function roadmapPageOff(this: Templater, roadmap: RoadmapInstance): Promise<void> {
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
