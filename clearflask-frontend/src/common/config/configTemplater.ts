// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
import * as Admin from "../../api/admin";
import { StateConf } from "../../api/server";
import { isProd } from "../util/detectEnv";
import { textToHtml } from "../util/richEditorUtil";
import stringToSlug from "../util/slugger";
import randomUuid from "../util/uuid";
import windowIso from "../windowIso";
import * as ConfigEditor from "./configEditor";
import { changelogGet, ChangelogInstance, changelogOff, changelogOn } from "./template/changelog";
import { feedbackGet, FeedbackInstance, feedbackOn, feedbackUpdateWithRoadmap } from "./template/feedback";
import { landingGet, LandingInstance, landingOff, landingOn } from "./template/landing";
import { feedbackAndRoadmapGet, roadmapGet, RoadmapInstance, roadmapOn, roadmapPageOff } from "./template/roadmap";
import { _findCategoryByPrefix, _findPageByPrefix, _pageDelete } from "./template/templateUtils";

export type ConfirmationResponseId = string | undefined;
export interface ConfirmationResponse {
  id?: string;
  title: string;
  type?: 'cancel';
}
export interface Confirmation {
  title: string;
  description: string;
  responses: Array<ConfirmationResponse>;
}
export type ConfirmationHandler = (confirmation: Confirmation) => Promise<ConfirmationResponseId>;

export const configStateEqual = (left?: StateConf, right?: StateConf): boolean => {
  return left?.status === right?.status
    && left?.conf?.projectId === right?.conf?.projectId
    && left?.ver === right?.ver
};


export interface CreateTemplateV2Options {
  templateLanding?: boolean;
  templateFeedback?: boolean;
  templateFeedbackIsClassic?: boolean;
  templateRoadmap?: boolean;
  templateChangelog?: boolean;

  infoWebsite?: string;
  infoName?: string;
  infoSlug?: string;
  infoDomain?: string;
  infoLogo?: string;
}
export const createTemplateV2OptionsDefault: CreateTemplateV2Options = {
  templateLanding: true,
  templateFeedback: true,
  templateRoadmap: true,
  templateChangelog: true,
};
export interface CreateTemplateV2Result {
  feedback?: FeedbackInstance;
  roadmap?: RoadmapInstance;
  changelog?: ChangelogInstance;
  landing?: LandingInstance;
}

// TODO Home
// TODO FAQ
// TODO KNOWLEDGE BASE
// TODO BLOG
// TODO BUG BOUNTY
// TODO QUESTION AND ANSWER
// TODO FORUM
/** Depcrecated, use CreateTemplateV2Options */
export interface CreateTemplateOptions {
  templateFeedback?: boolean;
  templateRoadmap?: boolean;
  templateChangelog?: boolean;
  templateKnowledgeBase?: boolean;

  fundingAllowed?: boolean;
  creditOnSignup?: number;
  votingAllowed?: boolean;
  expressionAllowed?: boolean;
  fundingType?: 'currency' | 'time' | 'beer';
  votingEnableDownvote?: boolean;
  expressionsLimitEmojis?: boolean;
  expressionsAllowMultiple?: boolean;
  taggingIdeaBug?: boolean;

  projectPrivate?: boolean;
  anonAllowed?: boolean;
  webPushAllowed?: boolean;
  emailAllowed?: boolean;
  emailDomainAllowed?: string;
  ssoAllowed?: boolean;

  infoWebsite?: string;
  infoName?: string;
  infoSlug?: string;
  infoLogo?: string;
}
export const createTemplateOptionsDefault: CreateTemplateOptions = {
  templateFeedback: true,
  templateRoadmap: true,
  votingAllowed: true,
  emailAllowed: true,
};

const confirmationCache: { [question: string]: ConfirmationResponseId } = {};
export default class Templater {
  editor: ConfigEditor.Editor;
  confirmationHandler?: ConfirmationHandler;

  constructor(editor: ConfigEditor.Editor, confirmationHandler?: ConfirmationHandler) {
    this.editor = editor;
    this.confirmationHandler = confirmationHandler;
  }

  static get(editor: ConfigEditor.Editor, confirmationHandler?: ConfirmationHandler): Templater {
    return new Templater(editor, confirmationHandler);
  }

  _pageDelete = _pageDelete;
  _findCategoryByPrefix = _findCategoryByPrefix;
  _findPageByPrefix = _findPageByPrefix;

  landingGet = landingGet;
  landingOn = landingOn;
  landingOff = landingOff;

  feedbackGet = feedbackGet;
  feedbackOn = feedbackOn;
  feedbackUpdateWithRoadmap = feedbackUpdateWithRoadmap;

  roadmapGet = roadmapGet;
  roadmapOn = roadmapOn;
  roadmapPageOff = roadmapPageOff;

  feedbackAndRoadmapGet = feedbackAndRoadmapGet;

  changelogGet = changelogGet;
  changelogOn = changelogOn;
  changelogOff = changelogOff;

  // During template changes, user confirmation is required.
  // IE: Change to a roadmap column is requested, but we are unsure which Board
  // should be updated. User is asked which board corresponds to the right Roadmap.
  async _getConfirmation(confirmation: Confirmation, cancelTitle?: string): Promise<ConfirmationResponseId | undefined> {
    if (!!cancelTitle) {
      confirmation.responses.push({
        title: cancelTitle,
        type: 'cancel',
      });
    }

    const question = confirmation.title + confirmation.description;
    const answerCached = confirmationCache[question];
    if (answerCached !== undefined && confirmation.responses.some(r => r.id === answerCached)) {
      return answerCached;
    }

    if (this.confirmationHandler) {
      const answer = await this.confirmationHandler(confirmation);
      confirmationCache[question] = answer;
      return answer;
    }

    throw new Error('No question handler');
  }

  demo(opts: CreateTemplateOptions = createTemplateOptionsDefault) {
    this.createTemplate({
      infoName: 'Sandbox App',
      infoLogo: '/img/clearflask-logo.png',
      ...opts,
    });
    this._get<ConfigEditor.StringProperty>(['name']).set('Sandbox App');
    // this.styleWhite();
  }

  async createTemplateV2(opts: CreateTemplateV2Options = createTemplateV2OptionsDefault): Promise<CreateTemplateV2Result> {
    this._get<ConfigEditor.StringProperty>(['name']).set(opts.infoName || 'My App');
    if (!!opts.infoSlug) this._get<ConfigEditor.StringProperty>(['slug']).set(opts.infoSlug);
    if (!!opts.infoDomain) this._get<ConfigEditor.StringProperty>(['domain']).set(opts.infoDomain);
    if (!!opts.infoWebsite) this._get<ConfigEditor.StringProperty>(['website']).set(opts.infoWebsite);
    if (!!opts.infoLogo) this._get<ConfigEditor.StringProperty>(['logoUrl']).set(opts.infoLogo);

    const result: CreateTemplateV2Result = {};
    if (opts.templateFeedback) result.feedback = await this.feedbackOn(opts.templateFeedbackIsClassic ? 'explorer' : 'feedback');
    if (opts.templateRoadmap) result.roadmap = await this.roadmapOn();
    if (opts.templateChangelog) result.changelog = await this.changelogOn();
    if (opts.templateLanding) result.landing = await this.landingOn();

    if (!isProd()) {
      this.styleWhite();
    }

    return result;
  }

