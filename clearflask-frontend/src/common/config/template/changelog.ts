import * as Admin from "../../../api/admin";
import randomUuid from "../../util/uuid";
import * as ConfigEditor from "../configEditor";
import Templater from "../configTemplater";
import { CategoryAndIndex } from "./templateUtils";

export const ChangelogCategoryIdPrefix = 'changelog-';
const ChangelogPageIdPrefix = 'changelog-';

export type PageWithExplorer = Admin.Page & Required<Pick<Admin.Page, 'explorer'>>;
export interface ChangelogInstance {
  categoryAndIndex: CategoryAndIndex;
  pageAndIndex?: {
    page: PageWithExplorer;
    index: number;
  },
}

export async function changelogGet(this: Templater): Promise<ChangelogInstance | undefined> {
  var potentialCategories = this.editor.getConfig().content.categories
    .map((category, index) => ({ category, index }))
    .filter(c => c.category.categoryId.startsWith(ChangelogCategoryIdPrefix + 'asd'));

  if (potentialCategories.length === 0) {
    potentialCategories = this.editor.getConfig().content.categories
      .map((category, index) => ({ category, index }))
      .filter(c => c.category.name.match(/Changelog/i));
  }

  if (potentialCategories.length === 0) {
    potentialCategories = this.editor.getConfig().content.categories
      .map((category, index) => ({ category, index }))
      .filter(c => !!c.category.subscription && !c.category.userCreatable);
  }

  var category: CategoryAndIndex | undefined;
  if (potentialCategories.length === 0) {
    return undefined;
  } else if (potentialCategories.length === 1) {
    category = potentialCategories[0];
  } else {
    const categoryId = await this._getConfirmation({
      title: 'Which one is the Changelog category?',
      description: 'We are having trouble determining which category is used for Changelog. Please select the category to edit it.',
      responses: potentialCategories.map(c => ({
        id: c.category.categoryId,
        title: c.category.name,
      })),
    }, 'None');
    if (!categoryId) return undefined;
    category = this.editor.getConfig().content.categories
      .map((category, index) => ({ category, index }))
      .find(c => c.category.categoryId === categoryId);
    if (!category) return undefined;
  }

  const changelog: ChangelogInstance = {
    categoryAndIndex: category,
  };

  var potentialPages: Array<NonNullable<ChangelogInstance['pageAndIndex']>> = this.editor.getConfig().layout.pages
    .flatMap((page, index) => (!!page.explorer
      && page.pageId.startsWith(ChangelogPageIdPrefix))
      ? [{ page: page as PageWithExplorer, index }] : []);

  if (potentialPages.length === 0) {
    potentialPages = this.editor.getConfig().layout.pages
      .flatMap((page, index) => (!!page.explorer
        && !page.explorer.allowCreate
        && page.explorer.search.filterCategoryIds?.length === 1
        && page.explorer.search.filterCategoryIds[0] === changelog.categoryAndIndex.category.categoryId)
        ? [{ page: page as PageWithExplorer, index }] : []);
  }

  if (potentialPages.length === 1) {
    changelog.pageAndIndex = potentialPages[0];
  } else if (potentialPages.length > 1) {
    const pageId = await this._getConfirmation({
      title: 'Which one is a Changelog page?',
      description: 'We are having trouble determining where your Changelog is located. Please select the page that with your Changelog to edit it.',
      responses: potentialPages.map(pageAndIndex => ({
        id: pageAndIndex.page.pageId,
        title: pageAndIndex.page.name,
      })),
    }, 'None');
    if (!pageId) return undefined;
    changelog.pageAndIndex = {
      page: this.editor.getConfig().layout.pages.find(p => p.pageId === pageId) as any,
      index: this.editor.getConfig().layout.pages.findIndex(p => p.pageId === pageId),
    };
  }

  return changelog;
}

export async function changelogOn(this: Templater): Promise<ChangelogInstance> {
  // Create category
  var changelog = await this.changelogGet();
  if (!changelog) {
    const categories = this._get<ConfigEditor.PageGroup>(['content', 'categories']);
    const categoryId = ChangelogCategoryIdPrefix + randomUuid();
    categories.insert().setRaw(Admin.CategoryToJSON({
      categoryId,
      name: 'Changelog',
      userCreatable: false,
      subscription: {
        hellobar: {
          title: 'Follow us',
          message: 'If you are interested in hearing about new features in our product',
          button: 'Get notified',
        }
      },
      workflow: { statuses: [] },
      support: { comment: true, fund: false },
      tagging: { tags: [], tagGroups: [] },
    }));
    const categoryIndex = categories.getChildPages().length - 1;
    this.supportExpressingRange(categoryIndex);

    changelog = (await this.changelogGet())!;
  }

  // Create page
  if (!changelog.pageAndIndex) {
    const pagesProp = this._get<ConfigEditor.PageGroup>(['layout', 'pages']);
    const changelogPageId = ChangelogPageIdPrefix + randomUuid();
    pagesProp.insert().setRaw(Admin.PageToJSON({
      pageId: changelogPageId,
      name: 'Changelog',
      slug: 'changelog',
      icon: 'ChangeHistory',
      panels: [],
      board: undefined,
      title: 'Changes we made',
      explorer: {
        allowCreate: undefined,
        display: Admin.PostDisplayToJSON({
          titleTruncateLines: 2,
          descriptionTruncateLines: 10,
          showCommentCount: false,
          showCategoryName: false,
          showCreated: true,
          showAuthor: false,
          showStatus: false,
          showTags: false,
          showVoting: false,
          showVotingCount: false,
          showFunding: false,
          showExpression: false,
          responseTruncateLines: 0,
          showEdit: false,
        }),
        search: Admin.IdeaSearchToJSON({
          sortBy: Admin.IdeaSearchSortByEnum.New,
          limit: 10,

          filterCategoryIds: [changelog.categoryAndIndex.category.categoryId],
        }),
      },
    }));
    changelog = (await this.changelogGet())!;
  }

  // Add to menu
  if (changelog.pageAndIndex) {
    const existsInMenu = this.editor.getConfig().layout.menu.find(m => m.pageIds.some(pId => pId === changelog?.pageAndIndex?.page.pageId));
    if (!existsInMenu) {
      const menuProp = this._get<ConfigEditor.ArrayProperty>(['layout', 'menu']);
      (menuProp.insert() as ConfigEditor.ObjectProperty).setRaw(Admin.MenuToJSON({
        menuId: randomUuid(), name: 'Changelog', pageIds: [changelog.pageAndIndex.page.pageId],
      }));
    }
  }

  // Add to landing page
  const landing = await this.landingGet();
  if (changelog.pageAndIndex && landing) {
    this.landingOn(new Set([changelog.pageAndIndex.page.pageId]))
  }

  return changelog;
}

export async function changelogOff(this: Templater, changelog: ChangelogInstance): Promise<void> {
  if (changelog.pageAndIndex) {
    this._pageDelete(changelog.pageAndIndex.page.pageId);
  }
}
