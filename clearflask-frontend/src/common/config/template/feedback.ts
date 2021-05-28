import * as Admin from "../../../api/admin";
import { notEmpty } from "../../util/arrayUtil";
import randomUuid from "../../util/uuid";
import * as ConfigEditor from "../configEditor";
import Templater from "../configTemplater";

const FeedbackCategoryIdPrefix = 'feedback-';
const FeedbackSubCategoryTagIdPrefix = 'subcategory-';
interface PageAndIndex {
  page: Admin.Page,
  pageIndex: number,
}
export interface FeedbackInstance {
  category: Admin.Category;
  hasAllPages: boolean;
  subcategories: Array<{
    tagId?: string;
    pageAndIndex?: PageAndIndex;
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
    hasAllPages: true,
    subcategories: [],
  };

  const findPageAndIndex = async (category: Admin.Category, tag?: Admin.Tag): Promise<PageAndIndex | undefined> => {
    const expectedFilterTagIds = tag
      // Ensure that this page is filtering out tag exactly
      ? [tag.tagId]
      // Or if this is a case of backwards compatibility where we are looking for the absence of a tag,
      // ensure that this page is filtering out all other category tags
      : category.tagging.tags.filter(t => !t.tagId.startsWith(FeedbackSubCategoryTagIdPrefix)).map(t => t.tagId);
    const expectedInvertTag = !!tag ? false : (expectedFilterTagIds.length > 0 ? true : undefined);
    const potentialPages: PageAndIndex[] = this.editor.getConfig().layout.pages
      .map((page, pageIndex) => ({ page, pageIndex }))
      .filter(p => p.page.explorer?.search.filterCategoryIds?.length === 1
        && p.page.explorer.search.filterCategoryIds[0] === category.categoryId
        && (expectedInvertTag === undefined || !!p.page.explorer.search.invertTag === expectedInvertTag)
        && expectedFilterTagIds.length === (p.page.explorer.search.filterTagIds?.length || 0)
        && expectedFilterTagIds.every(expectedTagId => p.page.explorer?.search.filterTagIds?.some(tId => tId === expectedTagId))
      );
    if (potentialPages.length === 1) {
      return potentialPages[0];
    } else if (potentialPages.length > 1) {
      const name = `${category.name}${tag ? `'s ${tag.name}` : ''}`;
      const pageId = await this._getConfirmation({
        title: `Which page collects ${name}?`,
        description: `We are having trouble determining which page is used for collecting ${name}. Please select the page to edit it.`,
        responses: potentialPages.map(p => ({
          id: p.page.pageId,
          title: p.page.name,
        })),
      }, 'None');
      if (!!pageId) {
        return this.editor.getConfig().layout.pages
          .map((page, pageIndex) => ({ page, pageIndex }))
          .find(p => p.page.pageId === pageId);
      }
    }
    return undefined;
  }

  if (!feedbackCategory.categoryId.startsWith(FeedbackCategoryIdPrefix)) {
    // Backwards compatibility, assume there are posts with no subcategory tag
    const pageAndIndex = await findPageAndIndex(feedbackCategory);
    if (!pageAndIndex) feedback.hasAllPages = false;
    feedback.subcategories.push({ pageAndIndex });
  }

  feedbackCategory.tagging.tags.filter(t => t.tagId.startsWith(FeedbackSubCategoryTagIdPrefix))
    .forEach(async t => {
      const pageAndIndex = await findPageAndIndex(feedbackCategory!, t);
      if (!pageAndIndex) feedback.hasAllPages = false;
      feedback.subcategories.push({ tagId: t.tagId, pageAndIndex });
    });

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
    feedback = (await this.feedbackGet())!;
  }
  const subcatsWithoutPage = feedback.subcategories.filter(subcat => !subcat.pageAndIndex);
  if (subcatsWithoutPage.length > 0) {
    const pagesProp = this._get<ConfigEditor.PageGroup>(['layout', 'pages']);
    subcatsWithoutPage.forEach(subcat => {
      const tag = !subcat.tagId ? undefined : feedback?.category.tagging.tags.find(t => t.tagId === subcat.tagId);
      const name = tag?.name || 'Feedback';
      const page: Admin.Page = {
        pageId: randomUuid(),
        name,
        slug: name.toLowerCase(),
        panels: [],
        board: undefined,
        explorer: {
          allowSearch: { enableSort: true, enableSearchText: true, enableSearchByCategory: true, enableSearchByStatus: true, enableSearchByTag: true },
          allowCreate: { actionTitle: 'Suggest', actionTitleLong: `Suggest ${name.toLowerCase()}` },
          display: {},
          search: {
            sortBy: Admin.IdeaSearchSortByEnum.Trending,
            filterCategoryIds: [feedback!.category.categoryId],
            filterTagIds: !!tag ? [tag.tagId] : feedback!.subcategories.map(subcat => subcat.tagId).filter(notEmpty),
            invertTag: !!tag ? undefined : true,
          },
        },
      };
      pagesProp.insert().setRaw(page);
      const pageIndex = pagesProp.getChildPages().length - 1;
      subcat.pageAndIndex = { page, pageIndex };

    });
  }
  feedback = (await this.feedbackGet())!;

  const menuPageIds = new Set<string>();
  this.editor.getConfig().layout.menu.forEach(menu => menu.pageIds.forEach(pageId => menuPageIds.add(pageId)));
  const subcatsWithoutMenu = feedback.subcategories.filter(subcat => !menuPageIds.has(subcat.pageAndIndex!.page.pageId));
  if (subcatsWithoutMenu.length > 0) {
    const pageIds = new Set([...(feedback.subcategories.map(subcat => subcat.pageAndIndex?.page.pageId).filter(notEmpty))]);
    const existingMenuIndex = this.editor.getConfig().layout.menu.findIndex(m => m.pageIds.some(pId => pageIds.has(pId)))
    if (existingMenuIndex === -1) {
      const menuProp = this._get<ConfigEditor.ArrayProperty>(['layout', 'menu']);
      (menuProp.insert() as ConfigEditor.ObjectProperty).setRaw(Admin.MenuToJSON({
        menuId: randomUuid(), name: 'Feedback', pageIds: subcatsWithoutMenu.map(subcat => subcat.pageAndIndex!.page.pageId),
      }));
    } else {
      const menuItemPageIdsProp = this._get<ConfigEditor.ArrayProperty>(['layout', 'menu', existingMenuIndex, 'pageIds']);
      subcatsWithoutMenu.forEach(subcat =>
        (menuItemPageIdsProp.insert() as ConfigEditor.StringProperty)
          .set(subcat.pageAndIndex!.page.pageId));
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
  feedback.subcategories?.forEach(subcat => subcat.pageAndIndex && this._pageDelete(subcat.pageAndIndex.page.pageId))
}
