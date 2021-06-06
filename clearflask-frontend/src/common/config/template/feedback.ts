import * as Admin from "../../../api/admin";
import { notEmpty } from "../../util/arrayUtil";
import stringToSlug from "../../util/slugger";
import randomUuid from "../../util/uuid";
import * as ConfigEditor from "../configEditor";
import Templater from "../configTemplater";

const FeedbackCategoryIdPrefix = 'feedback-';
const FeedbackSubCategoryTagIdPrefix = 'subcategory-';
export const FeedbackSubCategoryGroupTagIdPrefix = 'subcategory-';
export interface CategoryAndIndex {
  category: Admin.Category,
  index: number,
}
export type PageWithExplorer = Admin.Page & Required<Pick<Admin.Page, 'explorer'>>;
export interface FeedbackSubCategoryInstance {
  tagId?: string; // If missing, means backwards compatible category before subcategorie were introduced
  pageAndIndex?: {
    page: PageWithExplorer;
    index: number;
  },
}
export interface FeedbackInstance {
  categoryAndIndex: CategoryAndIndex;
  hasAnyPages: boolean;
  subcategories: Array<FeedbackSubCategoryInstance>;
  tagGroupAndIndex?: {
    tagGroup: Admin.TagGroup,
    index: number;
  },
}

export async function feedbackGet(this: Templater): Promise<FeedbackInstance | undefined> {
  var potentialFeedbackCategories = this.editor.getConfig().content.categories
    .map((category, index) => ({ category, index }))
    .filter(c => c.category.categoryId.startsWith(FeedbackCategoryIdPrefix));

  if (potentialFeedbackCategories.length === 0) {
    potentialFeedbackCategories = this.editor.getConfig().content.categories
      .map((category, index) => ({ category, index }))
      .filter(c => c.category.name.match(/Post|Feedback/i));
  }

  if (potentialFeedbackCategories.length === 0) {
    potentialFeedbackCategories = this.editor.getConfig().content.categories
      .map((category, index) => ({ category, index }))
      .filter(c => !c.category.subscription && !!c.category.userCreatable);
  }

  var feedbackCategory: CategoryAndIndex | undefined;
  if (potentialFeedbackCategories.length === 0) {
    return undefined;
  } else if (potentialFeedbackCategories.length === 1) {
    feedbackCategory = potentialFeedbackCategories[0];
  } else {
    const feedbackCategoryId = await this._getConfirmation({
      title: 'Which one is the Feedback category?',
      description: 'We are having trouble determining which category is used for Feedback. Please select the category to edit it.',
      responses: potentialFeedbackCategories.map(c => ({
        id: c.category.categoryId,
        title: c.category.name,
      })),
    }, 'None');
    if (!feedbackCategoryId) return undefined;
    feedbackCategory = this.editor.getConfig().content.categories
      .map((category, index) => ({ category, index }))
      .find(c => c.category.categoryId === feedbackCategoryId);
    if (!feedbackCategory) return undefined;
  }

  const feedback: FeedbackInstance = {
    categoryAndIndex: feedbackCategory,
    hasAnyPages: false,
    subcategories: [],
  };

  const categoryTags = feedbackCategory.category.tagging.tags.filter(t => t.tagId.startsWith(FeedbackSubCategoryTagIdPrefix));

  const findPageAndIndex = async (category: Admin.Category, tag?: Admin.Tag): Promise<FeedbackSubCategoryInstance['pageAndIndex']> => {
    const isOnlyCategory = this.editor.getConfig().content.categories.length <= 1;
    const expectedFilterTagIds = tag
      // Ensure that this page is filtering out tag exactly
      ? [tag.tagId]
      // Or if this is a case of backwards compatibility where we are looking for the absence of a tag,
      // ensure that this page is filtering out all other category tags
      : categoryTags.map(t => t.tagId);
    const expectedInvertTag = !!tag ? false : (expectedFilterTagIds.length > 0 ? true : undefined);
    const potentialPages: Array<NonNullable<FeedbackSubCategoryInstance['pageAndIndex']>> = this.editor.getConfig().layout.pages
      .flatMap((page, index) => (!!page.explorer
        // Filter by category if more than one category exists
        && (isOnlyCategory
          || (page.explorer.search.filterCategoryIds?.length === 1
            && page.explorer.search.filterCategoryIds[0] === category.categoryId))
        && (expectedInvertTag === undefined || !!page.explorer.search.invertTag === expectedInvertTag)
        && expectedFilterTagIds.length === (page.explorer.search.filterTagIds?.length || 0)
        && expectedFilterTagIds.every(expectedTagId => page.explorer?.search.filterTagIds?.some(tId => tId === expectedTagId)))
        ? [{ page: page as PageWithExplorer, index }] : []);
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
          .flatMap((page, index) => (!!page.explorer
            && page.pageId === pageId)
            ? [{ page: page as PageWithExplorer, index }] : [])[0];
      }
    }
    return undefined;
  }

  if (!feedbackCategory.category.categoryId.startsWith(FeedbackCategoryIdPrefix)) {
    // Backwards compatibility, assume there are posts with no subcategory tag
    const pageAndIndex = await findPageAndIndex(feedbackCategory.category);
    if (!!pageAndIndex) feedback.hasAnyPages = true;
    feedback.subcategories.push({ pageAndIndex });
  }

  await Promise.all(categoryTags.map(async t => {
    const pageAndIndex = await findPageAndIndex(feedbackCategory!.category, t);
    if (!!pageAndIndex) feedback.hasAnyPages = true;
    feedback.subcategories.push({ tagId: t.tagId, pageAndIndex });
  }));

  const feedbackTagGroupIndex = feedback.categoryAndIndex.category.tagging.tagGroups
    .findIndex(g => g.tagGroupId.startsWith(FeedbackSubCategoryGroupTagIdPrefix));
  const feedbackTagGroup = feedbackTagGroupIndex === -1 ? undefined : feedback.categoryAndIndex.category.tagging.tagGroups[feedbackTagGroupIndex];
  if (feedbackTagGroup) {
    feedback.tagGroupAndIndex = {
      tagGroup: feedbackTagGroup,
      index: feedbackTagGroupIndex,
    };
  }

  return feedback;
}

