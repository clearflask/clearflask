import * as Admin from "../../../api/admin";
import { notEmpty } from "../../util/arrayUtil";
import randomUuid from "../../util/uuid";
import * as ConfigEditor from "../configEditor";
import Templater from "../configTemplater";

const FeedbackCategoryIdPrefix = 'feedback-';
const FeedbackSubCategoryTagIdPrefix = 'subcategory-';
export interface FeedbackInstance {
  category: Admin.Category;
  subcategories: Array<{
    tagId?: string;
    page?: {
      page: Admin.Page,
      pageIndex: number,
    },
  }>;
}

export async function feedbackGet(this: Templater): Promise<FeedbackInstance | undefined> {
  var potentialFeedbackCategories = this.editor.getConfig().content.categories
    .filter(c => c.categoryId.startsWith(FeedbackCategoryIdPrefix));

  if (potentialFeedbackCategories.length === 0) {
    potentialFeedbackCategories = this.editor.getConfig().content.categories
      .filter(c => c.name.match(/Post|Feedback/i));
  }

  if (potentialFeedbackCategories.length === 0) {
    potentialFeedbackCategories = this.editor.getConfig().content.categories;
  }

  var feedbackCategory: Admin.Category | undefined;
  if (potentialFeedbackCategories.length === 0) {
    return undefined;
  } else if (potentialFeedbackCategories.length === 1) {
    feedbackCategory = potentialFeedbackCategories[0];
  } else {
    const feedbackCategoryId = await this._getConfirmation({
      title: 'Which one is the Feedback category?',
      description: 'We are having trouble determining which category is used for Feedback. Please select the category to edit it.',
      responses: potentialFeedbackCategories.map(c => ({
        id: c.categoryId,
        title: c.name,
      })),
    }, 'None');
    if (!feedbackCategoryId) return undefined;
    feedbackCategory = this.editor.getConfig().content.categories
      .find(c => c.categoryId === feedbackCategoryId);
    if (!feedbackCategory) return undefined;
  }

  const feedback: FeedbackInstance = {
    category: feedbackCategory,
    subcategories: [],
  };

  const findPage = async (category: Admin.Category, tag?: Admin.Tag): Promise<FeedbackInstance['subcategories'][number]['page'] | undefined> => {
    const categoryId = category.categoryId;
    const tagId = tag?.tagId;
    const potentialPages = this.editor.getConfig().layout.pages
      .filter(p => p.explorer?.search.filterCategoryIds?.length === 1
        && p.explorer.search.filterCategoryIds[0] === categoryId
        && (!tagId || p.explorer.search.filterTagIds?.some(tId => tId === tagId))
        && (p.explorer.search.filterTagIds || []).every(tId => tId === tagId || !tId.startsWith(FeedbackSubCategoryTagIdPrefix)));
    var page;
    if (potentialPages.length === 0) {
      return undefined;
    } else if (potentialPages.length === 1) {
      page = potentialPages[0];
    } else {
      const name = `${category.name}${tag ? `'s ${tag.name}` : ''}`;
      const pageId = await this._getConfirmation({
        title: `Which page collects ${name}?`,
        description: `We are having trouble determining which page is used for collecting ${name}. Please select the page to edit it.`,
        responses: potentialFeedbackCategories.map(c => ({
          id: c.categoryId,
          title: c.name,
        })),
      }, 'None');
      if (!pageId) return undefined;
      page = this.editor.getConfig().layout.pages
        .find(p => p.pageId === pageId);
      if (!page) return undefined;
    }
    return {
      page,
      pageIndex: this.editor.getConfig().layout.pages
        .findIndex(p => p.pageId === page.pageId),
    };
  }

  if (!feedbackCategory.categoryId.startsWith(FeedbackCategoryIdPrefix)) {
    // Backwards compatibility, assume there are posts with no subcategory tag
    feedback.subcategories.push({
      page: await findPage(feedbackCategory),
    });
  }

  feedbackCategory.tagging.tags.filter(t => t.tagId.startsWith(FeedbackSubCategoryTagIdPrefix))
    .forEach(async t => feedback.subcategories.push({
      page: await findPage(feedbackCategory!, t),
      tagId: t.tagId,
    }));

  return feedback;
}

