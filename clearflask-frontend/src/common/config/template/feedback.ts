import * as Admin from "../../../api/admin";
import stringToSlug from "../../util/slugger";
import randomUuid from "../../util/uuid";
import * as ConfigEditor from "../configEditor";
import Templater from "../configTemplater";
import { CategoryAndIndex } from "./templateUtils";

const FeedbackCategoryIdPrefix = 'feedback-';
const FeedbackPageIdPrefix = 'feedback-';
const FeedbackStatusAcceptedPrefix = 'accepted-';
export type PageWithExplorer = Admin.Page & Required<Pick<Admin.Page, 'explorer'>>;
export interface FeedbackInstance {
  categoryAndIndex: CategoryAndIndex;
  pageAndIndex?: {
    page: PageWithExplorer;
    index: number;
  },
  statusIdAccepted?: string;
}

export async function feedbackGet(this: Templater): Promise<FeedbackInstance | undefined> {
  const categoryAndIndex = await this._findCategoryByPrefix(FeedbackCategoryIdPrefix, 'Feedback');
  if (!categoryAndIndex) return undefined;

  const pageAndIndex = await this._findPageByPrefix(FeedbackPageIdPrefix, 'Feedback', page => !!page.explorer);

  const feedback: FeedbackInstance = {
    categoryAndIndex,
    pageAndIndex: pageAndIndex as (FeedbackInstance['pageAndIndex'] | undefined),
    statusIdAccepted: categoryAndIndex.category.workflow.statuses
      .find(s => s.statusId.startsWith(FeedbackStatusAcceptedPrefix))?.statusId,
  };

  return feedback;
}

export async function feedbackOn(this: Templater): Promise<FeedbackInstance> {
  var feedback = await this.feedbackGet();

  // Create Category
  if (!feedback) {
    const categoriesProp = this._get<ConfigEditor.PageGroup>(['content', 'categories']);
    const postCategoryId = FeedbackCategoryIdPrefix + randomUuid();
    categoriesProp.insert().setRaw(Admin.CategoryToJSON({
      categoryId: postCategoryId, name: 'Feedback',
      userCreatable: true,
      workflow: { statuses: [] },
      support: { vote: { enableDownvotes: false }, comment: true, fund: false },
      tagging: { tags: [], tagGroups: [] },
    }));
    const postCategoryIndex = categoriesProp.getChildPages().length - 1;

    const statusIdNew = randomUuid();
    const statusIdGatheringFeedback = randomUuid();
    const statusIdAccepted = FeedbackStatusAcceptedPrefix + randomUuid();
    const statusIdClosed = randomUuid();
    this.workflow(postCategoryIndex, statusIdNew, [
      { name: 'New', nextStatusIds: [statusIdGatheringFeedback, statusIdAccepted, statusIdClosed, statusIdClosed], color: this.workflowColorNew, statusId: statusIdNew, disableFunding: false, disableExpressions: false, disableVoting: false, disableComments: false, disableIdeaEdits: false },
      { name: 'Considering', nextStatusIds: [statusIdAccepted, statusIdClosed], color: this.workflowColorNeutral, statusId: statusIdGatheringFeedback, disableFunding: false, disableExpressions: false, disableVoting: false, disableComments: false, disableIdeaEdits: false },
      { name: 'Accepted', nextStatusIds: [], color: this.workflowColorComplete, statusId: statusIdAccepted, disableFunding: false, disableExpressions: false, disableVoting: false, disableComments: false, disableIdeaEdits: false },
      { name: 'Closed', nextStatusIds: [], color: this.workflowColorFail, statusId: statusIdClosed, disableFunding: false, disableExpressions: false, disableVoting: false, disableComments: false, disableIdeaEdits: false },
    ]);

    feedback = (await this.feedbackGet())!;
  }

  // Create page
  if (!feedback.pageAndIndex) {
    const page: PageWithExplorer = {
      pageId: FeedbackPageIdPrefix + randomUuid(),
      name: 'Feedback',
      slug: stringToSlug('feedback'),
      icon: 'RecordVoiceOver',
      panels: [],
      board: undefined,
      explorer: {
        allowSearch: { enableSort: true, enableSearchText: true, enableSearchByCategory: true, enableSearchByStatus: true, enableSearchByTag: true },
        allowCreate: { actionTitle: 'Suggest', actionTitleLong: `Suggest Feedback` },
        display: {},
        search: {
          sortBy: Admin.IdeaSearchSortByEnum.Trending,
          filterCategoryIds: [feedback.categoryAndIndex.category.categoryId],
        },
      },
    };
    const pagesProp = this._get<ConfigEditor.PageGroup>(['layout', 'pages']);
    pagesProp.insert().setRaw(page);

    feedback = (await this.feedbackGet())!;
  }

  // Add page to menu
  const isInMenu = this.editor.getConfig().layout.menu.some(menu => menu.pageIds.some(pageId => pageId === feedback?.pageAndIndex?.page.pageId));
  if (!isInMenu) {
    const menuProp = this._get<ConfigEditor.ArrayProperty>(['layout', 'menu']);
    (menuProp.insert() as ConfigEditor.ObjectProperty).setRaw(Admin.MenuToJSON({
      menuId: randomUuid(),
      pageIds: [feedback.pageAndIndex!.page.pageId],
    }));
  }

  // Add to landing page
  const landing = await this.landingGet();
  const isInLanding = landing?.pageAndIndex.page.landing.links.some(link => link.linkToPageId === feedback?.pageAndIndex?.page.pageId);
  if (!isInLanding) {
    this.landingOn(new Set([feedback.pageAndIndex!.page.pageId]));
  }

  return feedback;
}

export async function feedbackPageOff(this: Templater, feedback: FeedbackInstance): Promise<void> {
  if (feedback.pageAndIndex) {
    this._pageDelete(feedback.pageAndIndex.page.pageId);
  }
}