  createTemplate(opts: CreateTemplateOptions = createTemplateOptionsDefault) {
    this._get<ConfigEditor.StringProperty>(['name']).set(opts.infoName || 'My App');
    if (!!opts.infoSlug) this._get<ConfigEditor.StringProperty>(['slug']).set(opts.infoSlug);
    if (!!opts.infoWebsite) this._get<ConfigEditor.StringProperty>(['website']).set(opts.infoWebsite);
    if (!!opts.infoLogo) this._get<ConfigEditor.StringProperty>(['logoUrl']).set(opts.infoLogo);
    if (opts.templateFeedback) {
      this.templateFeedback(opts.fundingAllowed, opts.expressionAllowed || opts.votingAllowed, opts.templateRoadmap,
        opts.taggingIdeaBug ? {
          groupName: 'Type',
          tagOptions: [
            {
              tagName: 'Idea',
              pageName: 'Ideas',
              pageTitle: 'Give us feedback',
              pageDescription: textToHtml('We want to hear your ideas to improve our product.'),
            },
            {
              tagName: 'Bug',
              pageName: 'Bugs',
              pageTitle: 'Submit a bug report',
              pageDescription: 'We will address any issues as soon as possible.',
            },
          ],
          separatePage: true,
        } : undefined);
      const postCategoryIndex = this._get<ConfigEditor.PageGroup>(['content', 'categories']).getChildPages().length - 1;
      if (opts.votingAllowed) {
        this.supportVoting(postCategoryIndex, opts.votingEnableDownvote);
      }
      if (opts.expressionAllowed) {
        if (opts.expressionsLimitEmojis) {
          this.supportExpressingFacebookStyle(postCategoryIndex, !opts.expressionsAllowMultiple);
        } else {
          this.supportExpressingAllEmojis(postCategoryIndex, !opts.expressionsAllowMultiple);
        }
        this.supportExpressingLimitEmojiPerIdea(postCategoryIndex, !opts.expressionsAllowMultiple);
      }
      if (opts.fundingAllowed) {
        this.supportFunding(postCategoryIndex);
        switch (opts.fundingType) {
          default:
          case 'currency':
            this.creditsCurrency(opts.creditOnSignup);
            break;
          case 'time':
            this.creditsTime();
            break;
          case 'beer':
            this.creditsEmoji('🍺');
            break;
        }
      }
    }
    if (opts.templateChangelog) this.templateChangelog();
    // if (opts.templateBlog) this.templateBlog();
    if (opts.templateKnowledgeBase) this.templateKnowledgeBase();

    const menuProp = this._get<ConfigEditor.ArrayProperty>(['layout', 'menu']);
    if (menuProp.childProperties?.length === 1) {
      // If only one item in menu, just don't show it
      menuProp.delete(0);
    }

    if (opts.projectPrivate) this.privateProject();
    this.usersOnboardingAnonymous(!!opts.anonAllowed);
    this.usersOnboardingBrowserPush(!!opts.webPushAllowed);
    this.usersOnboardingEmail(!!opts.emailAllowed, undefined, opts.emailDomainAllowed ? [opts.emailDomainAllowed] : undefined);
    this.usersOnboardingSso(!!opts.ssoAllowed);
  }

  styleWhite() {
    this._get<ConfigEditor.StringProperty>(['style', 'palette', 'background']).set('#ffffff');
    this._get<ConfigEditor.BooleanProperty>(['style', 'palette', 'darkMode']).set(false);
  }

  styleDark() {
    this._get<ConfigEditor.StringProperty>(['style', 'palette', 'background']).set(undefined);
    this._get<ConfigEditor.BooleanProperty>(['style', 'palette', 'darkMode']).set(true);
  }

  setFontFamily(fontFamily: string) {
    this._get<ConfigEditor.StringProperty>(['style', 'typography', 'fontFamily']).set(fontFamily);
  }

  setFontSize(fontSize: number) {
    this._get<ConfigEditor.NumberProperty>(['style', 'typography', 'fontSize']).set(fontSize);
  }

  setAppName(appName: string, logoUrl: string) {
    this._get<ConfigEditor.StringProperty>(['name']).set(appName);
    this._get<ConfigEditor.StringProperty>(['logoUrl']).set(logoUrl);
  }

  demoPrioritization(type: 'none' | 'fund' | 'vote' | 'express' | 'expressRange' | 'all' | 'voteAndExpress') {
    this.styleWhite();

    const categoryIndex = this.demoCategory();

    switch (type) {
      case 'fund':
        this.supportFunding(categoryIndex);
        this.creditsCurrencyWithoutCents();
        break;
      case 'vote':
        this.supportVoting(categoryIndex, false);
        break;
      case 'express':
        this.supportExpressingAllEmojis(categoryIndex, true);
        break;
      case 'voteAndExpress':
        this.supportExpressingAllEmojis(categoryIndex, true);
        this.supportVoting(categoryIndex, true);
        break;
      case 'all':
        this.supportFunding(categoryIndex);
        this.creditsCurrencyWithoutCents();
        this.supportVoting(categoryIndex, true);
        this.supportExpressingAllEmojis(categoryIndex, true);
        break;
      case 'none':
      default:
        break;
    }

    this.demoPage({
      panels: [
        Admin.PagePanelWithHideIfEmptyToJSON({
          display: Admin.PostDisplayToJSON({
            titleTruncateLines: 1,
            descriptionTruncateLines: 3,
            showCommentCount: false,
            showCategoryName: false,
            showCreated: false,
            showAuthor: false,
            showStatus: false,
            showTags: false,
            showVoting: false,
            showVotingCount: true,
            showFunding: true,
            showExpression: true,
          }),
          search: Admin.IdeaSearchToJSON({
            limit: 1,
            sortBy: Admin.IdeaSearchSortByEnum.New,
          }),
          hideIfEmpty: false
        }),
      ],
    });
  }

  demoExplorer(
    explorer?: Partial<Admin.PageExplorer>,
    extraPageProps?: Partial<Admin.Page>,
    suppressDefaultCategory?: boolean,
    explorerPostDisplay?: Admin.PostDisplay,
    explorerIdeaSearch?: Admin.IdeaSearch,
  ) {
    this.styleWhite();

    !suppressDefaultCategory && this.demoCategory();

    this.demoPage({
      explorer: Admin.PageExplorerToJSON({
        search: explorerIdeaSearch || Admin.IdeaSearchToJSON({}),
        display: explorerPostDisplay || Admin.PostDisplayToJSON({
          titleTruncateLines: 1,
          descriptionTruncateLines: 0,
          responseTruncateLines: 0,
          showCommentCount: false,
          showCategoryName: false,
          showCreated: false,
          showAuthor: false,
          showStatus: false,
          showTags: false,
          showVoting: false,
          showVotingCount: false,
          showFunding: false,
          showExpression: false,
        }),
        allowCreate: undefined,
        ...(explorer || {}),
      }),
      ...(extraPageProps || {}),
    });
  }

  demoBoardPreset(preset: 'development' | 'funding' | 'design' | 'ideas') {
    switch (preset) {
      case 'development':
        this.demoBoard('Roadmap', [
          { title: 'Planned' },
          { title: 'In Progress' },
          { title: 'Completed' },
        ]);
        break;
      case 'funding':
        this.demoBoard('Feature crowd-funding', [
          // { title: 'Gathering interest' },
          { title: 'Raising funds', display: { showFunding: true } },
          { title: 'Successfully funded', display: { showFunding: true }, status: { disableFunding: true } },
        ]);
        break;
      case 'design':
        this.demoBoard('Design process', [
          { title: 'Ideas', hideIfEmpty: true, },
          { title: 'Concept' },
          { title: 'Approved', display: { showExpression: true } },
        ]);
        break;
      case 'ideas':
        this.demoBoard('Ideas', [
          { title: 'Considering' },
          { title: 'Planned' },
        ]);
        break;
    }
  }

