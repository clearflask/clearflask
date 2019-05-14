import * as ConfigEditor from "./configEditor";
import * as Admin from "../../api/admin";
import randomUuid from "../util/uuid";
import stringToSlug from "../util/slugger";

export default class Templater {
  editor:ConfigEditor.Editor;

  constructor(editor:ConfigEditor.Editor) {
    this.editor = editor;
  }

  static get(editor:ConfigEditor.Editor):Templater {
    return new Templater(editor);
  }

  demo() {
    // this.creditsTime();
    // TODO Home
    // TODO FAQ
    this.baseFeatures();
    // TODO KNOWLEDGE BASE
    // TODO BLOG
    // TODO BUG BOUNTY
    // TODO QUESTION AND ANSWER
    // TODO FORUM
  }

  demoCategory() {
    const categoryId = randomUuid();
    const categories = this._get<ConfigEditor.PageGroup>(['content', 'categories']);
    categories.insert().setRaw(Admin.CategoryToJSON({
      categoryId: categoryId, name: 'Idea', visibility: Admin.CategoryVisibilityEnum.PublicOrPrivate,
      userCreatable: true,
      workflow: Admin.WorkflowToJSON({statuses: []}),
      support: Admin.SupportToJSON({comment: true}),
      tagging: Admin.TaggingToJSON({tags: [], tagGroups: []}),
    }));
    const categoryIndex = categories.getChildPages().length - 1;
    return categoryIndex;
  }

  demoPagePanel() {
    const pageId = randomUuid();
    this._get<ConfigEditor.PageGroup>(['layout', 'pages']).insert().setRaw(Admin.PageToJSON({
      pageId: pageId,
      name: 'Demo',
      slug: stringToSlug('demo'),
      panels: [
        Admin.PagePanelWithSearchToJSON({display: Admin.PostDisplayToJSON({}), search: Admin.IdeaSearchToJSON({})}),
      ],
    }));
  }

