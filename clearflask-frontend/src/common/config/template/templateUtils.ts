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

  // Delete the actual page
  const pagesProp = this._get<ConfigEditor.PageGroup>(['layout', 'pages']);
  for (var pageIndex = this.editor.getConfig().layout.pages.length - 1; pageIndex >= 0; pageIndex--) {
    const page = this.editor.getConfig().layout.pages[pageIndex];
    if (page.pageId !== pageId) continue;
    pagesProp.delete(pageIndex);
  }
}
