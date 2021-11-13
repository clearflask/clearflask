// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
import * as Admin from "../../../api/admin";
import { T } from "../../../i18n";
import stringToSlug from "../../util/slugger";
import randomUuid from "../../util/uuid";
import * as ConfigEditor from "../configEditor";
import Templater from "../configTemplater";
import { RoadmapInstance } from "./roadmap";
import { CategoryAndIndex } from "./templateUtils";

const FeedbackCategoryIdPrefix = 'feedback-';
const FeedbackPageIdPrefix = 'feedback-';
const FeedbackStatusAcceptedPrefix = 'accepted-';

export type PageWithFeedback = Admin.Page & (Required<Pick<Admin.Page, 'feedback'>> | Required<Pick<Admin.Page, 'explorer'>>);
export interface FeedbackInstance {
  categoryAndIndex: CategoryAndIndex;
  pageAndIndex?: {
    page: Admin.Page;
    index: number;
  },
  statusIdAccepted?: string;
}

export async function feedbackGet(this: Templater): Promise<FeedbackInstance | undefined> {
  const categoryAndIndex = await this._findCategoryByPrefix(FeedbackCategoryIdPrefix, 'Feedback');
  if (!categoryAndIndex) return undefined;

  const pageAndIndex = await this._findPageByPrefix(FeedbackPageIdPrefix, 'Feedback', page => !!page.feedback || !!page.explorer);

  const feedback: FeedbackInstance = {
    categoryAndIndex,
    pageAndIndex: pageAndIndex as (FeedbackInstance['pageAndIndex'] | undefined),
    statusIdAccepted: categoryAndIndex.category.workflow.statuses
      .find(s => s.statusId.startsWith(FeedbackStatusAcceptedPrefix))?.statusId,
  };

  return feedback;
}

