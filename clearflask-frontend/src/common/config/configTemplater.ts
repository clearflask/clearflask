import * as Admin from "../../api/admin";
import stringToSlug from "../util/slugger";
import randomUuid from "../util/uuid";
import * as ConfigEditor from "./configEditor";

// TODO Home
// TODO FAQ
// TODO KNOWLEDGE BASE
// TODO BLOG
// TODO BUG BOUNTY
// TODO QUESTION AND ANSWER
// TODO FORUM
export interface CreateTemplateOptions {
  templateFeedback?: boolean;
  templateChangelog?: boolean;
  templateKnowledgeBase?: boolean;

  fundingAllowed: boolean;
  votingAllowed: boolean;
  expressionAllowed: boolean;
  fundingType: 'currency' | 'time' | 'beer';
  votingEnableDownvote?: boolean;
  expressionsLimitEmojis?: boolean;
  expressionsAllowMultiple?: boolean;

  infoWebsite?: string;
  infoName?: string;
  infoSlug?: string;
  infoLogo?: string;
}
export const createTemplateOptionsDefault: CreateTemplateOptions = {
  templateFeedback: true,
  fundingAllowed: true,
  votingAllowed: true,
  expressionAllowed: false,
  fundingType: 'currency',
};

export default class Templater {
  editor: ConfigEditor.Editor;

  constructor(editor: ConfigEditor.Editor) {
    this.editor = editor;
  }

  static get(editor: ConfigEditor.Editor): Templater {
    return new Templater(editor);
  }

  demo(opts: CreateTemplateOptions = createTemplateOptionsDefault) {
    this.createTemplate({
      infoName: 'Sandbox App',
      ...opts,
    });
    this._get<ConfigEditor.StringProperty>(['name']).set('Sandbox App');
    this.styleWhite();
  }

  createTemplate(opts: CreateTemplateOptions = createTemplateOptionsDefault) {
    if (!!opts.infoSlug) this._get<ConfigEditor.StringProperty>(['projectId']).set(opts.infoSlug);
    this._get<ConfigEditor.StringProperty>(['name']).set(opts.infoName || 'My App');
    if (!!opts.infoSlug) this._get<ConfigEditor.StringProperty>(['slug']).set(opts.infoSlug);
    if (!!opts.infoWebsite) this._get<ConfigEditor.StringProperty>(['website']).set(opts.infoWebsite);
    if (!!opts.infoLogo) this._get<ConfigEditor.StringProperty>(['logoUrl']).set(opts.infoLogo);
    this.templateBase();
    if (opts.templateFeedback) {
      this.templateFeedback(opts.fundingAllowed, opts.expressionAllowed || opts.votingAllowed);
      const ideaCategoryIndex = 0;
      if (opts.votingAllowed) {
        this.supportVoting(ideaCategoryIndex, opts.votingEnableDownvote);
      }
      if (opts.expressionAllowed) {
        if (opts.expressionsLimitEmojis) {
          this.supportExpressingFacebookStyle(ideaCategoryIndex, !opts.expressionsAllowMultiple);
        } else {
          this.supportExpressingAllEmojis(ideaCategoryIndex, !opts.expressionsAllowMultiple);
        }
        this.supportExpressingLimitEmojiPerIdea(ideaCategoryIndex, !opts.expressionsAllowMultiple);
      }
      if (opts.fundingAllowed) {
        this.supportFunding(ideaCategoryIndex);
        switch (opts.fundingType) {
          case 'currency':
            this.creditsCurrency();
            break;
          case 'time':
            this.creditsTime();
            break;
          case 'beer':
            this.creditsBeer();
            break;
        }
      }

      const bugCategoryIndex = 1;
      if (opts.votingAllowed) {
        this.supportVoting(bugCategoryIndex, opts.votingEnableDownvote);
      }
      if (opts.expressionAllowed) {
        if (opts.expressionsLimitEmojis) {
          this.supportExpressingFacebookStyle(bugCategoryIndex, !opts.expressionsAllowMultiple);
        } else {
          this.supportExpressingAllEmojis(bugCategoryIndex, !opts.expressionsAllowMultiple);
        }
        this.supportExpressingLimitEmojiPerIdea(bugCategoryIndex, !opts.expressionsAllowMultiple);
      }
      if (opts.fundingAllowed && !opts.votingAllowed && !opts.expressionAllowed) {
        this.supportFunding(bugCategoryIndex);
        switch (opts.fundingType) {
          case 'currency':
            this.creditsCurrency();
            break;
          case 'time':
            this.creditsTime();
            break;
          case 'beer':
            this.creditsBeer();
            break;
        }
      }
    }
    if (opts.templateChangelog) this.templateChangelog();
    // if (opts.templateBlog) this.templateBlog();
    if (opts.templateKnowledgeBase) this.templateKnowledgeBase();
  }