  baseFeatures() {
    // Enable SSO
    this._get<ConfigEditor.ObjectProperty>(['users', 'onboarding', 'notificationMethods', 'singleSignOn']).set(true);
    // Enable display name
    this._get<ConfigEditor.EnumProperty>(['users', 'onboarding', 'accountFields', 'displayName']).set(Admin.AccountFieldsDisplayNameEnum.None);

    // Categories
    const categories = this._get<ConfigEditor.PageGroup>(['content', 'categories']);
    // Idea
    const ideaCategoryId = randomUuid();
    categories.insert().setRaw(Admin.CategoryToJSON({
      categoryId: ideaCategoryId, name: 'Idea', visibility: Admin.CategoryVisibilityEnum.PublicOrPrivate,
      userCreatable: true,
      workflow: Admin.WorkflowToJSON({statuses: []}),
      support: Admin.SupportToJSON({comment: true}),
      tagging: Admin.TaggingToJSON({tags: [], tagGroups: []}),
    }));
    const ideaCategoryIndex = categories.getChildPages().length - 1;
    this.supportFunding(ideaCategoryIndex);
    this.supportVoting(ideaCategoryIndex, true);
    this.supportExpressingFacebookStyle(ideaCategoryIndex);
    this.taggingOsPlatform(ideaCategoryIndex);
    const statuses = this.workflowFeatures(ideaCategoryIndex);
    // Article
    const articleCategoryId = randomUuid();
    categories.insert().setRaw(Admin.CategoryToJSON({
      categoryId: articleCategoryId, name: 'Article', visibility: Admin.CategoryVisibilityEnum.PublicOrPrivate,
      userCreatable: true,
      workflow: Admin.WorkflowToJSON({statuses: []}),
      support: Admin.SupportToJSON({comment: false}),
      tagging: Admin.TaggingToJSON({tags: [], tagGroups: []}),
    }));
    const articleCategoryIndex = categories.getChildPages().length - 1;
    this.supportExpressingAllEmojis(articleCategoryIndex);

    // tags: Feature Requests, Bug Reports, Translations
    // TODO redo to: Frontend, Mobile App, Public API, Bugs, Security
    const tagGroupIdIdeas = randomUuid();
    const tags = [Admin.TagToJSON({tagId: randomUuid(), name: 'Feature'}),
      Admin.TagToJSON({tagId: randomUuid(), name: 'Bug'}),
      Admin.TagToJSON({tagId: randomUuid(), name: 'Translation'})];
    this.tagging(ideaCategoryIndex, tags, Admin.TagGroupToJSON({
      tagGroupId: tagGroupIdIdeas, name: 'Ideas', userSettable: true, tagIds: [],
      minRequired: 1, maxRequired: 1,
    }));

    // Layout
    const pagesProp = this._get<ConfigEditor.PageGroup>(['layout', 'pages']);
    const menuProp = this._get<ConfigEditor.ArrayProperty>(['layout', 'menu']);
    // Home
    const pageHomeId = randomUuid();
    pagesProp.insert().setRaw(Admin.PageToJSON({
      pageId: pageHomeId,
      name: 'Home',
      slug: stringToSlug('Home'),
      description: undefined,
      panels: [
        Admin.PagePanelWithSearchToJSON({title: 'Funding', display: Admin.PostDisplayToJSON({}), search: Admin.IdeaSearchToJSON({
          sortBy: Admin.IdeaSearchSortByEnum.New,
          filterCategoryIds: [ideaCategoryId],
          filterStatusIds: statuses.filter(s => s.name.match(/Funding/)).map(s => s.statusId),
        })}),
      ],
      board: Admin.PageBoardToJSON({
        title: 'Roadmap',
        panels: [
          Admin.PagePanelToJSON({title: 'Planned', display: Admin.PostDisplayToJSON({}), search: Admin.IdeaSearchToJSON({
            sortBy: Admin.IdeaSearchSortByEnum.New,
            filterCategoryIds: [ideaCategoryId],
            filterStatusIds: statuses.filter(s => s.name.match(/Planned/)).map(s => s.statusId),
          })}),
          Admin.PagePanelToJSON({title: 'In progress', display: Admin.PostDisplayToJSON({}), search: Admin.IdeaSearchToJSON({
            sortBy: Admin.IdeaSearchSortByEnum.New,
            filterCategoryIds: [ideaCategoryId],
            filterStatusIds: statuses.filter(s => s.name.match(/In progress/)).map(s => s.statusId),
          })}),
          Admin.PagePanelToJSON({title: 'Completed', display: Admin.PostDisplayToJSON({}), search: Admin.IdeaSearchToJSON({
            sortBy: Admin.IdeaSearchSortByEnum.New,
            filterCategoryIds: [ideaCategoryId],
            filterStatusIds: statuses.filter(s => s.name.match(/Completed/)).map(s => s.statusId),
          })}),
        ],
        controls: Admin.PagePanelSearchToJSON({
          enableSearchByCategory: false,
          enableSearchByStatus: false,
          enableSearchByTag: false,
        }),
      }),
      explorer: undefined,
    }));
    (menuProp.insert() as ConfigEditor.ObjectProperty).setRaw(Admin.MenuToJSON({
      menuId: randomUuid(), pageIds: [pageHomeId],
    }));
    // Features
    const pageIdeaIds:string[] = [];
    tags.forEach(tag => {
      const pageIdeaId = randomUuid();
      pageIdeaIds.push(pageIdeaId);
      pagesProp.insert().setRaw(Admin.PageToJSON({
        pageId: pageIdeaId,
        name: tag.name,
        slug: stringToSlug(tag.name),
        title: tag.name,
        description: undefined,
        panels: [],
        board: undefined,
        explorer: Admin.PageExplorerToJSON({
          allowSearch: true,
          allowCreate: true,
          panel: Admin.PagePanelWithSearchToJSON({display: Admin.PostDisplayToJSON({}), search: Admin.IdeaSearchToJSON({
            filterCategoryIds: [ideaCategoryId],
            filterTagIds: [tag.tagId],
          })}),
        }),
      }));
    });
    (menuProp.insert() as ConfigEditor.ObjectProperty).setRaw(Admin.MenuToJSON({
      menuId: randomUuid(), pageIds: pageIdeaIds, name: 'Ideas',
    }));
    // Blog
    const pageBlogId = randomUuid();
    pagesProp.insert().setRaw(Admin.PageToJSON({
      pageId: pageBlogId,
      name: 'Blog',
      slug: stringToSlug('blog'),
      description: undefined,
      panels: [],
      board: undefined,
      explorer: Admin.PageExplorerToJSON({
        allowSearch: true,
        allowCreate: false,
        panel: Admin.PagePanelWithSearchToJSON({display: Admin.PostDisplayToJSON({}), search: Admin.IdeaSearchToJSON({
          filterCategoryIds: [articleCategoryId],
        })}),
      }),
    }));
    (menuProp.insert() as ConfigEditor.ObjectProperty).setRaw(Admin.MenuToJSON({
      menuId: randomUuid(), pageIds: [pageBlogId],
    }));
    // Explorer
    const pageExplorerId = randomUuid();
    pagesProp.insert().setRaw(Admin.PageToJSON({
      pageId: pageExplorerId,
      name: 'Search',
      slug: stringToSlug('Explorer'),
      description: undefined,
      panels: [],
      board: undefined,
      explorer: Admin.PageExplorerToJSON({
        allowSearch: true,
        allowCreate: true,
        panel: Admin.PagePanelWithSearchToJSON({display: Admin.PostDisplayToJSON({}), search: Admin.IdeaSearchToJSON({})}),
      }),
    }));
    (menuProp.insert() as ConfigEditor.ObjectProperty).setRaw(Admin.MenuToJSON({
      menuId: randomUuid(), pageIds: [pageExplorerId],
    }));
  }

