import * as ConfigEditor from "../configEditor";
import Templater from "../configTemplater";

// Deletes a page and all corresponding menu items
export async function pageDelete(this: Templater, pageId: string): Promise<void> {
  // Delete all references of page in Menu
  const menuProp = this._get<ConfigEditor.ArrayProperty>(['layout', 'menu']);
  while (true) {
    const menuIndexContainingPage = this.editor.getConfig().layout.menu.findIndex(m => m.pageIds.includes(pageId));
    if (!menuIndexContainingPage) {
      break;
    }
    const menu = this.editor.getConfig().layout.menu[menuIndexContainingPage];
    if (menu?.pageIds.length || 0 > 1) {
      // Menu item is pointing to several pages, delete just that one
      const pageIdToDelete = menu.pageIds.findIndex(pId => pId === pageId);
      const menuPageIdsProp = this._get<ConfigEditor.ArrayProperty>(['layout', 'menu', menuIndexContainingPage, 'pageIds']);
      menuPageIdsProp.delete(pageIdToDelete);
    } else {
      // Menu item is pointing to just this page
      menuProp.delete(menuIndexContainingPage);
    }
  }

  // Delete the actual page
  const pagesProp = this._get<ConfigEditor.PageGroup>(['layout', 'pages']);
  while (true) {
    const pageIndexToDelete = this.editor.getConfig().layout.pages.findIndex(p => p.pageId === pageId);
    if (!pageIndexToDelete) {
      break;
    }
    pagesProp.delete(pageIndexToDelete);
  }
}