  styleWhite() {
    this._get<ConfigEditor.StringProperty>(['style', 'palette', 'background']).set('#FFF');
  }

  styleDark() {
    this._get<ConfigEditor.BooleanProperty>(['style', 'palette', 'darkMode']).set(true);
  }

  setFontFamily(fontFamily: string) {
    this._get<ConfigEditor.StringProperty>(['style', 'typography', 'fontFamily']).set(fontFamily);
  }

  setAppName(appName: string, logoUrl: string) {
    this._get<ConfigEditor.StringProperty>(['name']).set(appName);
    this._get<ConfigEditor.StringProperty>(['logoUrl']).set(logoUrl);
  }

  demoPrioritization(type: 'fund' | 'vote' | 'express' | 'all') {
    this.styleWhite();

    const categoryIndex = this.demoCategory();

    switch (type) {
      case 'fund':
        this.supportFunding(categoryIndex);
        this.creditsCurrencyWithoutCents();
        break;
      case 'vote':
        this.supportVoting(categoryIndex, true);
        break;
      case 'express':
        this.supportExpressingAllEmojis(categoryIndex, true);
        break;
      case 'all':
        this.supportFunding(categoryIndex);
        this.creditsCurrencyWithoutCents();
        this.supportVoting(categoryIndex, true);
        this.supportExpressingAllEmojis(categoryIndex, true);
        break;
    }

    this.demoPage({
      panels: [
        Admin.PagePanelWithHideIfEmptyToJSON({
          display: Admin.PostDisplayToJSON({
            titleTruncateLines: 1,
            descriptionTruncateLines: 3,
            showDescription: true,
            showCommentCount: false,
            showCategoryName: false,
            showCreated: false,
            showAuthor: false,
            showStatus: false,
            showTags: false,
            showVoting: true,
            showFunding: true,
            showExpression: true,
            disableExpand: true,
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

  demoExplorer(explorer?: Partial<Admin.PageExplorer>, extraPageProps?: Partial<Admin.Page>, suppressDefaultCategory?: boolean) {
    this.styleWhite();

    !suppressDefaultCategory && this.demoCategory();

    this.demoPage({
      explorer: Admin.PageExplorerToJSON({
        search: Admin.IdeaSearchToJSON({}),
        display: Admin.PostDisplayToJSON({
          titleTruncateLines: 1,
          descriptionTruncateLines: 2,
          showDescription: false,
          showResponse: false,
          showCommentCount: false,
          showCategoryName: false,
          showCreated: false,
          showAuthor: false,
          showStatus: false,
          showTags: false,
          showVoting: false,
          showFunding: false,
          showExpression: false,
          disableExpand: false,
        }),
        allowCreate: false,
        ...(explorer || {}),
      }),
      ...(extraPageProps || {}),
    });
  }

  demoBoardPreset(preset: 'development' | 'funding' | 'design') {
    switch (preset) {
      case 'development':
        this.demoBoard('Roadmap', [
          { title: 'Planned' },
          { title: 'In Progress' },
          { title: 'Completed' },
        ]);
        break;
      case 'funding':
        this.demoBoard('Crowd-funding', [
          { title: 'Gathering interest', display: { showVoting: true } },
          { title: 'Raising funds', display: { showFunding: true } },
          { title: 'Funded', display: { showFunding: true } },
        ]);
        break;
      case 'design':
        this.demoBoard('Design process', [
          { title: 'Ideas', display: { showExpression: true } },
          { title: 'Concept', display: { showExpression: true } },
          { title: 'Approved' },
        ]);
        break;
    }
  }

  demoBoard(title: string | undefined, panels: Array<{
    title?: string;
    status?: Partial<Admin.IdeaStatus>;
    display?: Partial<Admin.PostDisplay>;
  }>) {
    this.styleWhite();
    this.creditsCurrency();

    const categoryId = this.demoCategory(panels.map((panel, index) => Admin.IdeaStatusToJSON({
      statusId: index + '',
      name: index + '',
      disableFunding: false,
      disableVoting: false,
      disableExpressions: false,
      disableIdeaEdits: false,
      disableComments: false,
      ...panel.status,
    })));
    this.supportExpressingAllEmojis(categoryId);
    this.supportFunding(categoryId);
    this.supportVoting(categoryId);

    this.demoPage({
      board: Admin.PageBoardToJSON({
        title,
        panels: panels.map((panel, index) => Admin.PagePanelWithHideIfEmptyToJSON({
          title: panel.title,
          search: Admin.IdeaSearchToJSON({ filterStatusIds: [panel.status?.statusId || (index + '')] }),
          display: Admin.PostDisplayToJSON({
            titleTruncateLines: 1,
            descriptionTruncateLines: 0,
            showDescription: false,
            showCommentCount: false,
            showCategoryName: false,
            showCreated: false,
            showAuthor: false,
            showStatus: false,
            showTags: false,
            showVoting: false,
            showFunding: false,
            showExpression: false,
            disableExpand: true,
            ...panel.display,
          }),
          hideIfEmpty: false,
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
      categoryId: categoryId, name: 'Idea', visibility: Admin.CategoryVisibilityEnum.PublicOrPrivate,
      userCreatable: true,
      workflow: Admin.WorkflowToJSON({ statuses: statuses || [] }),
      support: Admin.SupportToJSON({ comment: true }),
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

  templateBase() {
    const pagesProp = this._get<ConfigEditor.PageGroup>(['layout', 'pages']);
    const pageHomeId = randomUuid();
    pagesProp.insert().setRaw(Admin.PageToJSON({
      pageId: pageHomeId,
      name: 'Home',
      slug: '',
      description: undefined,
      panels: [],
    }));

    const menuProp = this._get<ConfigEditor.ArrayProperty>(['layout', 'menu']);
    (menuProp.insert() as ConfigEditor.ObjectProperty).setRaw(Admin.MenuToJSON({
      menuId: randomUuid(), pageIds: [pageHomeId],
    }));
  }

  templateFeedback(withFunding: boolean, withStandaloneFunding: boolean = true) {
    // Ideas
    const categories = this._get<ConfigEditor.PageGroup>(['content', 'categories']);
    const ideaCategoryId = randomUuid();
    categories.insert().setRaw(Admin.CategoryToJSON({
      categoryId: ideaCategoryId, name: 'Idea', visibility: Admin.CategoryVisibilityEnum.PublicOrPrivate,
      userCreatable: true,
      workflow: Admin.WorkflowToJSON({ statuses: [] }),
      support: Admin.SupportToJSON({ comment: true }),
      tagging: Admin.TaggingToJSON({ tags: [], tagGroups: [] }),
    }));
    const ideaCategoryIndex = categories.getChildPages().length - 1;
    const ideaStatuses = this.workflowFeatures(ideaCategoryIndex, withFunding, withStandaloneFunding);

    // Bugs
    const bugCategoryId = randomUuid();
    categories.insert().setRaw(Admin.CategoryToJSON({
      categoryId: bugCategoryId, name: 'Bug', visibility: Admin.CategoryVisibilityEnum.PublicOrPrivate,
      userCreatable: true,
      workflow: Admin.WorkflowToJSON({ statuses: [] }),
      support: Admin.SupportToJSON({ comment: true }),
      tagging: Admin.TaggingToJSON({ tags: [], tagGroups: [] }),
    }));
    const bugCategoryIndex = categories.getChildPages().length - 1;
    const bugStatuses = this.workflowBug(bugCategoryIndex);
    this.taggingOsPlatform(bugCategoryIndex);

    // Pages
    const pagesProp = this._get<ConfigEditor.PageGroup>(['layout', 'pages']);
    const ideaPageId = randomUuid();
    pagesProp.insert().setRaw(Admin.PageToJSON({
      pageId: ideaPageId,
      name: 'Ideas',
      slug: 'ideas',
      title: undefined,
      description: undefined,
      panels: [],
      board: undefined,
      explorer: Admin.PageExplorerToJSON({
        allowSearch: Admin.PageExplorerAllOfAllowSearchToJSON({ enableSort: true, enableSearchText: true, enableSearchByCategory: true, enableSearchByStatus: true, enableSearchByTag: true }),
        allowCreate: true,
        display: Admin.PostDisplayToJSON({}),
        search: Admin.IdeaSearchToJSON({
          filterCategoryIds: [ideaCategoryId],
        }),
      }),
    }));
    const bugPageId = randomUuid();
    pagesProp.insert().setRaw(Admin.PageToJSON({
      pageId: bugPageId,
      name: 'Bugs',
      slug: 'bugs',
      title: undefined,
      description: undefined,
      panels: [],
      board: undefined,
      explorer: Admin.PageExplorerToJSON({
        allowSearch: Admin.PageExplorerAllOfAllowSearchToJSON({ enableSort: true, enableSearchText: true, enableSearchByCategory: true, enableSearchByStatus: true, enableSearchByTag: true }),
        allowCreate: true,
        display: Admin.PostDisplayToJSON({}),
        search: Admin.IdeaSearchToJSON({
          filterCategoryIds: [bugCategoryId],
        }),
      }),
    }));

    // Menu
    const menuProp = this._get<ConfigEditor.ArrayProperty>(['layout', 'menu']);
    (menuProp.insert() as ConfigEditor.ObjectProperty).setRaw(Admin.MenuToJSON({
      menuId: randomUuid(), pageIds: [ideaPageId, bugPageId], name: 'Feedback',
    }));

    // Add to home page
    const postDisplay: Admin.PostDisplay = {
      titleTruncateLines: 1,
      descriptionTruncateLines: 4,
      showDescription: false,
      showResponse: false,
      showCommentCount: false,
      showCategoryName: false,
      showCreated: false,
      showAuthor: false,
      showStatus: false,
      showTags: false,
      showVoting: false,
      showFunding: false,
      showExpression: false,
      disableExpand: false,
    };
    const homePagePanels = this._get<ConfigEditor.PageGroup>(['layout', 'pages', 0, 'panels']);
    homePagePanels.insert().setRaw(Admin.PagePanelWithHideIfEmptyToJSON({
      title: 'Trending feedback', hideIfEmpty: true, display: Admin.PostDisplayToJSON({
        ...postDisplay,
        showDescription: true,
        showFunding: true,
        showExpression: true,
        showVoting: true,
      }), search: Admin.IdeaSearchToJSON({
        sortBy: Admin.IdeaSearchSortByEnum.Trending,
        filterCategoryIds: [ideaCategoryId],
      })
    }));
    // homePagePanels.insert().setRaw(Admin.PagePanelWithHideIfEmptyToJSON({
    //   title: 'Recent Bugs', hideIfEmpty: true, display: Admin.PostDisplayToJSON({
    //     ...postDisplay,
    //     showDescription: true,
    //     showResponse: true,
    //     showFunding: true,
    //     showExpression: true,
    //     showVoting: true,
    //   }), search: Admin.IdeaSearchToJSON({
    //     sortBy: Admin.IdeaSearchSortByEnum.New,
    //     filterCategoryIds: [bugCategoryId],
    //   })
    // }));
    this._get<ConfigEditor.Page>(['layout', 'pages', 0, 'board'])
      .setRaw(Admin.PageBoardToJSON({
        title: 'Roadmap',
        panels: [
          ...(withFunding && withStandaloneFunding ? [
            Admin.PagePanelWithHideIfEmptyToJSON({
              title: 'Funding', hideIfEmpty: false, display: Admin.PostDisplayToJSON({
                ...postDisplay,
                showFunding: true,
              }), search: Admin.IdeaSearchToJSON({
                sortBy: Admin.IdeaSearchSortByEnum.New,
                filterCategoryIds: [ideaCategoryId],
                filterStatusIds: ideaStatuses.filter(s => s.name.match(/Funding/)).map(s => s.statusId),
              })
            }),
          ] : []),
          Admin.PagePanelWithHideIfEmptyToJSON({
            title: 'Planned', hideIfEmpty: false, display: Admin.PostDisplayToJSON(postDisplay), search: Admin.IdeaSearchToJSON({
              sortBy: Admin.IdeaSearchSortByEnum.New,
              filterCategoryIds: [ideaCategoryId, bugCategoryId],
              filterStatusIds: ideaStatuses.filter(s => s.name.match(/Planned/)).map(s => s.statusId),
            })
          }),
          Admin.PagePanelWithHideIfEmptyToJSON({
            title: 'In progress', hideIfEmpty: false, display: Admin.PostDisplayToJSON(postDisplay), search: Admin.IdeaSearchToJSON({
              sortBy: Admin.IdeaSearchSortByEnum.New,
              filterCategoryIds: [ideaCategoryId, bugCategoryId],
              filterStatusIds: [
                ...ideaStatuses.filter(s => s.name.match(/In progress/)).map(s => s.statusId),
                ...bugStatuses.filter(s => s.name.match(/In progress/)).map(s => s.statusId),
              ],
            })
          }),
          Admin.PagePanelWithHideIfEmptyToJSON({
            title: 'Completed', hideIfEmpty: false, display: Admin.PostDisplayToJSON(postDisplay), search: Admin.IdeaSearchToJSON({
              sortBy: Admin.IdeaSearchSortByEnum.New,
              filterCategoryIds: [ideaCategoryId, bugCategoryId],
              filterStatusIds: [
                ...ideaStatuses.filter(s => s.name.match(/Completed/)).map(s => s.statusId),
                ...bugStatuses.filter(s => s.name.match(/Fixed/)).map(s => s.statusId),
              ],
            })
          }),
        ],
      }));
  }

  templateBlog(suppressHomePage: boolean = false) {
    // Category
    const categories = this._get<ConfigEditor.PageGroup>(['content', 'categories']);
    const articleCategoryId = randomUuid();
    categories.insert().setRaw(Admin.CategoryToJSON({
      categoryId: articleCategoryId, name: 'Article', visibility: Admin.CategoryVisibilityEnum.PublicOrPrivate,
      userCreatable: false,
      workflow: Admin.WorkflowToJSON({ statuses: [] }),
      support: Admin.SupportToJSON({ comment: false }),
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
            showDescription: true,
            showResponse: false,
            showCommentCount: false,
            showCategoryName: false,
            showCreated: false,
            showAuthor: false,
            showStatus: false,
            showTags: false,
            showVoting: false,
            showFunding: false,
            showExpression: false,
            disableExpand: false,
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
      board: undefined,
      explorer: Admin.PageExplorerToJSON({
        allowCreate: false,
        display: Admin.PostDisplayToJSON({
          titleTruncateLines: 0,
          descriptionTruncateLines: 2,
          showDescription: true,
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
      categoryId: changelogCategoryId, name: 'Changelog', visibility: Admin.CategoryVisibilityEnum.PublicOrPrivate,
      userCreatable: false,
      workflow: Admin.WorkflowToJSON({ statuses: [] }),
      support: Admin.SupportToJSON({ comment: false }),
      tagging: Admin.TaggingToJSON({ tags: [], tagGroups: [] }),
    }));
    const changelogCategoryIndex = categories.getChildPages().length - 1;
    this.supportExpressingAllEmojis(changelogCategoryIndex);

    // Home page panel
    if (!suppressHomePage) {
      this._get<ConfigEditor.PageGroup>(['layout', 'pages', 0, 'panels'])
        .insert().setRaw(Admin.PagePanelWithHideIfEmptyToJSON({
          title: 'Recent changes', hideIfEmpty: true, display: Admin.PostDisplayToJSON({
            titleTruncateLines: 1,
            descriptionTruncateLines: 2,
            showDescription: true,
            showResponse: false,
            showCommentCount: false,
            showCategoryName: false,
            showCreated: false,
            showAuthor: false,
            showStatus: false,
            showTags: false,
            showVoting: false,
            showFunding: false,
            showExpression: false,
            disableExpand: false,
          }), search: Admin.IdeaSearchToJSON({
            sortBy: Admin.IdeaSearchSortByEnum.New,
            filterCategoryIds: [changelogCategoryId],
          })
        }));
    }

    // Pages and menu
    const pagesProp = this._get<ConfigEditor.PageGroup>(['layout', 'pages']);
    const menuProp = this._get<ConfigEditor.ArrayProperty>(['layout', 'menu']);
    const changelogPageId = randomUuid();
    pagesProp.insert().setRaw(Admin.PageToJSON({
      pageId: changelogPageId,
      name: 'Changelog',
      slug: stringToSlug('changelog'),
      description: undefined,
      panels: [],
      board: undefined,
      explorer: Admin.PageExplorerToJSON({
        allowCreate: false,
        display: Admin.PostDisplayToJSON({
          titleTruncateLines: 0,
          descriptionTruncateLines: 2,
          showDescription: true,
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
      categoryId: helpCategoryId, name: 'Help', visibility: Admin.CategoryVisibilityEnum.PublicOrPrivate,
      userCreatable: false,
      workflow: Admin.WorkflowToJSON({ statuses: [] }),
      support: Admin.SupportToJSON({ comment: false }),
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
      descriptionTruncateLines: 4,
      showDescription: false,
      showResponse: false,
      showCommentCount: false,
      showCategoryName: false,
      showCreated: false,
      showAuthor: false,
      showStatus: false,
      showTags: false,
      showVoting: false,
      showFunding: false,
      showExpression: false,
      disableExpand: false,
    };
    pagesProp.insert().setRaw(Admin.PageToJSON({
      pageId: helpPageId,
      name: 'Help',
      slug: 'help',
      title: 'How can we help you?',
      description: "If you can't find help, don't hesitate to contact us at support@example.com",
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
        allowSearch: Admin.PageExplorerAllOfAllowSearchToJSON({ enableSort: true, enableSearchText: true, enableSearchByCategory: true, enableSearchByStatus: true, enableSearchByTag: true }),
        allowCreate: false,
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
    this._get<ConfigEditor.ObjectProperty>(['content', 'categories', categoryIndex, 'support', 'fund']).setRaw(Admin.FundingToJSON({
      showFunds: true, showFunders: true,
    }));
  }
  supportVoting(categoryIndex: number, enableDownvotes: boolean = false) {
    this._get<ConfigEditor.ObjectProperty>(['content', 'categories', categoryIndex, 'support', 'vote']).setRaw(Admin.VotingToJSON({
      enableDownvotes: enableDownvotes, showVotes: true, showVoters: true,
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

  taggingOsPlatform(categoryIndex: number) {
    this.tagging(categoryIndex,
      [Admin.TagToJSON({ tagId: randomUuid(), name: 'Windows' }),
      Admin.TagToJSON({ tagId: randomUuid(), name: 'Mac' }),
      Admin.TagToJSON({ tagId: randomUuid(), name: 'Linux' })],
      Admin.TagGroupToJSON({
        tagGroupId: randomUuid(), name: 'Platform', userSettable: true, tagIds: [],
      }));
  }
  tagging(categoryIndex: number, tags: Admin.Tag[], tagGroup: Admin.TagGroup) {
    const tagsProp = this._get<ConfigEditor.ArrayProperty>(['content', 'categories', categoryIndex, 'tagging', 'tags']);
    tags.forEach(tag => (tagsProp.insert() as ConfigEditor.ObjectProperty).setRaw(tag))
    this._get<ConfigEditor.PageGroup>(['content', 'categories', categoryIndex, 'tagging', 'tagGroups']).insert().setRaw(Admin.TagGroupToJSON({
      ...tagGroup, tagIds: tags.map(tag => tag.tagId),
    }));
  }

  workflowFeatures(categoryIndex: number, withFunding: boolean = true, withStandaloneFunding: boolean = true): Admin.IdeaStatus[] {
    const closed = Admin.IdeaStatusToJSON({ name: 'Closed', nextStatusIds: [], color: 'darkred', statusId: randomUuid(), disableFunding: true, disableExpressions: false, disableVoting: false, disableComments: false, disableIdeaEdits: false });
    const completed = Admin.IdeaStatusToJSON({ name: 'Completed', nextStatusIds: [], color: 'darkgreen', statusId: randomUuid(), disableFunding: true, disableExpressions: false, disableVoting: false, disableComments: false, disableIdeaEdits: true });
    const inProgress = Admin.IdeaStatusToJSON({ name: 'In progress', nextStatusIds: [closed.statusId, completed.statusId], color: 'darkblue', statusId: randomUuid(), disableFunding: true, disableExpressions: false, disableVoting: false, disableComments: false, disableIdeaEdits: true });
    const planned = Admin.IdeaStatusToJSON({ name: 'Planned', nextStatusIds: [closed.statusId, inProgress.statusId], color: 'blue', statusId: randomUuid(), disableFunding: withFunding && !withStandaloneFunding, disableExpressions: false, disableVoting: false, disableComments: false, disableIdeaEdits: true });
    var funding;
    if (withFunding && withStandaloneFunding) {
      funding = Admin.IdeaStatusToJSON({ name: 'Funding', nextStatusIds: [closed.statusId, planned.statusId], color: 'green', statusId: randomUuid(), disableFunding: false, disableExpressions: false, disableVoting: false, disableComments: false, disableIdeaEdits: true });
    }
    const underReview = Admin.IdeaStatusToJSON({ name: 'Under review', nextStatusIds: [...((withFunding && withStandaloneFunding) ? [funding.statusId] : []), closed.statusId, planned.statusId], color: 'lightblue', statusId: randomUuid(), disableFunding: withFunding && !withStandaloneFunding, disableExpressions: false, disableVoting: false, disableComments: false, disableIdeaEdits: false });
    return this.workflow(categoryIndex, underReview.statusId, [closed, completed, inProgress, planned, underReview, ...((withFunding && withStandaloneFunding) ? [funding] : [])]);
  }
  workflowBug(categoryIndex: number): Admin.IdeaStatus[] {
    const notReproducible = Admin.IdeaStatusToJSON({ name: 'Not reproducible', nextStatusIds: [], color: 'darkred', statusId: randomUuid(), disableFunding: true, disableExpressions: false, disableVoting: false, disableComments: false, disableIdeaEdits: false });
    const wontFix = Admin.IdeaStatusToJSON({ name: 'Won\'t fix', nextStatusIds: [], color: 'darkred', statusId: randomUuid(), disableFunding: true, disableExpressions: false, disableVoting: false, disableComments: false, disableIdeaEdits: false });
    const fixed = Admin.IdeaStatusToJSON({ name: 'Fixed', nextStatusIds: [], color: 'darkgreen', statusId: randomUuid(), disableFunding: true, disableExpressions: false, disableVoting: false, disableComments: false, disableIdeaEdits: true });
    const inProgress = Admin.IdeaStatusToJSON({ name: 'In progress', nextStatusIds: [wontFix.statusId, notReproducible.statusId, fixed.statusId], color: 'darkblue', statusId: randomUuid(), disableFunding: true, disableExpressions: false, disableVoting: false, disableComments: false, disableIdeaEdits: true });
    const underReview = Admin.IdeaStatusToJSON({ name: 'Under review', nextStatusIds: [inProgress.statusId, wontFix.statusId, notReproducible.statusId], color: 'lightblue', statusId: randomUuid(), disableFunding: false, disableExpressions: false, disableVoting: false, disableComments: false, disableIdeaEdits: false });
    return this.workflow(categoryIndex, underReview.statusId, [notReproducible, wontFix, fixed, inProgress, underReview]);
  }
  workflow(categoryIndex: number, entryStatusId: string, statuses: Admin.IdeaStatus[]): Admin.IdeaStatus[] {
    this._get<ConfigEditor.LinkProperty>(['content', 'categories', categoryIndex, 'workflow', 'entryStatus']).set(undefined);
    this._get<ConfigEditor.PageGroup>(['content', 'categories', categoryIndex, 'workflow', 'statuses']).setRaw(statuses);
    this._get<ConfigEditor.LinkProperty>(['content', 'categories', categoryIndex, 'workflow', 'entryStatus']).set(entryStatusId);
    return statuses;
  }

  creditsCurrencyWithoutCents() {
    this._get<ConfigEditor.PageGroup>(['users', 'credits']).set(true);
    this._get<ConfigEditor.NumberProperty>(['users', 'credits', 'increment']).set(1);
    this._get<ConfigEditor.ArrayProperty>(['users', 'credits', 'formats']).setRaw([
      Admin.CreditFormatterEntryToJSON({ prefix: '$', greaterOrEqual: 10000, maximumFractionDigits: 2 }),
      Admin.CreditFormatterEntryToJSON({ prefix: '$', greaterOrEqual: 100, minimumFractionDigits: 2 }),
      Admin.CreditFormatterEntryToJSON({ prefix: '$' }),
    ]);
  }
  creditsCurrency() {
    this._get<ConfigEditor.PageGroup>(['users', 'credits']).set(true);
    this._get<ConfigEditor.NumberProperty>(['users', 'credits', 'increment']).set(1);
    this._get<ConfigEditor.ArrayProperty>(['users', 'credits', 'formats']).setRaw([
      Admin.CreditFormatterEntryToJSON({ prefix: '$', multiplier: 0.01, greaterOrEqual: 10000, maximumFractionDigits: 2 }),
      Admin.CreditFormatterEntryToJSON({ prefix: '$', multiplier: 0.01, greaterOrEqual: 100, minimumFractionDigits: 2 }),
      Admin.CreditFormatterEntryToJSON({ prefix: '$', lessOrEqual: 0 }),
      Admin.CreditFormatterEntryToJSON({ prefix: '¢' }),
    ]);
  }
  creditsTime() {
    this._get<ConfigEditor.PageGroup>(['users', 'credits']).set(true);
    this._get<ConfigEditor.NumberProperty>(['users', 'credits', 'increment']).set(1);
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
    this._get<ConfigEditor.NumberProperty>(['users', 'credits', 'increment']).set(1);
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
  creditsBeer() {
    this._get<ConfigEditor.PageGroup>(['users', 'credits']).set(true);
    this._get<ConfigEditor.NumberProperty>(['users', 'credits', 'increment']).set(1);
    this._get<ConfigEditor.ArrayProperty>(['users', 'credits', 'formats']).setRaw([
      Admin.CreditFormatterEntryToJSON({ suffix: 'm 🍺', multiplier: 0.000001, greaterOrEqual: 100000000, maximumFractionDigits: 0 }),
      Admin.CreditFormatterEntryToJSON({ suffix: 'm 🍺', multiplier: 0.000001, greaterOrEqual: 10000000, maximumFractionDigits: 1 }),
      Admin.CreditFormatterEntryToJSON({ suffix: 'm 🍺', multiplier: 0.000001, greaterOrEqual: 1000000, maximumFractionDigits: 2 }),
      Admin.CreditFormatterEntryToJSON({ suffix: 'k 🍺', multiplier: 0.001, greaterOrEqual: 100000, maximumFractionDigits: 0 }),
      Admin.CreditFormatterEntryToJSON({ suffix: 'k 🍺', multiplier: 0.001, greaterOrEqual: 10000, maximumFractionDigits: 1 }),
      Admin.CreditFormatterEntryToJSON({ suffix: 'k 🍺', multiplier: 0.001, greaterOrEqual: 1000, maximumFractionDigits: 2 }),
      Admin.CreditFormatterEntryToJSON({ suffix: ' 🍺', lessOrEqual: 999 }),
    ]);
  }

  usersOnboardingEmail(enable: boolean, passwordRequirement: Admin.EmailSignupPasswordEnum = Admin.EmailSignupPasswordEnum.Optional) {
    this._get<ConfigEditor.ObjectProperty>(['users', 'onboarding', 'notificationMethods', 'email']).set(enable ? true : undefined);
    if (enable) {
      this._get<ConfigEditor.StringProperty>(['users', 'onboarding', 'notificationMethods', 'email', 'password']).set(passwordRequirement);
    }
  }

  usersOnboardingAnonymous(enable: boolean, onlyShowIfPushNotAvailable: boolean = false) {
    this._get<ConfigEditor.ObjectProperty>(['users', 'onboarding', 'notificationMethods', 'anonymous']).set(enable ? true : undefined);
    if (enable) {
      this._get<ConfigEditor.BooleanProperty>(['users', 'onboarding', 'notificationMethods', 'anonymous', 'onlyShowIfPushNotAvailable']).set(onlyShowIfPushNotAvailable);
    }
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

  _get<T extends ConfigEditor.Setting<any, any>>(path: ConfigEditor.Path): T {
    return this.editor.get(path) as any as T;
  }
}