export async function feedbackOn(this: Templater): Promise<FeedbackInstance> {
  var feedback = await this.feedbackGet();
  if (!feedback) {
    const categories = this._get<ConfigEditor.PageGroup>(['content', 'categories']);
    const postCategoryId = FeedbackCategoryIdPrefix + randomUuid();
    categories.insert().setRaw(Admin.CategoryToJSON({
      categoryId: postCategoryId, name: 'Post',
      userCreatable: true,
      workflow: { statuses: [] },
      support: { vote: { enableDownvotes: false }, comment: true, fund: false },
      tagging: { tags: [], tagGroups: [] },
    }));
    const postCategoryIndex = categories.getChildPages().length - 1;

    const statusIdNew = randomUuid();
    const statusIdUnderReview = randomUuid();
    const statusIdPlanned = randomUuid();
    const statusIdInProgress = randomUuid();
    const statusIdCompleted = randomUuid();
    const statusIdClosed = randomUuid();
    this.workflow(postCategoryIndex, statusIdNew, [
      { name: 'New', nextStatusIds: [statusIdUnderReview, statusIdPlanned, statusIdInProgress, statusIdCompleted, statusIdClosed], color: this.workflowColorNew, statusId: statusIdNew, disableFunding: false, disableExpressions: false, disableVoting: false, disableComments: false, disableIdeaEdits: false },
      { name: 'UnderReview', nextStatusIds: [statusIdPlanned, statusIdClosed], color: this.workflowColorNeutral, statusId: statusIdUnderReview, disableFunding: false, disableExpressions: false, disableVoting: false, disableComments: false, disableIdeaEdits: false },
      { name: 'Planned', nextStatusIds: [statusIdInProgress, statusIdUnderReview], color: this.workflowColorNeutral, statusId: statusIdPlanned, disableFunding: false, disableExpressions: false, disableVoting: false, disableComments: false, disableIdeaEdits: false },
      { name: 'InProgress', nextStatusIds: [statusIdPlanned, statusIdCompleted], color: this.workflowColorProgress, statusId: statusIdInProgress, disableFunding: false, disableExpressions: false, disableVoting: false, disableComments: false, disableIdeaEdits: false },
      { name: 'Completed', nextStatusIds: [], color: this.workflowColorComplete, statusId: statusIdCompleted, disableFunding: false, disableExpressions: false, disableVoting: false, disableComments: false, disableIdeaEdits: false },
      { name: 'Closed', nextStatusIds: [], color: this.workflowColorFail, statusId: statusIdClosed, disableFunding: false, disableExpressions: false, disableVoting: false, disableComments: false, disableIdeaEdits: false },
    ]);
    feedback = {} as FeedbackInstance; // TODO
  }
  const subcatsWithoutPage = feedback.subcategories.filter(subcat => !subcat.page);
  if (subcatsWithoutPage.length > 0) {
    // TODO create page for subcategory and one menu item with all pages
    const pagesProp = this._get<ConfigEditor.PageGroup>(['layout', 'pages']);
    feedback.subcategories.forEach(subcat => {
      if (!!subcat.page) return;
      const tag = !subcat.tagId ? undefined : feedback?.category.tagging.tags.find(t => t.tagId === subcat.tagId);
      const name = tag?.name || 'Feedback';
      subcat.page = Admin.PageToJSON({
        pageId: randomUuid(),
        name,
        slug: name.toLowerCase(),
        panels: [],
        board: undefined,
        explorer: {
          allowSearch: { enableSort: true, enableSearchText: true, enableSearchByCategory: true, enableSearchByStatus: true, enableSearchByTag: true },
          allowCreate: { actionTitle: 'Suggest', actionTitleLong: `Suggest ${name.toLowerCase}` },
          display: {},
          search: {
            sortBy: Admin.IdeaSearchSortByEnum.Trending,
            filterCategoryIds: [feedback!.category.categoryId],
            filterTagIds: !!tag ? [tag.tagId] : feedback!.subcategories.map(subcat => subcat.tagId).filter(notEmpty),
            invertTag: !!tag ? undefined : true,
          },
        },
      });
      pagesProp.insert().setRaw(subcat.page);
    });
    const pageIds = new Set([...feedback.subcategories.map(subcat => subcat.page?.page.pageId).filter(notEmpty)]);
    const existingMenuIndex = this.editor.getConfig().layout.menu.findIndex(m => m.pageIds.some(pId => pageIds.has(pId)))
    if (existingMenuIndex === undefined) {
      const menuProp = this._get<ConfigEditor.ArrayProperty>(['layout', 'menu']);
      (menuProp.insert() as ConfigEditor.ObjectProperty).setRaw(Admin.MenuToJSON({
        menuId: randomUuid(), name: 'Feedback', pageIds: subcatsWithoutPage.map(subcat => subcat.page!.page.pageId),
      }));
    } else {
      const menuItemPageIdsProp = this._get<ConfigEditor.ArrayProperty>(['layout', 'menu', existingMenuIndex, 'pageIds']);
      subcatsWithoutPage.forEach(subcat => (menuItemPageIdsProp.insert() as ConfigEditor.StringProperty).set(subcat.page!.page.pageId));
    }
  }
  return feedback;
}
export async function feedbackSubcategoryAdd(this: Templater, name: string): Promise<FeedbackInstance> {
  var feedback = await this.feedbackGet();
  if (!feedback) throw new Error('Feedback is not enabled');
  const categoryIndex = this.editor.getConfig().content.categories
    .findIndex(c => c.categoryId === feedback!.category.categoryId)
  this.tagging(categoryIndex, [{ name, tagId: FeedbackSubCategoryTagIdPrefix + randomUuid() }]);
  return this.feedbackOn();
}
export async function feedbackOff(this: Templater, feedback: FeedbackInstance): Promise<void> {
  feedback.subcategories?.forEach(subcat => subcat.page && this.pageDelete(subcat.page.page.pageId))
}