  supportFunding(categoryIndex:number) {
    this._get<ConfigEditor.ObjectProperty>(['content', 'categories', categoryIndex, 'support', 'fund']).setRaw(Admin.FundingToJSON({
      showFunds: true, showFunders: true,
    }));
  }
  supportVoting(categoryIndex:number, enableDownvotes:boolean = false) {
    this._get<ConfigEditor.ObjectProperty>(['content', 'categories', categoryIndex, 'support', 'vote']).setRaw(Admin.VotingToJSON({
      enableDownvotes: enableDownvotes, showVotes: true, showVoters: true,
    }));
  }
  supportExpressingAllEmojis(categoryIndex:number) {
    this._get<ConfigEditor.ObjectProperty>(['content', 'categories', categoryIndex, 'support', 'express']).set(true);
  }
  supportExpressingFacebookStyle(categoryIndex:number) {
    const expressProp = this._get<ConfigEditor.ObjectProperty>(['content', 'categories', categoryIndex, 'support', 'express']);
    if(expressProp.value !== true) expressProp.set(true);
    this._get<ConfigEditor.ArrayProperty>(['content', 'categories', categoryIndex, 'support', 'express', 'limitEmojiSet']).setRaw([
      Admin.ExpressionToJSON({display: '😍', text: 'Love', weight: 1}),
      Admin.ExpressionToJSON({display: '😆', text: 'Laugh', weight: 1}),
      Admin.ExpressionToJSON({display: '😮', text: 'Shocked', weight: 0}),
      Admin.ExpressionToJSON({display: '😥', text: 'Crying', weight: -1}),
      Admin.ExpressionToJSON({display: '😠', text: 'Angry', weight: -1}),
      Admin.ExpressionToJSON({display: '👍', text: 'Thumbs up', weight: 1}),
      Admin.ExpressionToJSON({display: '👎', text: 'Thumbs down', weight: -1}),
    ]);
  }
  supportExpressingGithubStyle(categoryIndex:number) {
    const expressProp = this._get<ConfigEditor.ObjectProperty>(['content', 'categories', categoryIndex, 'support', 'express']);
    if(expressProp.value !== true) expressProp.set(true);
    this._get<ConfigEditor.ArrayProperty>(['content', 'categories', categoryIndex, 'support', 'express', 'limitEmojiSet']).setRaw([
      Admin.ExpressionToJSON({display: '👍', text: '+1', weight: 1}),
      Admin.ExpressionToJSON({display: '👎', text: '-1', weight: -1}),
      Admin.ExpressionToJSON({display: '😆', text: 'Laugh', weight: 1}),
      Admin.ExpressionToJSON({display: '🎉', text: 'Hooray', weight: 1}),
      Admin.ExpressionToJSON({display: '😕', text: 'Confused', weight: -1}),
      Admin.ExpressionToJSON({display: '❤️', text: 'Heart', weight: 1}),
      Admin.ExpressionToJSON({display: '🚀', text: 'Rocket', weight: 1}),
      Admin.ExpressionToJSON({display: '👀', text: 'Eyes', weight: 1}),
    ]);
  }

  taggingOsPlatform(categoryIndex:number) {
    this.tagging(categoryIndex,
      [Admin.TagToJSON({tagId: randomUuid(), name: 'Windows'}),
        Admin.TagToJSON({tagId: randomUuid(), name: 'Mac'}),
        Admin.TagToJSON({tagId: randomUuid(), name: 'Linux'})],
      Admin.TagGroupToJSON({
        tagGroupId: randomUuid(), name: 'Platform', userSettable: true, tagIds: [],
      }));
  }
  tagging(categoryIndex:number, tags:Admin.Tag[], tagGroup:Admin.TagGroup) {
    const tagsProp = this._get<ConfigEditor.ArrayProperty>(['content', 'categories', categoryIndex, 'tagging', 'tags']);
    tags.forEach(tag => (tagsProp.insert() as ConfigEditor.ObjectProperty).setRaw(tag))
    this._get<ConfigEditor.PageGroup>(['content', 'categories', categoryIndex, 'tagging', 'tagGroups']).insert().setRaw(Admin.TagGroupToJSON({
      ...tagGroup, tagIds: tags.map(tag => tag.tagId),
    }));
  }