export async function feedbackOn(this: Templater, pageType: 'off' | 'feedback' | 'explorer'): Promise<FeedbackInstance> {
  var feedback = await this.feedbackGet();

  // Create Category
  if (!feedback) {
    const roadmap = await this.roadmapGet();
    const categoriesProp = this._get<ConfigEditor.PageGroup>(['content', 'categories']);
    const feedbackCategoryId = FeedbackCategoryIdPrefix + randomUuid();
    categoriesProp.insert().setRaw(Admin.CategoryToJSON({
      categoryId: feedbackCategoryId, name: T<'app'>('feedback'),
      userCreatable: true,
      userMergeableCategoryIds: [feedbackCategoryId, ...(roadmap ? [roadmap.categoryAndIndex.category.categoryId] : [])],
      workflow: { statuses: [] },
      support: {
        vote: {
          enableDownvotes: false,
          iWantThis: {},
        },
        comment: true,
        fund: false,
      },
      tagging: { tags: [], tagGroups: [] },
    }));
    const postCategoryIndex = categoriesProp.getChildPages().length - 1;

    const statusIdNew = randomUuid();
    const statusIdGatheringFeedback = randomUuid();
    const statusIdAccepted = FeedbackStatusAcceptedPrefix + randomUuid();
    const statusIdClosed = randomUuid();
    this.workflow(postCategoryIndex, statusIdNew, [
      { name: T<'app'>('new'), nextStatusIds: [statusIdGatheringFeedback, statusIdAccepted, statusIdClosed, statusIdClosed], color: this.workflowColorNew, statusId: statusIdNew, disableFunding: false, disableExpressions: false, disableVoting: false, disableComments: false, disableIdeaEdits: false },
      { name: T<'app'>('considering'), nextStatusIds: [statusIdAccepted, statusIdClosed], color: this.workflowColorNeutral, statusId: statusIdGatheringFeedback, disableFunding: false, disableExpressions: false, disableVoting: false, disableComments: false, disableIdeaEdits: false },
      { name: T<'app'>('accepted'), nextStatusIds: [], color: this.workflowColorComplete, statusId: statusIdAccepted, disableFunding: false, disableExpressions: false, disableVoting: false, disableComments: false, disableIdeaEdits: false },
      { name: T<'app'>('closed'), nextStatusIds: [], color: this.workflowColorFail, statusId: statusIdClosed, disableFunding: false, disableExpressions: false, disableVoting: false, disableComments: false, disableIdeaEdits: false },
    ]);

    feedback = (await this.feedbackGet())!;
  }

  // Create/modify page
  if (pageType === 'off' && !!feedback.pageAndIndex) {
    this._pageDelete(feedback.pageAndIndex.page.pageId);
  } else if (
    pageType === 'feedback' && !feedback.pageAndIndex?.page.feedback
    || pageType === 'explorer' && !feedback.pageAndIndex?.page.explorer
  ) {
    const roadmap = await this.roadmapGet();

    const pageComponent: Partial<Admin.Page> & (Required<Pick<Admin.Page, 'feedback'>> | Required<Pick<Admin.Page, 'explorer'>>) = pageType === 'feedback' ? {
      feedback: {
        categoryId: feedback.categoryAndIndex.category.categoryId,
        // ENABLE this when we have a knowledge base, also a new method feedbackUpdateWithKnowledgeBase
        // help: {
        //   hideIfEmpty: true,
        //   title: 'Are any of these related?',
        //   search: {
        //     limit: 3,
        //     filterCategoryIds: [
        //       feedback.categoryAndIndex.category.categoryId,
        //       ...(roadmap?.categoryAndIndex.category.categoryId ? [roadmap.categoryAndIndex.category.categoryId] : []),
        //     ],
        //   },
        //   display: {
        //     titleTruncateLines: 1,
        //     descriptionTruncateLines: 4,
        //     responseTruncateLines: 0,
        //     showCommentCount: false,
        //     showCategoryName: false,
        //     showCreated: false,
        //     showAuthor: false,
        //     showStatus: false,
        //     showTags: false,
        //     showVoting: false,
        //     showVotingCount: false,
        //     showFunding: false,
        //     showExpression: false,
        //   },
        // },
        related: {
          panel: {
            hideIfEmpty: true,
            search: {
              limit: 3,
              filterCategoryIds: [
                feedback.categoryAndIndex.category.categoryId,
                ...(!!roadmap ? [roadmap.categoryAndIndex.category.categoryId] : []),
              ],
            },
            display: {
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
            },
          }
        },
        ...getDebate(feedback, roadmap),
      },
    } : {
      explorer: {
        search: {
          filterCategoryIds: [
            feedback.categoryAndIndex.category.categoryId,
            ...(!!roadmap ? [roadmap.categoryAndIndex.category.categoryId] : []),
          ],
        },
        display: {
          titleTruncateLines: 1,
          descriptionTruncateLines: 3,
          responseTruncateLines: 2,
          showCommentCount: true,
          showCategoryName: undefined,
          showCreated: false,
          showAuthor: false,
          showStatus: undefined,
          showTags: true,
          showVoting: false,
          showVotingCount: true,
          showFunding: true,
          showExpression: true,
          showEdit: false,
        },
        allowCreate: {
          actionTitle: T<'app'>('suggest'),
          actionTitleLong: T<'app'>('suggest-an-idea'),
        },
        allowSearch: {
          enableSort: true,
          enableSearchText: true,
          enableSearchByCategory: true,
          enableSearchByStatus: true,
          enableSearchByTag: true,
        },
      }
    };

    if (!feedback.pageAndIndex) {
      const page: PageWithFeedback = {
        pageId: FeedbackPageIdPrefix + randomUuid(),
        name: T<'app'>('feedback'),
        slug: stringToSlug('feedback'),
        icon: 'RecordVoiceOver',
        panels: [],
        board: undefined,
        ...pageComponent,
      };
      const pagesProp = this._get<ConfigEditor.PageGroup>(['layout', 'pages']);
      pagesProp.insert().setRaw(page);
    } else {
      if (!!pageComponent.explorer !== !!feedback.pageAndIndex.page.explorer) {
        this._get<ConfigEditor.Page>(['layout', 'pages', feedback.pageAndIndex.index, 'explorer']).setRaw(pageComponent.explorer);
      }
      if (!!pageComponent.feedback !== !!feedback.pageAndIndex.page.feedback) {
        this._get<ConfigEditor.Page>(['layout', 'pages', feedback.pageAndIndex.index, 'feedback']).setRaw(pageComponent.feedback);
      }
    }

    feedback = (await this.feedbackGet())!;
  }

  if (!!feedback.pageAndIndex) {
    // Add page to menu
    const isInMenu = this.editor.getConfig().layout.menu.some(menu => menu.pageIds.some(pageId => pageId === feedback?.pageAndIndex?.page.pageId));
    if (!isInMenu) {
      const menuProp = this._get<ConfigEditor.ArrayProperty>(['layout', 'menu']);
      (menuProp.insert() as ConfigEditor.ObjectProperty).setRaw(Admin.MenuToJSON({
        menuId: randomUuid(),
        pageIds: [feedback.pageAndIndex!.page.pageId],
      }));
    }

    // Add to landing page
    const landing = await this.landingGet();
    const isInLanding = landing?.pageAndIndex.page.landing.links.some(link => link.linkToPageId === feedback?.pageAndIndex?.page.pageId);
    if (!!landing && !isInLanding) {
      this.landingOn(new Set([feedback.pageAndIndex!.page.pageId]));
    }
  }

  return feedback;
}

