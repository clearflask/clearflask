// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import * as Admin from "../../../api/admin";
import * as ConfigEditor from "../configEditor";
import Templater from "../configTemplater";

// Deletes a page and all corresponding menu items
export async function _pageDelete(this: Templater, pageId: string): Promise<void> {
  // Delete all references of page in Menu
  const menuProp = this._get<ConfigEditor.ArrayProperty>(['layout', 'menu']);
  for (var menuIndex = this.editor.getConfig().layout.menu.length - 1; menuIndex >= 0; menuIndex--) {
    const menu = this.editor.getConfig().layout.menu[menuIndex];
    if (!menu.pageIds.includes(pageId)) continue;
    if ((menu.pageIds.length || 0) > 1) {
      // Menu item is pointing to several pages, delete just that one
      for (var pageIdIndex = menu.pageIds.length - 1; pageIdIndex >= 0; pageIdIndex--) {
        const menuPageId = menu.pageIds[pageIdIndex];
        if (pageId !== menuPageId) continue;
        this._get<ConfigEditor.ArrayProperty>(['layout', 'menu', menuIndex, 'pageIds'])
          .delete(pageIdIndex);
      }
    } else {
      // Menu item is pointing to just this page
      menuProp.delete(menuIndex);
    }
  }

  this.editor.getConfig().layout.pages
    .forEach((page, pageIndex) => page.landing?.links
      .forEach((link, linkIndex) => link.linkToPageId === pageId
        && this._get<ConfigEditor.ArrayProperty>(['layout', 'pages', pageIndex, 'landing', 'links'])
          .delete(linkIndex)));

  // Delete the actual page
  const pagesProp = this._get<ConfigEditor.PageGroup>(['layout', 'pages']);
  for (var pageIndex = this.editor.getConfig().layout.pages.length - 1; pageIndex >= 0; pageIndex--) {
    const page = this.editor.getConfig().layout.pages[pageIndex];
    if (page.pageId !== pageId) continue;
    pagesProp.delete(pageIndex);
  }
}

export interface CategoryAndIndex {
  category: Admin.Category,
  index: number,
}
// Find category by prefix
export async function _findCategoryByPrefix(this: Templater, categoryIdPrefix: string, name: string): Promise<CategoryAndIndex | undefined> {
  var potentialCategories = this.editor.getConfig().content.categories
    .map((category, index) => ({ category, index }))
    .filter(c => c.category.categoryId.startsWith(categoryIdPrefix));

  var category: CategoryAndIndex | undefined;
  if (potentialCategories.length === 0) {
    return undefined;
  } else if (potentialCategories.length === 1) {
    return potentialCategories[0];
  } else {
    const categoryId = await this._getConfirmation({
      title: `Which one is the ${name} category?`,
      description: `We are having trouble determining which category is used for ${name}. Please select the category to edit it.`,
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
    return category;
  }
}

export interface PageAndIndex {
  page: Admin.Page;
  index: number;
}
// Find page by prefix
export async function _findPageByPrefix(this: Templater, pageIdPrefix: string, name: string, filter?: (page: Admin.Page) => boolean): Promise<PageAndIndex | undefined> {
  const potentialPages: Array<NonNullable<PageAndIndex>> = this.editor.getConfig().layout.pages
    .flatMap((page, index) => (page.pageId.startsWith(pageIdPrefix)
      && (!filter || filter(page)))
      ? [{ page, index }] : []);
  if (potentialPages.length === 1) {
    return potentialPages[0];
  } else if (potentialPages.length > 1) {
    const pageId = await this._getConfirmation({
      title: `Which page is for ${name}?`,
      description: `We are having trouble determining which page is used for ${name}. Please select the page to edit it.`,
      responses: potentialPages.map(p => ({
        id: p.page.pageId,
        title: p.page.name,
      })),
    }, 'None');
    if (!!pageId) {
      return this.editor.getConfig().layout.pages
        .flatMap((page, index) => (page.pageId === pageId
          && (!filter || filter(page)))
          ? [{ page, index }] : [])[0];
    }
  }
  return undefined;
}
