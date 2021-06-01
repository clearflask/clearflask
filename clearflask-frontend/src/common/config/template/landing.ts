import * as Admin from "../../../api/admin";
import { notEmpty } from "../../util/arrayUtil";
import randomUuid from "../../util/uuid";
import * as ConfigEditor from "../configEditor";
import Templater from "../configTemplater";
import { PageAndIndex } from "./feedback";

export interface LandingInstance {
  pageAndIndex: PageAndIndex;
}

export async function landingGet(this: Templater): Promise<LandingInstance | undefined> {
  var potentialLandingPages: PageAndIndex[] = this.editor.getConfig().layout.pages
    .map((page, index) => ({ page, index }))
    .filter(p => (p.page.slug === '' || p.page.slug === '/') && !!p.page.landing);

  if (potentialLandingPages.length === 0) {
    potentialLandingPages = this.editor.getConfig().layout.pages
      .map((page, index) => ({ page, index }))
      .filter(p => !!p.page.landing);
  }

  var landingPage: PageAndIndex | undefined;
  if (potentialLandingPages.length === 0) {
    return undefined;
  } else if (potentialLandingPages.length === 1) {
    landingPage = potentialLandingPages[0];
  } else {
    const pageId = await this._getConfirmation({
      title: 'Which one is the Landing page?',
      description: 'We are having trouble determining which page is used as a Landing page. Please select the page to edit it.',
      responses: potentialLandingPages.map(p => ({
        id: p.page.pageId,
        title: p.page.name,
      })),
    }, 'None');
    if (!pageId) return undefined;
    landingPage = this.editor.getConfig().layout.pages
      .map((page, index) => ({ page, index }))
      .find(p => p.page.pageId === pageId);
    if (!landingPage) return undefined;
  }

  const landing: LandingInstance = {
    pageAndIndex: landingPage,
  };

  return landing;
}

export async function landingOn(this: Templater, onlyPageIds?: Set<string>): Promise<LandingInstance> {
  var landing = await this.landingGet();
  if (!landing) {
    this._get<ConfigEditor.PageGroup>(['layout', 'pages']).insert(0).setRaw(Admin.PageToJSON({
      pageId: randomUuid(),
      name: 'Welcome',
      title: 'How can we help?',
      slug: '',
      panels: [],
      landing: {
        links: [],
      },
    }));

    landing = (await this.landingGet())!;
  }

  const landingLinksProp = this._get<ConfigEditor.ArrayProperty>(['layout', 'pages', landing.pageAndIndex.index, 'landing', 'links']);
  const landingLinkToPageIds = new Set(landing.pageAndIndex.page.landing?.links.map(l => l.linkToPageId).filter(notEmpty));

  const roadmap = await this.roadmapGet();
  if (roadmap?.page
    && (!onlyPageIds || onlyPageIds.has(roadmap.page.pageId))
    && !landingLinkToPageIds.has(roadmap.page.pageId)) {
    (landingLinksProp.insert(0) as ConfigEditor.ObjectProperty).setRaw(Admin.LandingLinkToJSON({
      title: 'Roadmap',
      description: 'See what we are working on next.',
      linkToPageId: roadmap?.page.pageId,
    }));
  }

  const feedback = await this.feedbackGet();
  feedback?.subcategories.forEach(subcat => {
    if (!subcat.pageAndIndex) return;
    if (landingLinkToPageIds.has(subcat.pageAndIndex.page.pageId)) return;
    if (!!onlyPageIds && !onlyPageIds.has(subcat.pageAndIndex.page.pageId)) return;
    (landingLinksProp.insert() as ConfigEditor.ObjectProperty).setRaw(Admin.LandingLinkToJSON({
      title: subcat.pageAndIndex.page.name,
      description: 'Let us know how we can improve our product.',
      linkToPageId: subcat.pageAndIndex.page.pageId,
    }));
  })

  return landing;
}

export async function landingOff(this: Templater, landing: LandingInstance): Promise<void> {
  this._pageDelete(landing.pageAndIndex.page.pageId);
}