function getDebate(feedback: FeedbackInstance, roadmap?: RoadmapInstance): {
  debate: Admin.PageFeedback['debate'],
  debate2: Admin.PageFeedback['debate2'],
} {
  var roadmapDebate: Admin.PageFeedback['debate'];
  if (!!roadmap?.categoryAndIndex.category.categoryId && !!roadmap?.statusIdBacklog) {
    roadmapDebate = {
      panel: {
        title: T<'app'>('see-what-else-were-thinking-about'),
        hideIfEmpty: true,
        search: {
          sortBy: Admin.IdeaSearchSortByEnum.Random,
          limit: 10,
          filterCategoryIds: [roadmap.categoryAndIndex.category.categoryId],
          filterStatusIds: [roadmap.statusIdBacklog],
        },
        display: {
          titleTruncateLines: 2,
          descriptionTruncateLines: 4,
          responseTruncateLines: 0,
          showCommentCount: false,
          showCategoryName: false,
          showCreated: false,
          showAuthor: false,
          showStatus: false,
          showTags: false,
          showVoting: true,
          showVotingCount: false,
          showFunding: false,
          showExpression: false,
        },
      },
    }
  }
  const feedbackDebate: Admin.PageFeedback['debate'] = {
    panel: {
      title: !!roadmapDebate ? T<'app'>('feedback-submitted-by-others') : T<'app'>('see-what-others-are-saying'),
      hideIfEmpty: true,
      search: {
        sortBy: Admin.IdeaSearchSortByEnum.Trending,
        limit: 10,
        filterCategoryIds: [feedback.categoryAndIndex.category.categoryId],
        filterStatusIds: feedback.categoryAndIndex.category.workflow.statuses
          .map(status => status.statusId)
          .filter(statusId => statusId !== feedback.statusIdAccepted),
      },
      display: {
        titleTruncateLines: 2,
        descriptionTruncateLines: 4,
        responseTruncateLines: 0,
        showCommentCount: false,
        showCategoryName: false,
        showCreated: false,
        showAuthor: false,
        showStatus: false,
        showTags: false,
        showVoting: true,
        showVotingCount: false,
        showFunding: false,
        showExpression: false,
      },
    },
  };

  return {
    debate: roadmapDebate || feedbackDebate,
    debate2: !!roadmapDebate ? feedbackDebate : undefined,
  };
}

export async function feedbackUpdateWithRoadmap(this: Templater, roadmap?: RoadmapInstance): Promise<void> {
  const feedback = await this.feedbackGet();
  if (!!feedback) {
    const userMergeableCategoryIdsProp = this._get<ConfigEditor.LinkMultiProperty>(['content', 'categories', feedback.categoryAndIndex.index, 'userMergeableCategoryIds']);
    if (roadmap) {
      userMergeableCategoryIdsProp.insert(roadmap.categoryAndIndex.category.categoryId);
    } else {
      userMergeableCategoryIdsProp.set(new Set([feedback.categoryAndIndex.category.categoryId]));
    }
  }
  if (feedback?.pageAndIndex?.page.explorer) {
    const relatedFilterCategoryIdsProp = this._get<ConfigEditor.LinkMultiProperty>(['layout', 'pages', feedback.pageAndIndex.index, 'explorer', 'search', 'filterCategoryIds']);
    if (roadmap) {
      relatedFilterCategoryIdsProp.insert(roadmap.categoryAndIndex.category.categoryId);
    } else {
      relatedFilterCategoryIdsProp.set(new Set([feedback.categoryAndIndex.category.categoryId]));
    }
  }
  if (feedback?.pageAndIndex?.page.feedback?.related) {
    const relatedFilterCategoryIdsProp = this._get<ConfigEditor.LinkMultiProperty>(['layout', 'pages', feedback.pageAndIndex.index, 'feedback', 'related', 'panel', 'search', 'filterCategoryIds']);
    if (roadmap) {
      relatedFilterCategoryIdsProp.insert(roadmap.categoryAndIndex.category.categoryId);
    } else {
      relatedFilterCategoryIdsProp.set(new Set([feedback.categoryAndIndex.category.categoryId]));
    }
  }
  if (!!feedback?.pageAndIndex?.page.feedback?.debate) {
    const debates = getDebate(feedback, roadmap);
    this._get<ConfigEditor.Page>(['layout', 'pages', feedback.pageAndIndex.index, 'feedback', 'debate'])
      .setRaw(debates.debate);
    this._get<ConfigEditor.Page>(['layout', 'pages', feedback.pageAndIndex.index, 'feedback', 'debate2'])
      .setRaw(debates.debate2);
  }
}
