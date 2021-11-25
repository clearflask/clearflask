// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
import * as Admin from "../../../api/admin";
import { T } from "../../../i18n";
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
      name: T<'app'>('welcome'),
      title: T<'app'>('how-can-we-help'),
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
  if (feedback?.pageAndIndex
    && (!onlyPageIds || onlyPageIds.has(feedback.pageAndIndex.page.pageId))
    && !landing.pageAndIndex.page.landing.links.some(l => l.linkToPageId === feedback?.pageAndIndex?.page.pageId)) {
    (landingLinksProp.insert() as ConfigEditor.ObjectProperty).setRaw(Admin.LandingLinkToJSON({
      title: T<'app'>('feedback'),
      description: T<'app'>('how-can-we-improve-our-product'),
      linkToPageId: feedback.pageAndIndex.page.pageId,
    }));
  }

  const roadmap = await this.roadmapGet();
  if (roadmap?.pageAndIndex
    && (!onlyPageIds || onlyPageIds.has(roadmap.pageAndIndex.page.pageId))
    && !landing.pageAndIndex.page.landing?.links.some(l => l.linkToPageId === roadmap.pageAndIndex?.page.pageId)) {
    (landingLinksProp.insert() as ConfigEditor.ObjectProperty).setRaw(Admin.LandingLinkToJSON({
      title: T<'app'>('roadmap'),
      description: T<'app'>('see-what-were-working-on-next'),
      linkToPageId: roadmap?.pageAndIndex.page.pageId,
    }));
  }

  const changelog = await this.changelogGet();
  if (changelog?.pageAndIndex
    && (!onlyPageIds || onlyPageIds.has(changelog.pageAndIndex.page.pageId))
    && !landing.pageAndIndex.page.landing?.links.some(l => l.linkToPageId === changelog.pageAndIndex?.page.pageId)) {
    (landingLinksProp.insert() as ConfigEditor.ObjectProperty).setRaw(Admin.LandingLinkToJSON({
      title: T<'app'>('announcements'),
      description: T<'app'>('check-out-our-recent-updates'),
      linkToPageId: changelog.pageAndIndex.page.pageId,
    }));
  }

  // var supportEmail = ServerAdmin.get().getStore().getState().account.account.account?.email;
  // if (!supportEmail && detectEnv() === Environment.DEVELOPMENT_FRONTEND) {
  //   // Since development environment mocking happens before user is logged in,
  //   // mock the email address here too
  //   supportEmail = 'admin@' + windowIso.parentDomain;
  // }
  // if (supportEmail
  //   && !onlyPageIds
  //   && !landing.pageAndIndex.page.landing?.links.some(l => l.url?.startsWith('mailto:'))) {
  //   (landingLinksProp.insert() as ConfigEditor.ObjectProperty).setRaw(Admin.LandingLinkToJSON({
  //     icon: 'AlternateEmail',
  //     title: 'Contact',
  //     description: 'Let us know if you need direct help.',
  //     url: `mailto:${supportEmail}`,
  //   }));
  // }

  return landing;
}

export async function landingOff(this: Templater, landing?: LandingInstance): Promise<void> {
  if (!landing) landing = await this.landingGet();
  if (!landing) return;
  this._pageDelete(landing.pageAndIndex.page.pageId);
}