  workflowFeatures(categoryIndex:number):Admin.IdeaStatus[] {
    const closed = Admin.IdeaStatusToJSON({name: 'Closed', nextStatusIds: [], color: 'darkred', statusId: randomUuid(), disableFunding:true, disableSupport:false, disableComments:false, disableIdeaEdits:false});
    const completed = Admin.IdeaStatusToJSON({name: 'Completed', nextStatusIds: [], color: 'darkgreen', statusId: randomUuid(), disableFunding:true, disableSupport:false, disableComments:false, disableIdeaEdits:true});
    const inProgress = Admin.IdeaStatusToJSON({name: 'In progress', nextStatusIds: [closed.statusId, completed.statusId], color: 'darkblue', statusId: randomUuid(), disableFunding:true, disableSupport:false, disableComments:false, disableIdeaEdits:true});
    const planned = Admin.IdeaStatusToJSON({name: 'Planned', nextStatusIds: [closed.statusId, inProgress.statusId], color: 'blue', statusId: randomUuid(), disableFunding:false, disableSupport:false, disableComments:false, disableIdeaEdits:true});
    const funding = Admin.IdeaStatusToJSON({name: 'Funding', nextStatusIds: [closed.statusId, planned.statusId], color: 'green', statusId: randomUuid(), disableFunding:false, disableSupport:false, disableComments:false, disableIdeaEdits:true});
    const underReview = Admin.IdeaStatusToJSON({name: 'Under review', nextStatusIds: [funding.statusId, closed.statusId, planned.statusId], color: 'lightblue', statusId: randomUuid(), disableFunding:false, disableSupport:false, disableComments:false, disableIdeaEdits:false});
    return this.workflow(categoryIndex, underReview.statusId, [closed, completed, inProgress, planned, funding, underReview]);
  }
  workflowBug(categoryIndex:number):Admin.IdeaStatus[] {
    const notReproducible = Admin.IdeaStatusToJSON({name: 'Not reproducible', nextStatusIds: [], color: 'darkred', statusId: randomUuid(), disableFunding:true, disableSupport:false, disableComments:false, disableIdeaEdits:false});
    const wontFix = Admin.IdeaStatusToJSON({name: 'Won\'t fix', nextStatusIds: [], color: 'darkred', statusId: randomUuid(), disableFunding:true, disableSupport:false, disableComments:false, disableIdeaEdits:false});
    const fixed = Admin.IdeaStatusToJSON({name: 'Fixed', nextStatusIds: [], color: 'darkgreen', statusId: randomUuid(), disableFunding:true, disableSupport:false, disableComments:false, disableIdeaEdits:true});
    const inProgress = Admin.IdeaStatusToJSON({name: 'In progress', nextStatusIds: [wontFix.statusId, notReproducible.statusId, fixed.statusId], color: 'darkblue', statusId: randomUuid(), disableFunding:true, disableSupport:false, disableComments:false, disableIdeaEdits:true});
    const underReview = Admin.IdeaStatusToJSON({name: 'Under review', nextStatusIds: [inProgress.statusId, wontFix.statusId, notReproducible.statusId], color: 'lightblue', statusId: randomUuid(), disableFunding:false, disableSupport:false, disableComments:false, disableIdeaEdits:false});
    return this.workflow(categoryIndex, underReview.statusId, [notReproducible, wontFix, fixed, inProgress, underReview]);
  }
  workflow(categoryIndex:number, entryStatusId:string, statuses:Admin.IdeaStatus[]):Admin.IdeaStatus[] {
    this._get<ConfigEditor.LinkProperty>(['content', 'categories', categoryIndex, 'workflow', 'entryStatus']).set(entryStatusId);
    this._get<ConfigEditor.PageGroup>(['content', 'categories', categoryIndex, 'workflow', 'statuses']).setRaw(statuses);
    return statuses;
  }

