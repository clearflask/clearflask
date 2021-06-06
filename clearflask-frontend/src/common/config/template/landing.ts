import * as Admin from "../../../api/admin";
import randomUuid from "../../util/uuid";
import * as ConfigEditor from "../configEditor";
import Templater from "../configTemplater";

export type PageWithLanding = Admin.Page & Required<Pick<Admin.Page, 'landing'>>;
export interface LandingInstance {
  pageAndIndex: {
    page: PageWithLanding;
    index: number;
  },
}

export async function landingGet(this: Templater): Promise<LandingInstance | undefined> {
  var potentialPages: Array<NonNullable<LandingInstance['pageAndIndex']>> = this.editor.getConfig().layout.pages
    .flatMap((page, index) => (!!page.landing
      && (page.slug === '' || page.slug === '/'))
      ? [{ page: page as PageWithLanding, index }] : []);

  if (potentialPages.length === 0) {
    potentialPages = this.editor.getConfig().layout.pages
      .flatMap((page, index) => !!page.landing
        ? [{ page: page as PageWithLanding, index }] : []);
  }

  var landingPage: LandingInstance['pageAndIndex'] | undefined;
  if (potentialPages.length === 0) {
    return undefined;
  } else if (potentialPages.length === 1) {
    landingPage = potentialPages[0];
  } else {
    const pageId = await this._getConfirmation({
      title: 'Which one is the Landing page?',
      description: 'We are having trouble determining which page is used as a Landing page. Please select the page to edit it.',
      responses: potentialPages.map(p => ({
        id: p.page.pageId,
        title: p.page.name,
      })),
    }, 'None');
    if (!pageId) return undefined;
    landingPage = this.editor.getConfig().layout.pages
      .flatMap((page, index) => (!!page.landing
        && page.pageId === pageId)
        ? [{ page: page as PageWithLanding, index }] : [])[0];
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

  const feedback = await this.feedbackGet();
  feedback?.subcategories.forEach(subcat => {
    if (!subcat.pageAndIndex) return;
    if (landing?.pageAndIndex.page.landing?.links.some(l => l.linkToPageId === subcat.pageAndIndex?.page.pageId)) return;
    if (!!onlyPageIds && !onlyPageIds.has(subcat.pageAndIndex.page.pageId)) return;
    (landingLinksProp.insert() as ConfigEditor.ObjectProperty).setRaw(Admin.LandingLinkToJSON({
      title: subcat.pageAndIndex.page.name,
      icon: 'RecordVoiceOver',
      description: 'How can we improve our product?',
      linkToPageId: subcat.pageAndIndex.page.pageId,
    }));
  })

  const roadmap = await this.roadmapGet();
  if (roadmap?.pageAndIndex
    && (!onlyPageIds || onlyPageIds.has(roadmap.pageAndIndex.page.pageId))
    && !landing.pageAndIndex.page.landing?.links.some(l => l.linkToPageId === roadmap.pageAndIndex.page.pageId)) {
    (landingLinksProp.insert() as ConfigEditor.ObjectProperty).setRaw(Admin.LandingLinkToJSON({
      title: 'Roadmap',
      description: "See what we're working on next.",
      linkToPageId: roadmap?.pageAndIndex.page.pageId,
    }));
  }

  const changelog = await this.changelogGet();
  if (changelog?.pageAndIndex
    && (!onlyPageIds || onlyPageIds.has(changelog.pageAndIndex.page.pageId))
    && !landing.pageAndIndex.page.landing?.links.some(l => l.linkToPageId === changelog.pageAndIndex?.page.pageId)) {
    (landingLinksProp.insert() as ConfigEditor.ObjectProperty).setRaw(Admin.LandingLinkToJSON({
      title: 'Changelog',
      description: 'Check out our recent updates.',
      linkToPageId: changelog.pageAndIndex.page.pageId,
    }));
  }

  return landing;
}

export async function landingOff(this: Templater, landing: LandingInstance): Promise<void> {
  this._pageDelete(landing.pageAndIndex.page.pageId);
}