export async function feedbackOn(this: Templater, onlySingleSubcat?: FeedbackSubCategoryInstance): Promise<FeedbackInstance> {
  var feedback = await this.feedbackGet();
  if (!feedback) {
    const categories = this._get<ConfigEditor.PageGroup>(['content', 'categories']);
    const postCategoryId = FeedbackCategoryIdPrefix + randomUuid();
    categories.insert().setRaw(Admin.CategoryToJSON({
      categoryId: postCategoryId, name: 'Feedback',
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
      { name: 'Under Review', nextStatusIds: [statusIdPlanned, statusIdClosed], color: this.workflowColorNeutral, statusId: statusIdUnderReview, disableFunding: false, disableExpressions: false, disableVoting: false, disableComments: false, disableIdeaEdits: false },
      { name: 'Planned', nextStatusIds: [statusIdInProgress, statusIdUnderReview], color: this.workflowColorNeutral, statusId: statusIdPlanned, disableFunding: false, disableExpressions: false, disableVoting: false, disableComments: false, disableIdeaEdits: false },
      { name: 'In Progress', nextStatusIds: [statusIdPlanned, statusIdCompleted], color: this.workflowColorProgress, statusId: statusIdInProgress, disableFunding: false, disableExpressions: false, disableVoting: false, disableComments: false, disableIdeaEdits: false },
      { name: 'Completed', nextStatusIds: [], color: this.workflowColorComplete, statusId: statusIdCompleted, disableFunding: false, disableExpressions: false, disableVoting: false, disableComments: false, disableIdeaEdits: false },
      { name: 'Closed', nextStatusIds: [], color: this.workflowColorFail, statusId: statusIdClosed, disableFunding: false, disableExpressions: false, disableVoting: false, disableComments: false, disableIdeaEdits: false },
    ]);

    this.feedbackSubcategoryAdd('Feedback');

    feedback = (await this.feedbackGet())!;
  }
  const subcatsWithoutPage = feedback.subcategories.filter(subcat =>
    !subcat.pageAndIndex
    && (!onlySingleSubcat || onlySingleSubcat.tagId === subcat.tagId));
  if (subcatsWithoutPage.length > 0) {
    const pagesProp = this._get<ConfigEditor.PageGroup>(['layout', 'pages']);
    subcatsWithoutPage.forEach(subcat => {
      const tag = !subcat.tagId ? undefined : feedback?.categoryAndIndex.category.tagging.tags.find(t => t.tagId === subcat.tagId);
      const name = tag?.name || 'Feedback';
      const page: PageWithExplorer = {
        pageId: randomUuid(),
        name,
        slug: stringToSlug(name),
        panels: [],
        board: undefined,
        explorer: {
          allowSearch: { enableSort: true, enableSearchText: true, enableSearchByCategory: true, enableSearchByStatus: true, enableSearchByTag: true },
          allowCreate: { actionTitle: 'Suggest', actionTitleLong: `Suggest ${name.toLowerCase()}` },
          display: {},
          search: {
            sortBy: Admin.IdeaSearchSortByEnum.Trending,
            filterCategoryIds: [feedback!.categoryAndIndex.category.categoryId],
            filterTagIds: !!tag ? [tag.tagId] : feedback!.subcategories.map(subcat => subcat.tagId).filter(notEmpty),
            invertTag: !!tag ? undefined : true,
          },
        },
      };
      pagesProp.insert().setRaw(page);
      const pageIndex = pagesProp.getChildPages().length - 1;
      subcat.pageAndIndex = { page, index: pageIndex };

    });
  }
  feedback = (await this.feedbackGet())!;

  const menuPageIds = new Set<string>();
  this.editor.getConfig().layout.menu.forEach(menu => menu.pageIds.forEach(pageId => menuPageIds.add(pageId)));
  const subcatsWithoutMenu = feedback.subcategories.filter(subcat =>
    !!subcat.pageAndIndex
    && !menuPageIds.has(subcat.pageAndIndex.page.pageId)
    && (!onlySingleSubcat || onlySingleSubcat.tagId === subcat.tagId));
  if (subcatsWithoutMenu.length > 0) {
    const pageIds = new Set([...(feedback.subcategories.map(subcat => subcat.pageAndIndex?.page.pageId).filter(notEmpty))]);
    const existingMenuIndex = this.editor.getConfig().layout.menu.findIndex(m => m.pageIds.some(pId => pageIds.has(pId)));
    if (existingMenuIndex === -1) {
      const menuProp = this._get<ConfigEditor.ArrayProperty>(['layout', 'menu']);
      (menuProp.insert() as ConfigEditor.ObjectProperty).setRaw(Admin.MenuToJSON({
        menuId: randomUuid(),
        name: 'Feedback',
        icon: 'RecordVoiceOver',
        pageIds: subcatsWithoutMenu.map(subcat => subcat.pageAndIndex!.page.pageId),
      }));
    } else {
      const menuItemNameProp = this._get<ConfigEditor.StringProperty>(['layout', 'menu', existingMenuIndex, 'name']);
      if (!menuItemNameProp.value) menuItemNameProp.set('Feedback');
      const menuItemPageIdsProp = this._get<ConfigEditor.LinkMultiProperty>(['layout', 'menu', existingMenuIndex, 'pageIds']);
      subcatsWithoutMenu.forEach(subcat =>
        menuItemPageIdsProp.insert(subcat.pageAndIndex!.page.pageId));
    }
  }

  // Group tag for all feedback subcategories
  const tagGroupTagIds = onlySingleSubcat
    ? (onlySingleSubcat.tagId ? [onlySingleSubcat.tagId] : [])
    : feedback.subcategories.map(subcat => subcat.tagId).filter(notEmpty);
  if (!feedback.tagGroupAndIndex) {
    this._get<ConfigEditor.PageGroup>(['content', 'categories', feedback.categoryAndIndex.index, 'tagging', 'tagGroups']).insert().setRaw(Admin.TagGroupToJSON({
      tagGroupId: FeedbackSubCategoryGroupTagIdPrefix + randomUuid(),
      name: 'Subcategory',
      userSettable: true,
      tagIds: tagGroupTagIds,
      minRequired: 1,
      maxRequired: 1,
    }));
    feedback = (await this.feedbackGet())!;
  } else {
    const tagGroupTagIdsToAdd = tagGroupTagIds.filter(tId => !feedback?.tagGroupAndIndex?.tagGroup.tagIds.includes(tId));
    if (tagGroupTagIdsToAdd.length) {
      const tagIdsProp = this._get<ConfigEditor.LinkMultiProperty>(['content', 'categories', feedback.categoryAndIndex.index, 'tagging', 'tagGroups', feedback.tagGroupAndIndex.index, 'tagIds']);
      tagGroupTagIdsToAdd.forEach(tId => tagIdsProp.insert(tId));
      feedback = (await this.feedbackGet())!;
    }
  }

  const landing = await this.landingGet();
  if (landing) {
    const subcatsForLandingPage = feedback.subcategories
      .filter(subcat => !onlySingleSubcat || subcat.tagId === onlySingleSubcat.tagId)
      .map(subcat => subcat.pageAndIndex?.page.pageId)
      .filter(notEmpty);
    if (subcatsForLandingPage.length) {
      this.landingOn(new Set(subcatsForLandingPage));
    }
  }

  return feedback;
}
export async function feedbackSubcategoryAdd(this: Templater, name: string): Promise<FeedbackInstance> {
  var feedback = await this.feedbackGet();
  if (!feedback) throw new Error('Feedback is not enabled');
  const categoryIndex = this.editor.getConfig().content.categories
    .findIndex(c => c.categoryId === feedback!.categoryAndIndex.category.categoryId);
  const tagId = FeedbackSubCategoryTagIdPrefix + randomUuid();
  this.tagging(categoryIndex, [{ name, tagId }]);

  // For backwards compat, catch-all subcat needs to be updated to filter out this new subcat
  const catchAllSubcat = feedback.subcategories.find(subcat => !subcat.tagId);
  if (catchAllSubcat?.pageAndIndex?.page.explorer) {
    this._get<ConfigEditor.LinkMultiProperty>(['layout', 'pages', catchAllSubcat.pageAndIndex.index, 'explorer', 'search', 'filterTagIds'])
      .insert(tagId);
    const invertTagProp = this._get<ConfigEditor.BooleanProperty>(['layout', 'pages', catchAllSubcat.pageAndIndex.index, 'explorer', 'search', 'invertTag']);
    if (!invertTagProp.value) invertTagProp.set(true);
  }

  return this.feedbackOn({ tagId });
}
export function feedbackSubcategoryRename(this: Templater, feedback: FeedbackInstance, subcat: FeedbackSubCategoryInstance, name: string) {
  if (subcat.tagId) {
    const tagIndex = feedback.categoryAndIndex.category.tagging.tags.findIndex(t => t.tagId === subcat.tagId);
    if (tagIndex !== -1)
      this._get<ConfigEditor.StringProperty>(['content', 'categories', feedback.categoryAndIndex.index, 'tagging', 'tags', tagIndex, 'name']).set(name);
  }
  if (subcat.pageAndIndex) {
    this._get<ConfigEditor.StringProperty>(['layout', 'pages', subcat.pageAndIndex.index, 'name']).set(name);
    this._get<ConfigEditor.StringProperty>(['layout', 'pages', subcat.pageAndIndex.index, 'pageTitle']).set(name);
  }
}
export async function feedbackOff(this: Templater, feedback: FeedbackInstance, onlySingleSubcat?: FeedbackSubCategoryInstance): Promise<void> {
  feedback.subcategories?.forEach(subcat =>
    subcat.pageAndIndex
    && (!onlySingleSubcat || onlySingleSubcat.tagId === subcat.tagId)
    && this._pageDelete(subcat.pageAndIndex.page.pageId));
}
