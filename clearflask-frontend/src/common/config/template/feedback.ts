import * as Admin from "../../../api/admin";
import Templater from "../configTemplater";

const FeedbackCategoryIdPrefix = 'feedback-';
export interface FeedbackInstance {
  categoryId: string;
  category: Admin.Category;
  subcategories?: Array<{
    tagId: string;
    page: Admin.Page,
    pageIndex: number,
  }>;
}

export async function feedbackGet(this: Templater): Promise<FeedbackInstance | undefined> {
  var potentialFeedbackCategories = this.editor.getConfig().content.categories
    .filter(c =>
      c.categoryId.startsWith(potentialFeedbackCategories));

  if (potentialFeedbackCategories.length === 0) {
    potentialFeedbackCategories = this.editor.getConfig().content.categories
      .filter(c => c.name.match(/Post|Feedback/));
  }

  if (potentialFeedbackCategories.length === 0) {
    potentialFeedbackCategories = this.editor.getConfig().content.categories;
  }

  var feedbackCategory;
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
    }, 'Cancel');
    if (!feedbackCategoryId) return undefined;
    // TODO
  }

  // TODO
  return;
}
export async function feedbackOn(this: Templater): Promise<FeedbackInstance> {
  var feedback = await this.feedbackGet();
  if (!feedback) {
    // if category exists {
    //   TODO detect subcategories
    // else
    //   TODO create category if doesnt exist along with singel subcateogry
    // TODO create page for each subcategory and one menu item with all pages
    feedback = {} as FeedbackInstance; // TODO
  }
  return feedback;
}
export async function feedbackOff(this: Templater, feedback: FeedbackInstance): Promise<void> {
  feedback.subcategories?.forEach(subcat => this.pageDelete(subcat.page.pageId))
}