  demoBoard(title: string | undefined, panels: Array<{
    title?: string;
    status?: Partial<Admin.IdeaStatus>;
    display?: Partial<Admin.PostDisplay>;
    hideIfEmpty?: boolean;
  }>) {
    this.styleWhite();
    this.creditsCurrency();

    const categoryIndex = this.demoCategory(panels.map((panel, index) => Admin.IdeaStatusToJSON({
      statusId: index + '',
      name: index + '',
      disableFunding: false,
      disableVoting: false,
      disableExpressions: false,
      disableIdeaEdits: false,
      disableComments: false,
      ...panel.status,
    })));
    this.supportExpressingAllEmojis(categoryIndex);
    this.supportFunding(categoryIndex);
    this.supportVoting(categoryIndex);

    this.demoPage({
      board: Admin.PageBoardToJSON({
        title,
        panels: panels.map((panel, index) => Admin.PagePanelWithHideIfEmptyToJSON({
          title: panel.title,
          search: Admin.IdeaSearchToJSON({ filterStatusIds: [panel.status?.statusId || (index + '')] }),
          display: Admin.PostDisplayToJSON({
            titleTruncateLines: 1,
            descriptionTruncateLines: 0,
            showCommentCount: false,
            showCategoryName: false,
            showCreated: false,
            showAuthor: false,
            showStatus: false,
            showTags: false,
            showVoting: false,
            showVotingCount: false,
            showFunding: false,
            showExpression: false,
            ...panel.display,
          }),
          hideIfEmpty: panel.hideIfEmpty || false,
        })),
      }),
    });
  }

  demoCategory(statuses?: Array<Admin.IdeaStatus>) {
    const categoryId = 'demoCategoryId';
    const categories = this._get<ConfigEditor.PageGroup>(['content', 'categories']);
    var categoryIndex = categories.getChildPages().findIndex(category => category.getChildren().props.find(prop => prop.path[prop.path.length - 1] === 'categoryId')?.value === categoryId);
    var demoCategory;
    if (categoryIndex >= 0) {
      demoCategory = categories.getChildPages()[categoryIndex];
    } else {
      demoCategory = categories.insert();
      categoryIndex = categories.getChildPages().length - 1;
    }
    demoCategory.setRaw(Admin.CategoryToJSON({
      categoryId: categoryId,
      name: 'Idea',
      userCreatable: true,
      workflow: Admin.WorkflowToJSON({ statuses: statuses || [] }),
      support: Admin.SupportToJSON({ comment: true, fund: false }),
      tagging: Admin.TaggingToJSON({ tags: [], tagGroups: [] }),
    }));
    return categoryIndex;
  }

  demoPage(pageProps: Partial<Admin.Page>) {
    const pageId = 'demoPageId';
    const pages = this._get<ConfigEditor.PageGroup>(['layout', 'pages']);
    const demoPage = pages.getChildPages().find(page => page.getChildren().props.find(prop => prop.path[prop.path.length - 1] === 'pageId')?.value === pageId) || pages.insert();
    demoPage.setRaw(Admin.PageToJSON({
      pageId: pageId,
      name: 'Demo',
      slug: stringToSlug('demo'),
      panels: [],
      ...pageProps,
    }));
  }

  templateFeedback(withFunding: boolean = false, withStandaloneFunding: boolean = true, withRoadmap: boolean = true, tagging?: {
    groupName: string;
    tagOptions: Array<{
      tagName: string;
      pageName: string;
      pageTitle?: string;
      pageDescription?: string;
    }>;
    separatePage?: boolean;
  }) {
    // Ideas
    const categories = this._get<ConfigEditor.PageGroup>(['content', 'categories']);
    const postCategoryId = randomUuid();
    categories.insert().setRaw(Admin.CategoryToJSON({
      categoryId: postCategoryId, name: 'Post',
      userCreatable: true,
      workflow: Admin.WorkflowToJSON({ statuses: [] }),
      support: Admin.SupportToJSON({ comment: true, fund: false }),
      tagging: Admin.TaggingToJSON({ tags: [], tagGroups: [] }),
    }));
    const postCategoryIndex = categories.getChildPages().length - 1;
    const postStatuses = this.workflowFeatures(postCategoryIndex, withFunding, withStandaloneFunding);

    const tagNameToId: { [tagName: string]: string } = {};
    if (tagging) {
      this.tagging(postCategoryIndex,
        tagging.tagOptions.map(tagOption => {
          const tagId = randomUuid();
          tagNameToId[tagOption.tagName] = tagId;
          return Admin.TagToJSON({ tagId, name: tagOption.tagName });
        }),
        Admin.TagGroupToJSON({
          tagGroupId: randomUuid(), name: tagging.groupName, userSettable: true, maxRequired: 1, tagIds: [],
        }));
    }

    const pagesProp = this._get<ConfigEditor.PageGroup>(['layout', 'pages']);
    const menuProp = this._get<ConfigEditor.ArrayProperty>(['layout', 'menu']);

    if (withRoadmap) {
      // Roadmap page
      const roadmapPageId = randomUuid();
      const postDisplay: Admin.PostDisplay = {
        titleTruncateLines: 1,
        descriptionTruncateLines: 0,
        responseTruncateLines: 0,
        showCommentCount: false,
        showCategoryName: false,
        showCreated: false,
        showAuthor: false,
        showStatus: false,
        showTags: false,
        showVoting: false,
        showFunding: false,
        showExpression: false,
      };
      pagesProp.insert().setRaw(Admin.PageToJSON({
        pageId: roadmapPageId,
        name: 'Roadmap',
        slug: 'roadmap',
        title: 'Our plan for the future',
        panels: [
          ...(withFunding && withStandaloneFunding ? [
            Admin.PagePanelWithHideIfEmptyToJSON({
              title: 'Funding', hideIfEmpty: true, display: Admin.PostDisplayToJSON({
                ...postDisplay,
                showFunding: true,
              }), search: Admin.IdeaSearchToJSON({
                sortBy: Admin.IdeaSearchSortByEnum.New,
                filterCategoryIds: [postCategoryId],
                filterStatusIds: postStatuses.filter(s => s.name.match(/Funding/)).map(s => s.statusId),
              })
            }),
          ] : []),
        ],
        board: Admin.PageBoardToJSON({
          title: 'Roadmap',
          panels: [
            Admin.PagePanelWithHideIfEmptyToJSON({
              title: 'Planned', hideIfEmpty: false, display: Admin.PostDisplayToJSON(postDisplay), search: Admin.IdeaSearchToJSON({
                sortBy: Admin.IdeaSearchSortByEnum.New,
                filterCategoryIds: [postCategoryId],
                filterStatusIds: postStatuses.filter(s => s.name.match(/Planned/)).map(s => s.statusId),
              })
            }),
            Admin.PagePanelWithHideIfEmptyToJSON({
              title: 'In progress', hideIfEmpty: false, display: Admin.PostDisplayToJSON(postDisplay), search: Admin.IdeaSearchToJSON({
                sortBy: Admin.IdeaSearchSortByEnum.New,
                filterCategoryIds: [postCategoryId],
                filterStatusIds: [
                  ...postStatuses.filter(s => s.name.match(/In progress/)).map(s => s.statusId),
                ],
              })
            }),
            Admin.PagePanelWithHideIfEmptyToJSON({
              title: 'Completed', hideIfEmpty: false, display: Admin.PostDisplayToJSON(postDisplay), search: Admin.IdeaSearchToJSON({
                sortBy: Admin.IdeaSearchSortByEnum.New,
                filterCategoryIds: [postCategoryId],
                filterStatusIds: [
                  ...postStatuses.filter(s => s.name.match(/Completed/)).map(s => s.statusId),
                ],
              })
            }),
          ],
        }),
        explorer: undefined,
      }));
      (menuProp.insert() as ConfigEditor.ObjectProperty).setRaw(Admin.MenuToJSON({
        menuId: randomUuid(), pageIds: [roadmapPageId],
      }));
    }

    // Post page(s)
    const postPageIds: string[] = [];
    for (const tagOption of (tagging?.separatePage && tagging?.tagOptions || [undefined])) {
      const postPageId = randomUuid();
      postPageIds.push(postPageId);
      const name = tagOption?.pageName || tagOption?.tagName || 'Feedback';
      const slug = name.toLowerCase();
      const title = tagOption?.pageTitle || 'Give us feedback';
      const description = tagOption?.pageDescription || textToHtml('We want to hear your ideas to improve our product.');
      const filterTagIds = tagOption ? [tagNameToId[tagOption.tagName]] : undefined;
      pagesProp.insert().setRaw(Admin.PageToJSON({
        pageId: postPageId,
        name,
        slug,
        title,
        description,
        panels: [],
        board: undefined,
        explorer: Admin.PageExplorerToJSON({
          allowSearch: Admin.PageExplorerAllOfAllowSearchToJSON({ enableSort: true, enableSearchText: true, enableSearchByCategory: true, enableSearchByStatus: true, enableSearchByTag: true }),
          allowCreate: { actionTitle: 'Suggest', actionTitleLong: 'Suggest an idea' },
          display: Admin.PostDisplayToJSON({}),
          search: Admin.IdeaSearchToJSON({
            sortBy: Admin.IdeaSearchSortByEnum.Trending,
            filterCategoryIds: [postCategoryId],
            filterTagIds,
          }),
        }),
      }));
    }
    (menuProp.insert() as ConfigEditor.ObjectProperty).setRaw(Admin.MenuToJSON({
      menuId: randomUuid(), pageIds: postPageIds, name: postPageIds.length > 1 ? 'Feedback' : undefined,
    }));
  }

