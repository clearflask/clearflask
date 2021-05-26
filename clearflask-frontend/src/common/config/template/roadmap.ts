import * as Admin from "../../../api/admin";
import randomUuid from "../../util/uuid";
import * as ConfigEditor from "../configEditor";
import Templater from "../configTemplater";

const RoadmapPageIdPrefix = 'roadmap-';
export interface RoadmapInstance {
  page: Admin.Page & Required<Pick<Admin.Page, 'board'>>,
  pageIndex: number,
}

export async function roadmapGet(this: Templater): Promise<RoadmapInstance | undefined> {
  const feedback = (await this.feedbackGet())
  if (!feedback) throw new Error('Feedback not enabled');
  const postCategoryId = feedback.categoryId;

  var pagesWithBoards = this.editor.getConfig().layout.pages.filter(page =>
    !!page.board
    && page.board.panels.length > 0
    && page.board.panels.every(p => p.search.filterCategoryIds?.some(cId => cId === postCategoryId)));
  const pageWithRoadmap = pagesWithBoards.find(p => p.pageId.startsWith(RoadmapPageIdPrefix));
  if (pageWithRoadmap) pagesWithBoards = [pageWithRoadmap];

  if (pagesWithBoards.length === 0) {
    return undefined;
  } else if (pagesWithBoards.length === 1) {
    const roadmapPage = pagesWithBoards[0]!;
    return {
      page: roadmapPage as any,
      pageIndex: this.editor.getConfig().layout.pages.findIndex(p => p.pageId === roadmapPage.pageId);
    };
  } else {
    const roadmapPageId = await this._getConfirmation({
      title: 'Which one is a Roadmap?',
      description: 'We are having trouble determining where your Roadmap is located. Please select the page that with your Roadmap to edit it.',
      responses: pagesWithBoards.map(pageWithBoard => ({
        id: pageWithBoard.pageId,
        title: pageWithBoard.name,
      })),
    }, 'Cancel');
    if (!roadmapPageId) return undefined;
    return {
      page: this.editor.getConfig().layout.pages.find(p => p.pageId === roadmapPageId) as any,
      pageIndex: this.editor.getConfig().layout.pages.findIndex(p => p.pageId === roadmapPageId);
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
    const postCategoryId = feedback.categoryId;

    const feedbackStatuses = feedback.category.workflow.statuses;
    const status1: Admin.IdeaStatus | undefined = feedbackStatuses.find(s => s.name.match(/Planned/)) || feedbackStatuses[0];
    const status2: Admin.IdeaStatus | undefined = feedbackStatuses.find(s => s.name.match(/In progress/)) || feedbackStatuses[1];
    const status3: Admin.IdeaStatus | undefined = feedbackStatuses.find(s => s.name.match(/Completed/)) || feedbackStatuses[2];

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
      title: 'Our plan for the future',
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

    roadmap = (await this.roadmapGet())!;
  }
  return roadmap;
}
export async function roadmapOff(this: Templater, roadmap: RoadmapInstance): Promise<void> {
  this.pageDelete(roadmap.page.pageId);
}