  creditsCurrency() {
    this._get<ConfigEditor.NumberProperty>(['credits', 'increment']).set(0.01);
    this._get<ConfigEditor.ArrayProperty>(['credits', 'formats']).setRaw([
      Admin.CreditFormatterEntryToJSON({prefix: '$', greaterOrEqual: 100, minimumFractionDigits: 0}),
      Admin.CreditFormatterEntryToJSON({prefix: '$', greaterOrEqual: 1, minimumFractionDigits: 2}),
      Admin.CreditFormatterEntryToJSON({prefix: '$', lessOrEqual: 0}),
      Admin.CreditFormatterEntryToJSON({prefix: '¢', multiplier: 100}),
    ]);
  }
  creditsTime() {
    this._get<ConfigEditor.NumberProperty>(['credits', 'increment']).set(1);
    this._get<ConfigEditor.ArrayProperty>(['credits', 'formats']).setRaw([
      Admin.CreditFormatterEntryToJSON({suffix: ' Weeks', multiplier: 0.025, greaterOrEqual: 41, maximumFractionDigits: 1}),
      Admin.CreditFormatterEntryToJSON({suffix: ' Week', multiplier: 0.025, greaterOrEqual: 40, lessOrEqual: 40}),
      Admin.CreditFormatterEntryToJSON({suffix: ' Days', multiplier: 0.125, greaterOrEqual: 9, lessOrEqual: 39, maximumFractionDigits: 1}),
      Admin.CreditFormatterEntryToJSON({suffix: ' Day', multiplier: 0.125, greaterOrEqual: 8, lessOrEqual: 8}),
      Admin.CreditFormatterEntryToJSON({suffix: ' Hrs', greaterOrEqual: 2}),
      Admin.CreditFormatterEntryToJSON({suffix: ' Hr', lessOrEqual: 1}),
    ]);
  }
  creditsUnitless() {
    this._get<ConfigEditor.NumberProperty>(['credits', 'increment']).set(1);
    this._get<ConfigEditor.ArrayProperty>(['credits', 'formats']).setRaw([
      Admin.CreditFormatterEntryToJSON({suffix: 'm', multiplier: 0.000001, greaterOrEqual: 100000000, maximumFractionDigits: 0}),
      Admin.CreditFormatterEntryToJSON({suffix: 'm', multiplier: 0.000001, greaterOrEqual: 10000000, maximumFractionDigits: 1}),
      Admin.CreditFormatterEntryToJSON({suffix: 'm', multiplier: 0.000001, greaterOrEqual: 1000000, maximumFractionDigits: 2}),
      Admin.CreditFormatterEntryToJSON({suffix: 'k', multiplier: 0.001, greaterOrEqual: 100000, maximumFractionDigits: 0}),
      Admin.CreditFormatterEntryToJSON({suffix: 'k', multiplier: 0.001, greaterOrEqual: 10000, maximumFractionDigits: 1}),
      Admin.CreditFormatterEntryToJSON({suffix: 'k', multiplier: 0.001, greaterOrEqual: 1000, maximumFractionDigits: 2}),
    ]);
  }
  creditsBeer() {
    this._get<ConfigEditor.NumberProperty>(['credits', 'increment']).set(1);
    this._get<ConfigEditor.ArrayProperty>(['credits', 'formats']).setRaw([
      Admin.CreditFormatterEntryToJSON({suffix: 'm 🍺', multiplier: 0.000001, greaterOrEqual: 100000000, maximumFractionDigits: 0}),
      Admin.CreditFormatterEntryToJSON({suffix: 'm 🍺', multiplier: 0.000001, greaterOrEqual: 10000000, maximumFractionDigits: 1}),
      Admin.CreditFormatterEntryToJSON({suffix: 'm 🍺', multiplier: 0.000001, greaterOrEqual: 1000000, maximumFractionDigits: 2}),
      Admin.CreditFormatterEntryToJSON({suffix: 'k 🍺', multiplier: 0.001, greaterOrEqual: 100000, maximumFractionDigits: 0}),
      Admin.CreditFormatterEntryToJSON({suffix: 'k 🍺', multiplier: 0.001, greaterOrEqual: 10000, maximumFractionDigits: 1}),
      Admin.CreditFormatterEntryToJSON({suffix: 'k 🍺', multiplier: 0.001, greaterOrEqual: 1000, maximumFractionDigits: 2}),
      Admin.CreditFormatterEntryToJSON({suffix: ' 🍺', lessOrEqual: 999}),
    ]);
  }

  _get<T extends ConfigEditor.Setting<any, any>>(path:ConfigEditor.Path):T {
    return this.editor.get(path) as any as T;
  }
}