  templateBlog(suppressHomePage: boolean = false) {
    // Category
    const categories = this._get<ConfigEditor.PageGroup>(['content', 'categories']);
    const articleCategoryId = randomUuid();
    categories.insert().setRaw(Admin.CategoryToJSON({
      categoryId: articleCategoryId, name: 'Article',
      userCreatable: false,
      workflow: Admin.WorkflowToJSON({ statuses: [] }),
      support: Admin.SupportToJSON({ comment: false, fund: false }),
      tagging: Admin.TaggingToJSON({ tags: [], tagGroups: [] }),
    }));
    const articleCategoryIndex = categories.getChildPages().length - 1;
    this.supportExpressingAllEmojis(articleCategoryIndex);

    // Home page panel
    if (!suppressHomePage) {
      this._get<ConfigEditor.PageGroup>(['layout', 'pages', 0, 'panels'])
        .insert().setRaw(Admin.PagePanelWithHideIfEmptyToJSON({
          title: 'Blog', hideIfEmpty: true, display: Admin.PostDisplayToJSON({
            titleTruncateLines: 1,
            descriptionTruncateLines: 2,
            responseTruncateLines: 0,
            showCommentCount: false,
            showCategoryName: false,
            showCreated: false,
            showAuthor: false,
            showStatus: false,
            showTags: false,
            showVoting: false,
            showVotingCount: false,
            showFunding: false,
            showExpression: false,
          }), search: Admin.IdeaSearchToJSON({
            sortBy: Admin.IdeaSearchSortByEnum.New,
            filterCategoryIds: [articleCategoryId],
          })
        }));
    }

    // Pages and menu
    const pagesProp = this._get<ConfigEditor.PageGroup>(['layout', 'pages']);
    const menuProp = this._get<ConfigEditor.ArrayProperty>(['layout', 'menu']);
    const pageBlogId = randomUuid();
    pagesProp.insert().setRaw(Admin.PageToJSON({
      pageId: pageBlogId,
      name: 'Blog',
      slug: stringToSlug('blog'),
      description: undefined,
      panels: [],
      icon: 'MenuBook',
      board: undefined,
      explorer: Admin.PageExplorerToJSON({
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
          filterCategoryIds: [articleCategoryId],
        }),
      }),
    }));
    (menuProp.insert() as ConfigEditor.ObjectProperty).setRaw(Admin.MenuToJSON({
      menuId: randomUuid(), pageIds: [pageBlogId],
    }));
  }

  templateChangelog(suppressHomePage: boolean = false) {
    // Category
    const categories = this._get<ConfigEditor.PageGroup>(['content', 'categories']);
    const changelogCategoryId = randomUuid();
    categories.insert().setRaw(Admin.CategoryToJSON({
      categoryId: changelogCategoryId, name: 'Changelog',
      userCreatable: false,
      subscription: {
        hellobar: {
          title: 'Get notified',
          message: 'If you enjoy hearing about new features in our product',
          button: 'Follow us',
        }
      },
      workflow: Admin.WorkflowToJSON({ statuses: [] }),
      support: Admin.SupportToJSON({ comment: false, fund: false }),
      tagging: Admin.TaggingToJSON({ tags: [], tagGroups: [] }),
    }));
    const changelogCategoryIndex = categories.getChildPages().length - 1;
    this.supportExpressingAllEmojis(changelogCategoryIndex);

    // Pages and menu
    const pagesProp = this._get<ConfigEditor.PageGroup>(['layout', 'pages']);
    const menuProp = this._get<ConfigEditor.ArrayProperty>(['layout', 'menu']);
    const changelogPageId = randomUuid();
    pagesProp.insert().setRaw(Admin.PageToJSON({
      pageId: changelogPageId,
      name: 'Changelog',
      slug: stringToSlug('changelog'),
      title: 'Recently announced',
      description: 'Here you can find changes we have made to our product',
      panels: [],
      board: undefined,
      explorer: Admin.PageExplorerToJSON({
        allowCreate: undefined,
        display: Admin.PostDisplayToJSON({
          titleTruncateLines: 0,
          descriptionTruncateLines: 2,
        }),
        search: Admin.IdeaSearchToJSON({
          filterCategoryIds: [changelogCategoryId],
        }),
      }),
    }));
    (menuProp.insert() as ConfigEditor.ObjectProperty).setRaw(Admin.MenuToJSON({
      menuId: randomUuid(), pageIds: [changelogPageId],
    }));
  }

  templateKnowledgeBase() {
    // help articles
    const categories = this._get<ConfigEditor.PageGroup>(['content', 'categories']);
    const helpCategoryId = randomUuid();
    categories.insert().setRaw(Admin.CategoryToJSON({
      categoryId: helpCategoryId, name: 'Help',
      userCreatable: false,
      workflow: Admin.WorkflowToJSON({ statuses: [] }),
      support: Admin.SupportToJSON({ comment: false, fund: false }),
      tagging: Admin.TaggingToJSON({ tags: [], tagGroups: [] }),
    }));
    const helpCategoryIndex = categories.getChildPages().length - 1;
    const accountSetupTagId = randomUuid();
    const orderingShippingTagId = randomUuid();
    this.tagging(helpCategoryIndex,
      [Admin.TagToJSON({ tagId: accountSetupTagId, name: 'Account Setup' }),
      Admin.TagToJSON({ tagId: orderingShippingTagId, name: 'Ordering and Shipping' }),
      ],
      Admin.TagGroupToJSON({
        tagGroupId: randomUuid(), name: 'Categories', userSettable: false, tagIds: [],
      }));
    this.supportExpressingRange(helpCategoryIndex);

    const pagesProp = this._get<ConfigEditor.PageGroup>(['layout', 'pages']);
    const helpPageId = randomUuid();
    const postDisplay: Admin.PostDisplay = {
      titleTruncateLines: 0,
      descriptionTruncateLines: 2,
      responseTruncateLines: 0,
      showCommentCount: false,
      showCategoryName: false,
      showCreated: false,
      showAuthor: false,
      showStatus: false,
      showTags: false,
      showVoting: false,
      showVotingCount: false,
      showFunding: false,
      showExpression: false,
    };
    pagesProp.insert().setRaw(Admin.PageToJSON({
      pageId: helpPageId,
      name: 'Help',
      slug: 'help',
      title: 'Knowledge Base',
      panels: [Admin.PagePanelWithHideIfEmptyToJSON({
        title: 'Account Setup', hideIfEmpty: false, display: Admin.PostDisplayToJSON(postDisplay), search: Admin.IdeaSearchToJSON({
          sortBy: Admin.IdeaSearchSortByEnum.Top,
          filterCategoryIds: [helpCategoryId],
          filterTagIds: [accountSetupTagId],
        })
      }), Admin.PagePanelWithHideIfEmptyToJSON({
        title: 'Ordering and Shipping', hideIfEmpty: false, display: Admin.PostDisplayToJSON(postDisplay), search: Admin.IdeaSearchToJSON({
          sortBy: Admin.IdeaSearchSortByEnum.Top,
          filterCategoryIds: [helpCategoryId],
          filterTagIds: [orderingShippingTagId],
        })
      })],
      explorer: Admin.PageExplorerToJSON({
        allowSearch: Admin.PageExplorerAllOfAllowSearchToJSON({ enableSort: true, enableSearchText: true, enableSearchByCategory: false, enableSearchByStatus: true, enableSearchByTag: true }),
        allowCreate: undefined,
        display: Admin.PostDisplayToJSON(postDisplay),
        search: Admin.IdeaSearchToJSON({
          filterCategoryIds: [helpCategoryId],
        }),
      }),
    }));

    const menuProp = this._get<ConfigEditor.ArrayProperty>(['layout', 'menu']);
    (menuProp.insert() as ConfigEditor.ObjectProperty).setRaw(Admin.MenuToJSON({
      menuId: randomUuid(), pageIds: [helpPageId],
    }));
  }

  supportNone(categoryIndex: number) {
    this._get<ConfigEditor.ObjectProperty>(['content', 'categories', categoryIndex, 'support', 'fund']).set(undefined);
    this._get<ConfigEditor.ObjectProperty>(['content', 'categories', categoryIndex, 'support', 'vote']).set(undefined);
    this._get<ConfigEditor.ObjectProperty>(['content', 'categories', categoryIndex, 'support', 'express']).set(undefined);
  }
  supportFunding(categoryIndex: number) {
    this._get<ConfigEditor.BooleanProperty>(['content', 'categories', categoryIndex, 'support', 'fund']).set(true);
  }
  supportVoting(categoryIndex: number, enableDownvotes: boolean = false) {
    this._get<ConfigEditor.ObjectProperty>(['content', 'categories', categoryIndex, 'support', 'vote']).setRaw(Admin.VotingToJSON({
      enableDownvotes,
    }));
  }
  supportExpressingAllEmojis(categoryIndex: number, limitEmojiPerIdea?: boolean) {
    this._get<ConfigEditor.ObjectProperty>(['content', 'categories', categoryIndex, 'support', 'express']).set(true);
    if (limitEmojiPerIdea) this._get<ConfigEditor.BooleanProperty>(['content', 'categories', categoryIndex, 'support', 'express', 'limitEmojiPerIdea']).set(true);
  }
  supportExpressingFacebookStyle(categoryIndex: number, limitEmojiPerIdea?: boolean) {
    const expressProp = this._get<ConfigEditor.ObjectProperty>(['content', 'categories', categoryIndex, 'support', 'express']);
    if (expressProp.value !== true) expressProp.set(true);
    if (limitEmojiPerIdea) this._get<ConfigEditor.BooleanProperty>(['content', 'categories', categoryIndex, 'support', 'express', 'limitEmojiPerIdea']).set(true);
    this._get<ConfigEditor.ArrayProperty>(['content', 'categories', categoryIndex, 'support', 'express', 'limitEmojiSet']).setRaw([
      Admin.ExpressionToJSON({ display: '👍', text: 'Thumbs up', weight: 1 }),
      Admin.ExpressionToJSON({ display: '❤️', text: 'Heart', weight: 1 }),
      Admin.ExpressionToJSON({ display: '😆', text: 'Laugh', weight: 1 }),
      Admin.ExpressionToJSON({ display: '😮', text: 'Shocked', weight: 0 }),
      Admin.ExpressionToJSON({ display: '😥', text: 'Crying', weight: -1 }),
      Admin.ExpressionToJSON({ display: '😠', text: 'Angry', weight: -1 }),
    ]);
  }
  supportExpressingMessengerStyle(categoryIndex: number, limitEmojiPerIdea?: boolean) {
    const expressProp = this._get<ConfigEditor.ObjectProperty>(['content', 'categories', categoryIndex, 'support', 'express']);
    if (expressProp.value !== true) expressProp.set(true);
    if (limitEmojiPerIdea) this._get<ConfigEditor.BooleanProperty>(['content', 'categories', categoryIndex, 'support', 'express', 'limitEmojiPerIdea']).set(true);
    this._get<ConfigEditor.ArrayProperty>(['content', 'categories', categoryIndex, 'support', 'express', 'limitEmojiSet']).setRaw([
      Admin.ExpressionToJSON({ display: '😍', text: 'Love', weight: 1 }),
      Admin.ExpressionToJSON({ display: '😆', text: 'Laugh', weight: 1 }),
      Admin.ExpressionToJSON({ display: '😮', text: 'Shocked', weight: 0 }),
      Admin.ExpressionToJSON({ display: '😥', text: 'Crying', weight: -1 }),
      Admin.ExpressionToJSON({ display: '😠', text: 'Angry', weight: -1 }),
      Admin.ExpressionToJSON({ display: '👍', text: 'Thumbs up', weight: 1 }),
      Admin.ExpressionToJSON({ display: '👎', text: 'Thumbs down', weight: -1 }),
    ]);
  }
  supportExpressingGithubStyle(categoryIndex: number, limitEmojiPerIdea?: boolean) {
    const expressProp = this._get<ConfigEditor.ObjectProperty>(['content', 'categories', categoryIndex, 'support', 'express']);
    if (expressProp.value !== true) expressProp.set(true);
    if (limitEmojiPerIdea) this._get<ConfigEditor.BooleanProperty>(['content', 'categories', categoryIndex, 'support', 'express', 'limitEmojiPerIdea']).set(true);
    this._get<ConfigEditor.ArrayProperty>(['content', 'categories', categoryIndex, 'support', 'express', 'limitEmojiSet']).setRaw([
      Admin.ExpressionToJSON({ display: '👍', text: '+1', weight: 1 }),
      Admin.ExpressionToJSON({ display: '👎', text: '-1', weight: -1 }),
      Admin.ExpressionToJSON({ display: '😆', text: 'Laugh', weight: 1 }),
      Admin.ExpressionToJSON({ display: '🎉', text: 'Hooray', weight: 1 }),
      Admin.ExpressionToJSON({ display: '😕', text: 'Confused', weight: -1 }),
      Admin.ExpressionToJSON({ display: '❤️', text: 'Heart', weight: 1 }),
      Admin.ExpressionToJSON({ display: '🚀', text: 'Rocket', weight: 1 }),
      Admin.ExpressionToJSON({ display: '👀', text: 'Eyes', weight: 1 }),
    ]);
  }
  supportExpressingRange(categoryIndex: number) {
    const expressProp = this._get<ConfigEditor.ObjectProperty>(['content', 'categories', categoryIndex, 'support', 'express']);
    if (expressProp.value !== true) expressProp.set(true);
    this._get<ConfigEditor.BooleanProperty>(['content', 'categories', categoryIndex, 'support', 'express', 'limitEmojiPerIdea']).set(true);
    this._get<ConfigEditor.ArrayProperty>(['content', 'categories', categoryIndex, 'support', 'express', 'limitEmojiSet']).setRaw([
      Admin.ExpressionToJSON({ display: '😃', text: 'Smiley', weight: 1 }),
      Admin.ExpressionToJSON({ display: '😐', text: 'Neutral', weight: -1 }),
      Admin.ExpressionToJSON({ display: '😞', text: 'Disappointed', weight: -2 }),
    ]);
  }
  supportExpressingLimitEmojiPerIdea(categoryIndex: number, limitEmojiPerIdea?: boolean) {
    const expressProp = this._get<ConfigEditor.ObjectProperty>(['content', 'categories', categoryIndex, 'support', 'express']);
    if (expressProp.value !== true) expressProp.set(true);
    this._get<ConfigEditor.BooleanProperty>(['content', 'categories', categoryIndex, 'support', 'express', 'limitEmojiPerIdea']).set(!!limitEmojiPerIdea);
  }

  taggingIdeaBug(categoryIndex: number) {
    this.tagging(categoryIndex,
      [Admin.TagToJSON({ tagId: randomUuid(), name: 'Idea' }),
      Admin.TagToJSON({ tagId: randomUuid(), name: 'Bug' })],
      Admin.TagGroupToJSON({
        tagGroupId: randomUuid(), name: 'Type', userSettable: true, maxRequired: 1, tagIds: [],
      }));
  }
  taggingOsPlatform(categoryIndex: number) {
    this.tagging(categoryIndex,
      [Admin.TagToJSON({ tagId: randomUuid(), name: 'Windows' }),
      Admin.TagToJSON({ tagId: randomUuid(), name: 'Mac' }),
      Admin.TagToJSON({ tagId: randomUuid(), name: 'Linux' })],
      Admin.TagGroupToJSON({
        tagGroupId: randomUuid(), name: 'Platform', userSettable: true, tagIds: [],
      }));
  }
  tagging(categoryIndex: number, tags: Admin.Tag[], tagGroup?: Admin.TagGroup) {
    const tagsProp = this._get<ConfigEditor.ArrayProperty>(['content', 'categories', categoryIndex, 'tagging', 'tags']);
    tags.forEach(tag => (tagsProp.insert() as ConfigEditor.ObjectProperty).setRaw(tag))
    if (tagGroup) {
      this._get<ConfigEditor.PageGroup>(['content', 'categories', categoryIndex, 'tagging', 'tagGroups']).insert().setRaw(Admin.TagGroupToJSON({
        ...tagGroup, tagIds: tags.map(tag => tag.tagId),
      }));
    }
  }

  readonly workflowColorNeutral = 'rgb(59, 103, 174)';
  readonly workflowColorNeutraler = 'rgb(52, 90, 152)';
  readonly workflowColorNeutralest = 'rgb(39, 68, 114)';
  readonly workflowColorProgress = '#AE9031';
  readonly workflowColorComplete = '#3A8E31';
  readonly workflowColorFail = '#B44A4B';
  readonly workflowColorNew = 'rgb(51, 51, 51)';
  workflowFeatures(categoryIndex: number, withFunding: boolean = true, withStandaloneFunding: boolean = true): Admin.IdeaStatus[] {
    const closed = Admin.IdeaStatusToJSON({ name: 'Closed', nextStatusIds: [], color: this.workflowColorFail, statusId: randomUuid(), disableFunding: true, disableExpressions: false, disableVoting: false, disableComments: false, disableIdeaEdits: false });
    const completed = Admin.IdeaStatusToJSON({ name: 'Completed', nextStatusIds: [], color: this.workflowColorComplete, statusId: randomUuid(), disableFunding: true, disableExpressions: false, disableVoting: false, disableComments: false, disableIdeaEdits: true });
    const inProgress = Admin.IdeaStatusToJSON({ name: 'In progress', nextStatusIds: [closed.statusId, completed.statusId], color: this.workflowColorProgress, statusId: randomUuid(), disableFunding: true, disableExpressions: false, disableVoting: false, disableComments: false, disableIdeaEdits: true });
    const planned = Admin.IdeaStatusToJSON({ name: 'Planned', nextStatusIds: [closed.statusId, inProgress.statusId], color: this.workflowColorNeutral, statusId: randomUuid(), disableFunding: withFunding && !withStandaloneFunding, disableExpressions: false, disableVoting: false, disableComments: false, disableIdeaEdits: true });
    var funding;
    if (withFunding && withStandaloneFunding) {
      funding = Admin.IdeaStatusToJSON({ name: 'Funding', nextStatusIds: [closed.statusId, planned.statusId], color: this.workflowColorNeutral, statusId: randomUuid(), disableFunding: false, disableExpressions: false, disableVoting: false, disableComments: false, disableIdeaEdits: true });
    }
    const underReview = Admin.IdeaStatusToJSON({ name: 'Under review', nextStatusIds: [...((withFunding && withStandaloneFunding) ? [funding.statusId] : []), closed.statusId, planned.statusId], color: this.workflowColorNeutral, statusId: randomUuid(), disableFunding: withFunding && !withStandaloneFunding, disableExpressions: false, disableVoting: false, disableComments: false, disableIdeaEdits: false });
    return this.workflow(categoryIndex, underReview.statusId, [closed, completed, inProgress, planned, underReview, ...((withFunding && withStandaloneFunding) ? [funding] : [])]);
  }
  workflowIdea(categoryIndex: number): Admin.IdeaStatus[] {
    const discarded = Admin.IdeaStatusToJSON({ name: 'Discarded', nextStatusIds: [], color: this.workflowColorFail, statusId: randomUuid(), disableFunding: true, disableExpressions: false, disableVoting: false, disableComments: false, disableIdeaEdits: false });
    const completed = Admin.IdeaStatusToJSON({ name: 'Completed', nextStatusIds: [], color: this.workflowColorComplete, statusId: randomUuid(), disableFunding: true, disableExpressions: false, disableVoting: false, disableComments: false, disableIdeaEdits: true });
    const inProgress = Admin.IdeaStatusToJSON({ name: 'In progress', nextStatusIds: [discarded.statusId, completed.statusId], color: this.workflowColorProgress, statusId: randomUuid(), disableFunding: true, disableExpressions: false, disableVoting: false, disableComments: false, disableIdeaEdits: true });
    const underReview = Admin.IdeaStatusToJSON({ name: 'Under review', nextStatusIds: [discarded.statusId, inProgress.statusId], color: this.workflowColorNeutral, statusId: randomUuid(), disableFunding: true, disableExpressions: false, disableVoting: false, disableComments: false, disableIdeaEdits: true });
    const newNew = Admin.IdeaStatusToJSON({ name: 'New', nextStatusIds: [discarded.statusId, underReview.statusId], color: this.workflowColorNeutral, statusId: randomUuid(), disableFunding: true, disableExpressions: false, disableVoting: false, disableComments: false, disableIdeaEdits: false });
    return this.workflow(categoryIndex, newNew.statusId, [discarded, completed, inProgress, underReview, newNew]);
  }
  workflowBug(categoryIndex: number): Admin.IdeaStatus[] {
    const notReproducible = Admin.IdeaStatusToJSON({ name: 'Not reproducible', nextStatusIds: [], color: this.workflowColorFail, statusId: randomUuid(), disableFunding: true, disableExpressions: false, disableVoting: false, disableComments: false, disableIdeaEdits: false });
    const wontFix = Admin.IdeaStatusToJSON({ name: 'Won\'t fix', nextStatusIds: [], color: this.workflowColorFail, statusId: randomUuid(), disableFunding: true, disableExpressions: false, disableVoting: false, disableComments: false, disableIdeaEdits: false });
    const fixed = Admin.IdeaStatusToJSON({ name: 'Fixed', nextStatusIds: [], color: this.workflowColorComplete, statusId: randomUuid(), disableFunding: true, disableExpressions: false, disableVoting: false, disableComments: false, disableIdeaEdits: true });
    const inProgress = Admin.IdeaStatusToJSON({ name: 'In progress', nextStatusIds: [wontFix.statusId, notReproducible.statusId, fixed.statusId], color: this.workflowColorProgress, statusId: randomUuid(), disableFunding: true, disableExpressions: false, disableVoting: false, disableComments: false, disableIdeaEdits: true });
    const underReview = Admin.IdeaStatusToJSON({ name: 'Under review', nextStatusIds: [inProgress.statusId, wontFix.statusId, notReproducible.statusId], color: this.workflowColorNeutral, statusId: randomUuid(), disableFunding: false, disableExpressions: false, disableVoting: false, disableComments: false, disableIdeaEdits: false });
    return this.workflow(categoryIndex, underReview.statusId, [notReproducible, wontFix, fixed, inProgress, underReview]);
  }
  workflow(categoryIndex: number, entryStatusId: string | undefined = undefined, statuses: Admin.IdeaStatus[] = []): Admin.IdeaStatus[] {
    this._get<ConfigEditor.LinkProperty>(['content', 'categories', categoryIndex, 'workflow', 'entryStatus']).set(undefined);
    this._get<ConfigEditor.PageGroup>(['content', 'categories', categoryIndex, 'workflow', 'statuses']).setRaw(statuses);
    this._get<ConfigEditor.LinkProperty>(['content', 'categories', categoryIndex, 'workflow', 'entryStatus']).set(entryStatusId);
    return statuses;
  }

  creditsCurrencyWithoutCents() {
    this._get<ConfigEditor.PageGroup>(['users', 'credits']).set(true);
    this._get<ConfigEditor.ArrayProperty>(['users', 'credits', 'formats']).setRaw([
      Admin.CreditFormatterEntryToJSON({ prefix: '$', greaterOrEqual: 10000, maximumFractionDigits: 2 }),
      Admin.CreditFormatterEntryToJSON({ prefix: '$', greaterOrEqual: 100, minimumFractionDigits: 2 }),
      Admin.CreditFormatterEntryToJSON({ prefix: '$' }),
    ]);
  }
  creditsCurrency(creditOnSignup?: number) {
    this._get<ConfigEditor.PageGroup>(['users', 'credits']).set(true);
    if (creditOnSignup) {
      this._get<ConfigEditor.ObjectProperty>(['users', 'credits', 'creditOnSignup']).setRaw(
        Admin.CreditsCreditOnSignupToJSON({ amount: creditOnSignup }));
    }
    this._get<ConfigEditor.ArrayProperty>(['users', 'credits', 'formats']).setRaw(Templater.creditsCurrencyFormat());
  }
  static creditsCurrencyFormat(): Admin.CreditFormatterEntry[] {
    return [
      Admin.CreditFormatterEntryToJSON({ prefix: '$', multiplier: 0.01, greaterOrEqual: 10000, maximumFractionDigits: 2 }),
      Admin.CreditFormatterEntryToJSON({ prefix: '$', multiplier: 0.01, greaterOrEqual: 100, minimumFractionDigits: 2 }),
      Admin.CreditFormatterEntryToJSON({ prefix: '$', lessOrEqual: 0 }),
      Admin.CreditFormatterEntryToJSON({ prefix: '¢' }),
    ];
  }
  creditsTime() {
    this._get<ConfigEditor.PageGroup>(['users', 'credits']).set(true);
    this._get<ConfigEditor.ArrayProperty>(['users', 'credits', 'formats']).setRaw([
      Admin.CreditFormatterEntryToJSON({ suffix: ' weeks', multiplier: 0.025, greaterOrEqual: 41, maximumFractionDigits: 1 }),
      Admin.CreditFormatterEntryToJSON({ suffix: ' week', multiplier: 0.025, greaterOrEqual: 40, lessOrEqual: 40 }),
      Admin.CreditFormatterEntryToJSON({ suffix: ' days', multiplier: 0.125, greaterOrEqual: 9, lessOrEqual: 39, maximumFractionDigits: 1 }),
      Admin.CreditFormatterEntryToJSON({ suffix: ' day', multiplier: 0.125, greaterOrEqual: 8, lessOrEqual: 8 }),
      Admin.CreditFormatterEntryToJSON({ suffix: ' hrs', greaterOrEqual: 2 }),
      Admin.CreditFormatterEntryToJSON({ suffix: ' hr', lessOrEqual: 1 }),
    ]);
  }
  creditsUnitless() {
    this._get<ConfigEditor.PageGroup>(['users', 'credits']).set(true);
    this._get<ConfigEditor.ArrayProperty>(['users', 'credits', 'formats']).setRaw([
      Admin.CreditFormatterEntryToJSON({ suffix: 'm', multiplier: 0.000001, greaterOrEqual: 100000000, maximumFractionDigits: 0 }),
      Admin.CreditFormatterEntryToJSON({ suffix: 'm', multiplier: 0.000001, greaterOrEqual: 10000000, maximumFractionDigits: 1 }),
      Admin.CreditFormatterEntryToJSON({ suffix: 'm', multiplier: 0.000001, greaterOrEqual: 1000000, maximumFractionDigits: 2 }),
      Admin.CreditFormatterEntryToJSON({ suffix: 'k', multiplier: 0.001, greaterOrEqual: 100000, maximumFractionDigits: 0 }),
      Admin.CreditFormatterEntryToJSON({ suffix: 'k', multiplier: 0.001, greaterOrEqual: 10000, maximumFractionDigits: 1 }),
      Admin.CreditFormatterEntryToJSON({ suffix: 'k', multiplier: 0.001, greaterOrEqual: 1000, maximumFractionDigits: 2 }),
    ]);
  }
  /**
   * TODO Create scale instead of credits. Possibly negative credits too?
   * Requirements:
   * - Display # of people funded and average instead of total
   * - Max funding per item
   * - Balance and transaction history??
   * - Goal??
   */
  // creditsScale() {
  //   this._get<ConfigEditor.PageGroup>(['users', 'credits']).set(true);
  //   this._get<ConfigEditor.NumberProperty>(['users', 'credits', 'increment']).set(0.01);
  //   this._get<ConfigEditor.ArrayProperty>(['users', 'credits', 'formats']).setRaw([
  //     Admin.CreditFormatterEntryToJSON({suffix: 'Critical', multiplier: 100, greaterOrEqual: 0.9}),
  //     Admin.CreditFormatterEntryToJSON({suffix: 'High', multiplier: 100, greaterOrEqual: 10000000}),
  //     Admin.CreditFormatterEntryToJSON({suffix: 'Medium', multiplier: 100, greaterOrEqual: 0.2}),
  //     Admin.CreditFormatterEntryToJSON({suffix: 'Low', multiplier: 100, lessOrEqual: 0.1}),
  //   ]);
  // }
  creditsEmoji(emoji: string) {
    this._get<ConfigEditor.PageGroup>(['users', 'credits']).set(true);
    this._get<ConfigEditor.ArrayProperty>(['users', 'credits', 'formats']).setRaw([
      Admin.CreditFormatterEntryToJSON({ suffix: 'm ' + emoji, multiplier: 0.000001, greaterOrEqual: 100000000, maximumFractionDigits: 0 }),
      Admin.CreditFormatterEntryToJSON({ suffix: 'm ' + emoji, multiplier: 0.000001, greaterOrEqual: 10000000, maximumFractionDigits: 1 }),
      Admin.CreditFormatterEntryToJSON({ suffix: 'm ' + emoji, multiplier: 0.000001, greaterOrEqual: 1000000, maximumFractionDigits: 2 }),
      Admin.CreditFormatterEntryToJSON({ suffix: 'k ' + emoji, multiplier: 0.001, greaterOrEqual: 100000, maximumFractionDigits: 0 }),
      Admin.CreditFormatterEntryToJSON({ suffix: 'k ' + emoji, multiplier: 0.001, greaterOrEqual: 10000, maximumFractionDigits: 1 }),
      Admin.CreditFormatterEntryToJSON({ suffix: 'k ' + emoji, multiplier: 0.001, greaterOrEqual: 1000, maximumFractionDigits: 2 }),
      Admin.CreditFormatterEntryToJSON({ suffix: ' ' + emoji, lessOrEqual: 999 }),
    ]);
  }

  privateProject() {
    this._get<ConfigEditor.EnumProperty>(['users', 'onboarding', 'visibility']).set('Private');
  }

  usersOnboardingEmail(enable: boolean, passwordRequirement?: Admin.EmailSignupPasswordEnum, allowedDomains?: string[]) {
    this._get<ConfigEditor.ObjectProperty>(['users', 'onboarding', 'notificationMethods', 'email']).set(enable ? true : undefined);
    if (enable) {
      if (passwordRequirement !== undefined) this._get<ConfigEditor.StringProperty>(['users', 'onboarding', 'notificationMethods', 'email', 'password']).set(passwordRequirement);
      if (allowedDomains !== undefined) this._get<ConfigEditor.ArrayProperty>(['users', 'onboarding', 'notificationMethods', 'email', 'allowedDomains']).setRaw(allowedDomains);
    }
  }

  usersOnboardingAnonymous(enable: boolean, onlyShowIfPushNotAvailable?: boolean) {
    this._get<ConfigEditor.ObjectProperty>(['users', 'onboarding', 'notificationMethods', 'anonymous']).set(enable ? true : undefined);
    if (enable) {
      if (onlyShowIfPushNotAvailable !== undefined) this._get<ConfigEditor.BooleanProperty>(['users', 'onboarding', 'notificationMethods', 'anonymous', 'onlyShowIfPushNotAvailable']).set(onlyShowIfPushNotAvailable);
    }
  }

  usersOnboardingSso(enable: boolean, secretKey?: string, redirectUrl?: string, buttonTitle?: string) {
    this._get<ConfigEditor.ObjectProperty>(['users', 'onboarding', 'notificationMethods', 'sso']).set(enable ? true : undefined);
    if (enable) {
      if (redirectUrl !== undefined) this._get<ConfigEditor.StringProperty>(['users', 'onboarding', 'notificationMethods', 'sso', 'redirectUrl']).set(redirectUrl);
      if (buttonTitle !== undefined) this._get<ConfigEditor.StringProperty>(['users', 'onboarding', 'notificationMethods', 'sso', 'buttonTitle']).set(buttonTitle);
      if (secretKey !== undefined) this._get<ConfigEditor.StringProperty>(['ssoSecretKey']).set(secretKey);
    }
  }

  usersOnboardingOAuthClear() {
    this._get<ConfigEditor.ArrayProperty>(['users', 'onboarding', 'notificationMethods', 'oauth']).setRaw([]);
  }

  usersOnboardingOAuthAdd(oauth: Partial<Admin.NotificationMethodsOauth>) {
    const index = this._get<ConfigEditor.ArrayProperty>(['users', 'onboarding', 'notificationMethods', 'oauth']).insert().path.slice(-1).pop() as number;
    Object.entries(oauth).forEach(([key, val]) => {
      this._get<ConfigEditor.StringProperty>(['users', 'onboarding', 'notificationMethods', 'oauth', index, key]).set(val || '');
    });
  }

  usersOnboardingOAuthAddBathtub() {
    this.usersOnboardingOAuthAdd({
      oauthId: randomUuid(),
      buttonTitle: 'Bathtub',
      icon: 'Bathtub',
      clientId: 'bathtub',
      authorizeUrl: `${windowIso.location.protocol}//${windowIso.location.host}/bathtub/authorize`,
      tokenUrl: 'blah',
      scope: 'name email',
      userProfileUrl: 'blah',
      guidJsonPath: 'blah',
      nameJsonPath: 'blah',
      emailJsonPath: 'blah',
    });
  }

  // usersOnboardingMobilePush(enable: boolean) {
  //   this._get<ConfigEditor.BooleanProperty>(['users', 'onboarding', 'notificationMethods', 'mobilePush']).set(enable);
  // }

  usersOnboardingBrowserPush(enable: boolean) {
    this._get<ConfigEditor.BooleanProperty>(['users', 'onboarding', 'notificationMethods', 'browserPush']).set(enable);
  }

  usersOnboardingDisplayName(requirement: Admin.AccountFieldsDisplayNameEnum) {
    this._get<ConfigEditor.StringProperty>(['users', 'onboarding', 'accountFields', 'displayName']).set(requirement);
  }

  liquidTemplateHeader(template: string) {
    this._get<ConfigEditor.ObjectProperty>(['style', 'templates']).set(true);
    this._get<ConfigEditor.StringProperty>(['style', 'templates', 'header']).set(template);
  }

  createPage(name: string): string {
    const pageId = randomUuid();
    const pagesProp = this._get<ConfigEditor.PageGroup>(['layout', 'pages']);
    pagesProp.insert().setRaw(Admin.PageToJSON({
      pageId: pageId,
      name: name,
      slug: stringToSlug(name),
      title: undefined,
      description: undefined,
      panels: [],
      board: undefined,
      explorer: undefined,
    }));
    return pageId;
  }

  createMenu(pageIds: string[], name?: string): string {
    const menuId = randomUuid();
    const menuProp = this._get<ConfigEditor.ArrayProperty>(['layout', 'menu']);
    (menuProp.insert() as ConfigEditor.ObjectProperty).setRaw(Admin.MenuToJSON({
      menuId, pageIds: [...pageIds], name,
    }));
    return menuId;
  }

  _get<T extends ConfigEditor.Setting<any, any>>(path: ConfigEditor.Path): T {
    return this.editor.get(path) as any as T;
  }
}
