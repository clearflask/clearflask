import * as Admin from "../../../api/admin";
import randomUuid from "../../util/uuid";
import * as ConfigEditor from "../configEditor";
import Templater from "../configTemplater";
import { CategoryAndIndex } from "./feedback";

const RoadmapPageIdPrefix = 'roadmap-';

export type PageWithBoard = Admin.Page & Required<Pick<Admin.Page, 'board'>>;
export interface RoadmapInstance {
  categoryAndIndex: CategoryAndIndex;
  pageAndIndex: {
    page: PageWithBoard;
    index: number;
  },
}

export async function roadmapGet(this: Templater): Promise<RoadmapInstance | undefined> {
  const feedback = (await this.feedbackGet())
  if (!feedback) return undefined;
  const postCategoryId = feedback.categoryAndIndex.category.categoryId;

  var potentialPages: Array<NonNullable<RoadmapInstance['pageAndIndex']>> = this.editor.getConfig().layout.pages
    .flatMap((page, index) => (!!page.board
      && page.pageId.startsWith(RoadmapPageIdPrefix))
      ? [{ page: page as PageWithBoard, index }] : []);

  if (potentialPages.length === 0) {
    potentialPages = this.editor.getConfig().layout.pages
      .flatMap((page, index) => (!!page.board
        && page.board.panels.length > 0
        && page.board.panels.every(p => p.search.filterCategoryIds?.some(cId => cId === postCategoryId)))
        ? [{ page: page as PageWithBoard, index }] : []);
  }

  if (potentialPages.length === 0) {
    potentialPages = this.editor.getConfig().layout.pages
      .flatMap((page, index) => (!!page.board
        && page.board.panels.length === 0)
        ? [{ page: page as PageWithBoard, index }] : []);
  }

  if (potentialPages.length === 0) {
    return undefined;
  } else if (potentialPages.length === 1) {
    const roadmapPage = potentialPages[0]!;
    return {
      categoryAndIndex: feedback.categoryAndIndex,
      pageAndIndex: roadmapPage,
    };
  } else {
    const roadmapPageId = await this._getConfirmation({
      title: 'Which one is a Roadmap?',
      description: 'We are having trouble determining where your Roadmap is located. Please select the page that with your Roadmap to edit it.',
      responses: potentialPages.map(pageWithBoard => ({
        id: pageWithBoard.page.pageId,
        title: pageWithBoard.page.name,
      })),
    }, 'Cancel');
    if (!roadmapPageId) return undefined;
    const roadmapPage = potentialPages.find(p => p.page.pageId === roadmapPageId);
    if (!roadmapPage) return undefined;
    return {
      categoryAndIndex: feedback.categoryAndIndex,
      pageAndIndex: roadmapPage,
    };
  }
}
export async function roadmapOn(this: Templater): Promise<RoadmapInstance> {
  var roadmap = await this.roadmapGet();
  if (!roadmap) {
    const pagesProp = this._get<ConfigEditor.PageGroup>(['layout', 'pages']);
    const menuProp = this._get<ConfigEditor.ArrayProperty>(['layout', 'menu']);

    const feedback = (await this.feedbackGet())
    if (!feedback) throw new Error('Feedback not enabled');
    const postCategoryId = feedback.categoryAndIndex.category.categoryId;

    const feedbackStatuses = feedback.categoryAndIndex.category.workflow.statuses;
    const status1: Admin.IdeaStatus | undefined = feedbackStatuses.find(s => s.name.match(/Planned/i)) || feedbackStatuses[0];
    const status2: Admin.IdeaStatus | undefined = feedbackStatuses.find(s => s.name.match(/In progress/i)) || feedbackStatuses[1];
    const status3: Admin.IdeaStatus | undefined = feedbackStatuses.find(s => s.name.match(/Completed/i)) || feedbackStatuses[2];

    const roadmapPageId = RoadmapPageIdPrefix + randomUuid();
    const postDisplay: Admin.PostDisplay = {
      titleTruncateLines: 1,
      descriptionTruncateLines: 0,
      responseTruncateLines: 0,
      showCommentCount: false,
      showCategoryName: false,
      showCreated: false,
      showAuthor: false,
      showStatus: false,
      showTags: false,
      showVoting: false,
      showFunding: false,
      showExpression: false,
    };
    pagesProp.insert().setRaw(Admin.PageToJSON({
      pageId: roadmapPageId,
      name: 'Roadmap',
      slug: 'roadmap',
      icon: 'Roadmap',
      panels: [],
      board: Admin.PageBoardToJSON({
        title: 'Roadmap',
        panels: [status1, status2, status3].map(status => Admin.PagePanelWithHideIfEmptyToJSON({
          title: status?.name, hideIfEmpty: false, display: Admin.PostDisplayToJSON(postDisplay), search: Admin.IdeaSearchToJSON({
            sortBy: Admin.IdeaSearchSortByEnum.New,
            filterCategoryIds: [postCategoryId],
            filterStatusIds: status ? [status.statusId] : undefined,
          })
        })),
      }),
      explorer: undefined,
    }));
    (menuProp.insert() as ConfigEditor.ObjectProperty).setRaw(Admin.MenuToJSON({
      menuId: randomUuid(), pageIds: [roadmapPageId],
    }));


    const landing = await this.landingGet();
    if (landing) {
      this.landingOn(new Set([roadmapPageId]));
    }

    roadmap = (await this.roadmapGet())!;
  }
  return roadmap;
}
export async function roadmapOff(this: Templater, roadmap: RoadmapInstance): Promise<void> {
  this._pageDelete(roadmap.pageAndIndex.page.pageId);
}
