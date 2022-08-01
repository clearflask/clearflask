// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import jsonwebtoken from 'jsonwebtoken';
import cloneDeep from 'lodash.clonedeep';
import * as ConfigEditor from '../common/config/configEditor';
import { Action, RestrictedActions, TeammatePlanId } from '../common/config/settings/UpgradeWrapper';
import WebNotification from '../common/notification/webNotification';
import { notEmpty } from '../common/util/arrayUtil';
import { isProd } from '../common/util/detectEnv';
import stringToSlug from '../common/util/slugger';
import randomUuid from '../common/util/uuid';
import windowIso from '../common/windowIso';
import { mock } from '../mocker';
import * as Admin from './admin';
import * as Client from './client';

/** Not really a secret, don't bother stealing this */
export const SSO_SECRET_KEY = '63195fc1-d8c0-4909-9039-e15ce3c96dce';

export const SuperAdminEmail = `admin@${windowIso.parentDomain}`;
const termsProjects = 'You can create separate projects each having their own set of users and content';
const TeammatePlan: Admin.Plan = {
  basePlanId: TeammatePlanId, title: 'Teammate',
  perks: [
    { desc: 'External projects' },
    { desc: 'No billing' },
  ],
};
const AvailablePlans: { [planId: string]: Admin.Plan } = {
  'starter3-monthly': {
    basePlanId: 'starter3-monthly', title: 'Starter',
    pricing: { basePrice: 10, baseMau: 0, unitPrice: 0, unitMau: 0, period: Admin.PlanPricingPeriodEnum.Monthly },
    perks: [
      { desc: 'Unlimited projects', terms: termsProjects },
      { desc: 'Unlimited teammates' },
      { desc: 'Unlimited users' },
    ],
  },
  'standard3-monthly': {
    basePlanId: 'standard3-monthly', title: 'Standard',
    pricing: { basePrice: 100, baseMau: 0, unitPrice: 0, unitMau: 0, admins: { amountIncluded: 5, additionalPrice: 25 }, period: Admin.PlanPricingPeriodEnum.Monthly },
    perks: [
      { desc: 'Private projects' },
      { desc: 'Integrations & API' },
      { desc: 'SSO and OAuth' },
    ],
  },
  'flat-yearly': {
    basePlanId: 'flat-yearly', title: 'Business',
    perks: [
      { desc: 'Customized plan' },
      { desc: 'Annual pricing' },
      { desc: 'Support & SLA' },
    ],
  },
};
const AllPlans: { [planId: string]: Admin.Plan } = {
  ...AvailablePlans,
  'pro-lifetime': {
    basePlanId: 'pro-lifetime', title: 'Pro',
    perks: [
      { desc: 'Unlimited users' },
      { desc: '1 Teammate' },
      { desc: '1 Project' },
    ],
  },
};
const FeaturesTable: Admin.FeaturesTable | undefined = {
  plans: ['Starter', 'Standard', 'Flat'],
  features: [
    { feature: 'Projects', values: ['No limit', 'No limit', 'No limit'] },
    { feature: 'Tracked users', values: ['No limit', 'No limit', 'No limit'] },
    { feature: 'Teammates', values: ['1', '8', 'No limit'] },
    { feature: 'Roadmap', values: ['Yes', 'Yes', 'Yes'] },
    { feature: 'Changelog', values: ['Yes', 'Yes', 'Yes'] },
    { feature: 'Credit System', values: ['Yes', 'Yes', 'Yes'] },
    { feature: 'Content customization', values: ['Yes', 'Yes', 'Yes'] },
    { feature: 'Private projects', values: ['No', 'Yes', 'Yes'], terms: 'Create a private project so only authorized users can view and provide feedback.' },
    { feature: 'SSO and OAuth', values: ['No', 'Yes', 'Yes'], terms: 'Use your existing user accounts to log into ClearFlask' },
    { feature: 'Site template', values: ['No', 'Yes', 'Yes'], terms: 'Use your own HTML template to display parts of the site.' },
    { feature: 'Volume discount', values: ['No', 'No', 'Yes'] },
    { feature: 'Billing & Invoicing', values: ['No', 'No', 'Yes'], terms: 'Customized billing and invoicing.' },
  ],
};

interface CommentWithAuthorWithParentPath extends Client.CommentWithVote {
  parentIdPath: string[];
}

interface VoteWithAuthorAndIdeaId extends Client.IdeaVote {
  voterUserId: string;
  ideaId: string;
}

interface VoteWithAuthorAndCommentId {
  vote?: Client.VoteOption;
  voterUserId: string;
  commentId: string;
}

class ServerMock implements Client.ApiInterface, Admin.ApiInterface {
  static instance: ServerMock | undefined;

  readonly BASE_LATENCY = 1000;
  readonly DEFAULT_LIMIT = 10;
  hasLatency: boolean = false;

  // Mock super admin login (server-side cookie data)
  superLoggedIn: boolean = false;
  // Mock account login (server-side cookie data)
  loggedIn: boolean = false;
  account?: Admin.AccountAdmin & {
    planId: string;
    acceptedInvitations: Set<string>;
    acceptedCoupons: Set<string>;
  } = undefined;
  accountPass?: string = undefined;
  // Mock project database
  readonly db: {
    [projectId: string]: {
      loggedInUser?: Admin.UserAdmin; // Mock server-side cookie data
      config: Admin.VersionedConfigAdmin,
      comments: CommentWithAuthorWithParentPath[];
      ideas: Admin.Idea[];
      drafts: Admin.IdeaDraftAdmin[];
      users: Admin.UserAdmin[];
      votes: VoteWithAuthorAndIdeaId[];
      commentVotes: VoteWithAuthorAndCommentId[];
      transactions: Admin.Transaction[];
      balances: { [userId: string]: number };
      notifications: Client.Notification[];
      admins: Array<Admin.ProjectAdmin>;
      invitations: Array<Admin.InvitationAdmin>;
      isExternal: boolean;
    }
  } = {};
  nextCommentId = 10000;

  static get(): ServerMock {
    if (ServerMock.instance === undefined) {
      ServerMock.instance = new ServerMock();
      if (!windowIso.isSsr && !isProd()) {
        windowIso['mock'] = ServerMock.instance;
      }
    }
    return ServerMock.instance;
  }

  setLatency(enabled: boolean) {
    this.hasLatency = enabled;
  }

  supportMessage(request: Admin.SupportMessageRequest): Promise<void> {
    console.log('Received support message with content:', request.supportMessage.content);
    return this.returnLater(undefined);
  }
  plansGet(): Promise<Admin.PlansGetResponse> {
    return this.returnLater({
      plans: Object.values(AvailablePlans),
      featuresTable: FeaturesTable,
    });
  }
  plansGetSuperAdmin(): Promise<Admin.AllPlansGetResponse> {
    return this.returnLater({
      plans: Object.values(AllPlans),
    });
  }
  legalGet(): Promise<Admin.LegalResponse> {
    return this.returnLater({
      terms: 'Here are Terms of Service',
      privacy: 'Here is a privacy policy.',
    });
  }
  accountBindAdmin(request: Admin.AccountBindAdminRequest): Promise<Admin.AccountBindAdminResponse> {
    if (this.loggedIn && this.account) {
      return this.returnLater({
        account: this.account,
        isSuperAdmin: !!this.superLoggedIn || !!this.account.isSuperAdmin,
      });
    }
    if (request.accountBindAdmin.oauthToken) {
      return this.accountSignupAdmin({
        accountSignupAdmin: {
          name: 'Joe Doe',
          email: 'joe-doe@example.com',
          password: 'unused-in-server-mock',
          basePlanId: request.accountBindAdmin.oauthToken.basePlanId || 'standard3-monthly',
          invitationId: request.accountBindAdmin.oauthToken.invitationId,
          couponId: request.accountBindAdmin.oauthToken.couponId,
        }
      }).then(account => ({
        account,
        isSuperAdmin: !!this.superLoggedIn || !!account.isSuperAdmin,
      }));
    }
    return this.returnLater({
      isSuperAdmin: false,
    });
  }
  accountLoginAdmin(request: Admin.AccountLoginAdminRequest): Promise<Admin.AccountAdmin> {
    if (!this.account
      || request.accountLogin.email !== this.account.email
      || request.accountLogin.password !== this.accountPass) {
      return this.throwLater(403, 'Email or password incorrect');
    }
    this.loggedIn = true;
    if (this.account.isSuperAdmin) {
      this.superLoggedIn = true;
    }
    return this.returnLater(this.account);
  }
  accountLoginAsSuperAdmin(request: Admin.AccountLoginAsSuperAdminRequest): Promise<Admin.AccountAdmin> {
    if (!this.superLoggedIn) {
      return this.throwLater(403, 'Not allowed');
    }
    if (!this.account
      || request.accountLoginAs.email !== this.account.email) {
      return this.throwLater(403, 'Email incorrect');
    }
    this.loggedIn = true;
    return this.returnLater(this.account);
  }
  accountSearchSuperAdmin(request: Admin.AccountSearchSuperAdminRequest): Promise<Admin.AccountSearchResponse> {
    if (!this.superLoggedIn) {
      return this.throwLater(403, 'Not allowed');
    }
    return this.returnLater(this.filterCursor([this.account]
      .filter(notEmpty)
      .filter(account => !request.accountSearchSuperAdmin.searchText
        || account.name && account.name.indexOf(request.accountSearchSuperAdmin.searchText) >= 0
        || account.email && account.email.indexOf(request.accountSearchSuperAdmin.searchText) >= 0),
      this.DEFAULT_LIMIT, request.cursor));
  }
  accountViewCouponAdmin(request: Admin.AccountViewCouponAdminRequest): Promise<Admin.ViewCouponResponse> {
    const redeemedByYou = this.account?.acceptedCoupons.has(request.couponId);
    return this.returnLater({
      redeemedByYou,
      plan: (redeemedByYou || request.couponId.length < 3) ? undefined : {
        basePlanId: 'coupon-monthly', title: 'Standard',
        pricing: { basePrice: 0, baseMau: 100, unitPrice: 10, unitMau: 100, period: Admin.PlanPricingPeriodEnum.Monthly },
        perks: [
          { desc: 'Private projects' },
          { desc: 'Teammates' },
          { desc: 'SSO and OAuth' },
        ],
      },
    });
  }
  accountAcceptCouponAdmin(request: Admin.AccountAcceptCouponAdminRequest): Promise<Admin.AccountAdmin> {
    if (!this.account) return this.throwLater(403, 'Not logged in');
    this.account?.acceptedCoupons.add(request.couponId);
    return this.returnLater(this.account);
  }
  couponGenerateSuperAdmin(request: Admin.CouponGenerateSuperAdminRequest): Promise<Admin.FileDownload> {
    if (!this.superLoggedIn) {
      return this.throwLater(403, 'Not allowed');
    }
    return this.returnLater({
      filename: `coupons.txt`,
      contentType: 'text/plain',
      blob: new Blob(['COUPON1\nCOUPON2\nCOUPON3\n'], { type: 'text/plain' }),
    }, undefined);
  }
  accountLogoutAdmin(): Promise<void> {
    this.loggedIn = false;
    this.superLoggedIn = false;
    return this.returnLater(undefined);
  }
  accountSignupAdmin(request: Admin.AccountSignupAdminRequest): Promise<Admin.AccountAdmin> {
    const account: Admin.AccountAdmin = {
      accountId: randomUuid(),
      basePlanId: (request.accountSignupAdmin.invitationId
        ? TeammatePlanId
        : (request.accountSignupAdmin.couponId
          ? 'pro-lifetime'
          : request.accountSignupAdmin.basePlanId))
        || 'standard3-monthly',
      name: request.accountSignupAdmin.name,
      email: request.accountSignupAdmin.email,
      isSuperAdmin: request.accountSignupAdmin.email === SuperAdminEmail || undefined,
      cfJwt: jsonwebtoken.sign({
        guid: request.accountSignupAdmin.email,
        email: request.accountSignupAdmin.email,
        name: request.accountSignupAdmin.name,
      }, SSO_SECRET_KEY),
      // subscriptionStatus: Admin.SubscriptionStatus.Active,
      subscriptionStatus: (request.accountSignupAdmin.invitationId || request.accountSignupAdmin.couponId)
        ? Admin.SubscriptionStatus.Active
        : Admin.SubscriptionStatus.ActiveTrial,
    };
    this.accountPass = request.accountSignupAdmin.password;
    this.account = {
      planId: account.basePlanId,
      acceptedInvitations: new Set(request.accountSignupAdmin.invitationId ? [request.accountSignupAdmin.invitationId] : []),
      acceptedCoupons: new Set(request.accountSignupAdmin.couponId ? [request.accountSignupAdmin.couponId] : []),
      ...account
    };
    if (request.accountSignupAdmin.invitationId) {
      // Create external project
      this.getProject(request.accountSignupAdmin.invitationId).isExternal = true;
    }
    this.loggedIn = true;
    if (this.account.isSuperAdmin) {
      this.superLoggedIn = true;
    }
    return this.returnLater(account);
  }
  gitHubGetReposAdmin(request: Admin.GitHubGetReposAdminRequest): Promise<Admin.AvailableRepos> {
    return this.returnLater({
      repos: [
        { name: 'clearflask/clearflask', installationId: 321, repositoryId: 123 },
      ],
    });
  }
  accountDeleteAdmin(): Promise<void> {
    if (!this.account) return this.throwLater(403, 'Not logged in');
    this.loggedIn = false;
    Object.keys(this.db).forEach(projectId => delete this.db[projectId]);
    this.account = undefined;
    this.accountPass = undefined;
    return this.returnLater(undefined);
  }
  accountUpdateAdmin(request: Admin.AccountUpdateAdminRequest): Promise<Admin.AccountAdmin> {
    if (!this.account) return this.throwLater(403, 'Not logged in');
    if (request.accountUpdateAdmin.name) this.account.name = request.accountUpdateAdmin.name;
    if (request.accountUpdateAdmin.email) this.account.email = request.accountUpdateAdmin.email;
    if (request.accountUpdateAdmin.password) this.accountPass = request.accountUpdateAdmin.password;
    if (request.accountUpdateAdmin.paymentToken) this.account.subscriptionStatus = Admin.SubscriptionStatus.Active;
    if (!!request.accountUpdateAdmin.cancelEndOfTerm) this.account.subscriptionStatus = Admin.SubscriptionStatus.ActiveNoRenewal;
    if (!!request.accountUpdateAdmin.resume) this.account.subscriptionStatus = Admin.SubscriptionStatus.Active;
    if (request.accountUpdateAdmin.basePlanId) {
      this.account.planId = request.accountUpdateAdmin.basePlanId;
      this.account.basePlanId = request.accountUpdateAdmin.basePlanId;
    };
    if (request.accountUpdateAdmin.apiKey) {
      this.account.apiKey = request.accountUpdateAdmin.apiKey;
      if (RestrictedActions[this.account.basePlanId]?.has(Action.API_KEY)) {
        // Auto-upgrade test, simulate Java-land background upgrade
        setTimeout(() => {
          if (this.account) {
            this.account.planId = 'standard3-monthly';
            this.account.basePlanId = 'standard3-monthly';
          }
        }, 500);
      }
    }
    if (!!request.accountUpdateAdmin.attrs) {
      this.account.attrs = {
        ...(this.account.attrs || {}),
        ...request.accountUpdateAdmin.attrs,
      };
    }
    return this.returnLater(this.account);
  }
  accountAttrsUpdateAdmin(request: Admin.AccountAttrsUpdateAdminRequest): Promise<Admin.AccountAdmin> {
    if (!this.account) return this.throwLater(403, 'Not logged in');
    if (!!request.accountAttrsUpdateAdmin.attrs) {
      this.account.attrs = {
        ...(this.account.attrs || {}),
        ...request.accountAttrsUpdateAdmin.attrs,
      };
    }
    return this.returnLater(this.account);
  }
  accountUpdateSuperAdmin(request: Admin.AccountUpdateSuperAdminRequest): Promise<Admin.AccountAdmin> {
    if (!this.account) return this.throwLater(403, 'Not logged in');
    if (request.accountUpdateSuperAdmin.changeToFlatPlanWithYearlyPrice !== undefined) {
      const basePlanId = 'flat-yearly';
      const newPlanId = `${basePlanId}-${Math.round(Math.random() * 1000)}`;
      AllPlans[newPlanId] = {
        ...AllPlans[basePlanId],
        pricing: request.accountUpdateSuperAdmin.changeToFlatPlanWithYearlyPrice > 0 ? {
          period: Admin.PlanPricingPeriodEnum.Yearly,
          basePrice: request.accountUpdateSuperAdmin.changeToFlatPlanWithYearlyPrice,
          baseMau: 0,
          unitPrice: 0,
          unitMau: 0,
        } : undefined,
      };
      this.account.planId = newPlanId;
      this.account.basePlanId = basePlanId;
    };
    if (request.accountUpdateSuperAdmin.addons !== undefined) {
      this.account.addons = {
        ...this.account.addons,
        ...request.accountUpdateSuperAdmin.addons,
      };
    };
    return this.returnLater(this.account);
  }
  accountViewInvitationAdmin(request: Admin.AccountViewInvitationAdminRequest): Promise<Admin.InvitationResult> {
    return this.returnLater({
      inviteeName: 'John Doe',
      projectName: 'My project',
      role: Admin.InvitationResultRoleEnum.Admin,
      isAcceptedByYou: this.account?.acceptedInvitations.has(request.invitationId),
    });
  }
  accountAcceptInvitationAdmin(request: Admin.AccountAcceptInvitationAdminRequest): Promise<Admin.AccountAcceptInvitationResponse> {
    if (!this.account) return this.throwLater(403, 'Not logged in');
    this.account.acceptedInvitations.add(request.invitationId);
    this.getProject(request.invitationId); // Create project
    return this.returnLater({ projectId: request.invitationId });
  }
  projectAdminsInviteAdmin(request: Admin.ProjectAdminsInviteAdminRequest): Promise<Admin.ProjectAdminsInviteResult> {
    const invitation: Admin.InvitationAdmin = {
      invitationId: randomUuid(),
      email: request.email,
    };
    const project = this.getProject(request.projectId);
    project.invitations.push(invitation);
    return this.returnLater({ invitation: invitation });
  }
  projectAdminsListAdmin(request: Admin.ProjectAdminsListAdminRequest): Promise<Admin.ProjectAdminsListResult> {
    return this.returnLater({
      admins: this.getProject(request.projectId).admins,
      invitations: this.getProject(request.projectId).invitations,
    });
  }
  projectAdminsRemoveAdmin(request: Admin.ProjectAdminsRemoveAdminRequest): Promise<void> {
    const project = this.getProject(request.projectId);
    if (request.accountId) project.admins = project.admins
      .filter(admin => admin.accountId !== request.accountId);
    if (request.invitationId) project.invitations = project.invitations
      .filter(invitation => invitation.invitationId !== request.invitationId);
    return this.returnLater(undefined);
  }
  accountBillingAdmin(): Promise<Admin.AccountBilling> {
    if (!this.account) return this.throwLater(403, 'Not logged in');
    const billingPeriodEnd = new Date();
    billingPeriodEnd.setDate(billingPeriodEnd.getDate() + 3);
    const invoiceDate = new Date();
    invoiceDate.setDate(invoiceDate.getDate() - 24);
    return this.returnLater({
      plan: this.account.planId === TeammatePlanId ? TeammatePlan : AllPlans[this.account.planId]!,
      subscriptionStatus: this.account.subscriptionStatus,
      payment: (this.account.subscriptionStatus === Admin.SubscriptionStatus.ActiveTrial
        || this.account.subscriptionStatus === Admin.SubscriptionStatus.NoPaymentMethod) ? undefined : {
        brand: 'mastercard',
        last4: "4242",
        expiryMonth: 7,
        expiryYear: 2032,
      },
      billingPeriodEnd: this.account.subscriptionStatus === Admin.SubscriptionStatus.ActiveTrial ? undefined : billingPeriodEnd,
      trackedUsers: 341,
      postCount: 32,
      availablePlans: Object.values(AvailablePlans).filter(p => p.basePlanId !== 'flat-yearly'),
      invoices: {
        cursor: 'one more',
        results: [{
          date: invoiceDate,
          status: 'paid',
          amount: 300,
          description: "Enterprise plan monthly",
          invoiceId: 'a5423e91-2df7-4a04-b38c-9919b0c160cd',
        }],
      },
      accountReceivable: 75,
      accountPayable: 0,
      endOfTermChangeToPlan: Object.values(AvailablePlans).find(p => p.basePlanId !== this.account!.basePlanId),
      paymentActionRequired: {
        actionType: 'stripe-next-action',
        actionData: {
          'paymentIntentClientSecret': 'client-secret',
        }
      },
    });
  }
  accountBillingSyncPaymentsAdmin(): Promise<void> {
    return this.returnLater(undefined);
  }
  accountCreditAdjustmentSuperAdmin(request: Admin.AccountCreditAdjustmentSuperAdminRequest): Promise<void> {
    if (!this.superLoggedIn) {
      return this.throwLater(403, 'Not allowed');
    }
    return this.returnLater(undefined);
  }
  invoicesSearchAdmin(request: Admin.InvoicesSearchAdminRequest): Promise<Admin.Invoices> {
    const invoiceDate = new Date();
    invoiceDate.setDate(invoiceDate.getDate() - 24);
    return this.returnLater({
      cursor: request.cursor ? undefined : 'cursor',
      results: request.cursor ? [] : [{
        date: invoiceDate,
        status: 'paid',
        amount: 300,
        description: 'Enterprise plan monthly',
        invoiceId: 'a5423e91-2df7-4a04-b38c-9919b0c160cd',
      }],
    });
  }
  invoiceHtmlGetAdmin(request: Admin.InvoiceHtmlGetAdminRequest): Promise<Admin.InvoiceHtmlResponse> {
    if (request.invoiceId === 'a5423e91-2df7-4a04-b38c-9919b0c160cd') {
      return this.returnLater({
        invoiceHtml: "This is an invoice <b>test</b>",
      });
    }
    return this.throwLater(404, 'Invoice does not exist');
  }
  commentCreate(request: Client.CommentCreateRequest): Promise<Client.Comment> {
    var loggedInUser;
    if (request.commentCreate['author']) {
      // Data mocking shortcut
      loggedInUser = request.commentCreate['author'];
    } else {
      loggedInUser = this.getProject(request.projectId).loggedInUser;
    }
    if (!loggedInUser) return this.throwLater(403, 'Not logged in');
    const parentComment = request.commentCreate.parentCommentId && this.getProject(request.projectId).comments.find(c => c.commentId === request.commentCreate.parentCommentId)!;
    const parentIdPath = request.commentCreate.parentCommentId && parentComment
      ? [
        ...parentComment.parentIdPath,
        request.commentCreate.parentCommentId,
      ]
      : []
    const comment: CommentWithAuthorWithParentPath = {
      ideaId: request.ideaId,
      commentId: '' + (this.nextCommentId++),
      authorUserId: loggedInUser.userId,
      authorName: loggedInUser.name,
      authorIsMod: loggedInUser.isMod,
      created: new Date(),
      parentIdPath: parentIdPath,
      childCommentCount: 0,
      voteValue: 1,
      ...(request.commentCreate),
    };
    parentComment && parentComment.childCommentCount++;
    const idea = this.getProject(request.projectId).ideas.find(idea => idea.ideaId === request.ideaId)!;
    idea.commentCount++;
    if (!comment.parentCommentId) {
      idea.childCommentCount++;
    }
    this.getProject(request.projectId).comments.push(comment);
    this.getProject(request.projectId).commentVotes.push({
      voterUserId: loggedInUser.userId,
      commentId: comment.commentId,
      vote: Client.VoteOption.Upvote,
    });
    return this.returnLater({
      ...comment,
      vote: Client.VoteOption.Upvote,
    });
  }
  commentDelete(request: Client.CommentDeleteRequest): Promise<Client.CommentWithVote> {
    return this.commentDeleteAdmin(request);
  }
  ideaGetAll(request: Client.IdeaGetAllRequest): Promise<Client.IdeaGetAllResponse> {
    const loggedInUser = this.getProject(request.projectId).loggedInUser;
    return this.returnLater({
      results: request.ideaGetAll.postIds.map(ideaId => {
        const idea = this.getProject(request.projectId).ideas.find(idea => idea.ideaId === ideaId);
        if (!idea) return undefined;
        const vote = loggedInUser ? this.getProject(request.projectId).votes.find(vote => vote.ideaId === idea.ideaId && vote.voterUserId === loggedInUser.userId) : undefined;
        return { ...idea, vote: vote || {} };
      }).filter(notEmpty),
    });
  }
  mockMergedPostAsComment(parentIdeaId: string, mergedIdea: Admin.Idea): CommentWithAuthorWithParentPath {
    return {
      parentIdPath: [],
      ideaId: parentIdeaId,
      commentId: mergedIdea.ideaId,
      childCommentCount: mergedIdea.childCommentCount,
      authorUserId: mergedIdea.authorUserId,
      authorName: mergedIdea.authorName,
      authorIsMod: mergedIdea.authorIsMod,
      created: mergedIdea.created,
      mergedPostId: mergedIdea.ideaId,
      mergedPostTitle: mergedIdea.title,
      mergedTime: mergedIdea.mergedToPostTime,
      content: mergedIdea.description,
      voteValue: mergedIdea.voteValue || 0,
    };
  }
  ideaCommentSearch(request: Client.IdeaCommentSearchRequest): Promise<Client.IdeaCommentSearchResponse> {
    const idea: Admin.Idea = this.getImmutable(
      this.getProject(request.projectId).ideas,
      idea => idea.ideaId === request.ideaId);
    const minCommentIdToExclude: string | '' = [
      ...(request.ideaCommentSearch.excludeChildrenCommentIds || []),
      ...(request.ideaCommentSearch.parentCommentId ? [request.ideaCommentSearch.parentCommentId] : []),
    ].reduce((l, r) => l > r ? l : r, '');
    const loggedInUser = this.getProject(request.projectId).loggedInUser;
    const mergedPostComments = (idea.mergedPostIds || [])
      .map(postId => this.getProject(request.projectId).ideas.find(i => i.ideaId === postId))
      .filter(notEmpty)
      .map(post => this.mockMergedPostAsComment(idea.ideaId, post));
    const data = this.sort([...mergedPostComments, ...this.getProject(request.projectId).comments
      .filter(comment => request.ideaId === comment.ideaId)
      .filter(comment => !request.ideaCommentSearch.parentCommentId || (comment.parentIdPath && comment.parentIdPath.includes(request.ideaCommentSearch.parentCommentId)))
      .filter(comment => !request.ideaCommentSearch.excludeChildrenCommentIds ||
        !request.ideaCommentSearch.excludeChildrenCommentIds.some(ec =>
          ec === comment.commentId
          || comment.parentIdPath.some(pc => ec === pc)))
      .filter(comment => !minCommentIdToExclude || comment.commentId > minCommentIdToExclude)
    ].map(comment => {
      return {
        ...comment,
        author: comment.authorUserId ? this.getProject(request.projectId).users.find(user => user.userId === comment.authorUserId)! : undefined,
        vote: loggedInUser ? this.getProject(request.projectId).commentVotes.find(vote => vote.voterUserId === comment.commentId && vote.voterUserId === loggedInUser.userId) : undefined,
      }
    }), [(l, r) => l.created.getTime() - r.created.getTime()]);
    return this.returnLater({
      results: data.slice(0, Math.min(data.length, 10)),
    });
  }
  commentSearch(request: Client.CommentSearchRequest): Promise<Client.CommentSearchResponse> {
    return this.returnLater(this.filterCursor(this.sort(this.getProject(request.projectId).comments
      .filter(comment => comment.authorUserId === request.commentSearch.filterAuthorId)
      , [(l, r) => l.created.getTime() - r.created.getTime()])
      , request.commentSearch.limit || this.DEFAULT_LIMIT, request.cursor));
  }
  commentUpdate(request: Client.CommentUpdateRequest): Promise<Client.CommentWithVote> {
    const comment: CommentWithAuthorWithParentPath = this.getImmutable(
      this.getProject(request.projectId).comments,
      comment => comment.commentId === request.commentId);
    comment.content = request.commentUpdate.content;
    comment.edited = new Date();
    return this.returnLater(comment);
  }
  commentSearchAdmin(request: Admin.CommentSearchAdminRequest): Promise<Admin.CommentSearchAdminResponse> {
    return this.returnLater(this.filterCursor(this.getProject(request.projectId).comments
      .filter(comment => !request.commentSearchAdmin.searchText
        || comment.authorName && comment.authorName.indexOf(request.commentSearchAdmin.searchText) >= 0
        || comment.content && comment.content.indexOf(request.commentSearchAdmin.searchText) >= 0)
      , request.commentSearchAdmin.limit || this.DEFAULT_LIMIT, request.cursor));
  }
  transactionSearch(request: Client.TransactionSearchRequest): Promise<Client.TransactionSearchResponse> {
    const loggedInUser = this.getProject(request.projectId).loggedInUser;
    if (!loggedInUser) return this.throwLater(403, 'Not logged in');
    if (request.transactionSearch.filterAmountMax !== undefined
      || request.transactionSearch.filterAmountMin !== undefined
      || request.transactionSearch.filterCreatedEnd !== undefined
      || request.transactionSearch.filterCreatedStart !== undefined
      || request.transactionSearch.filterTransactionTypes !== undefined
    ) throw new Error("Filters not implemented.");
    const balance = this.getProject(request.projectId).balances[loggedInUser.userId] || 0;
    const transactions = this.getProject(request.projectId).transactions.filter(t => t.userId === loggedInUser.userId);
    transactions.sort((l, r) => r.created.valueOf() - l.created.valueOf());
    return this.returnLater({
      ...this.filterCursor<Client.Transaction>(transactions, 10, request.cursor),
      balance: { balance },
    });
  }
  creditIncome(request: Admin.CreditIncomeRequest): Promise<void> {
    throw new Error("Method not implemented.");
  }
  ideaCreate(request: Client.IdeaCreateRequest): Promise<Client.IdeaWithVote> {
    return this.ideaCreateAdmin({
      projectId: request.projectId,
      ideaCreateAdmin: {
        ...request.ideaCreate,
        statusId: this.getProject(request.projectId).config.config.content.categories
          .find(c => c.categoryId === request.ideaCreate.categoryId)!.workflow.entryStatus
      },
    });
  }
  ideaDelete(request: Client.IdeaDeleteRequest): Promise<void> {
    return this.ideaDeleteAdmin(request);
  }
  ideaGet(request: Client.IdeaGetRequest): Promise<Client.IdeaWithVote> {
    const idea = this.getProject(request.projectId).ideas.find(idea => idea.ideaId === request.ideaId);
    if (!idea) return this.throwLater(404, 'Idea not found');
    const loggedInUser = this.getProject(request.projectId).loggedInUser;
    const vote = loggedInUser ? this.getProject(request.projectId).votes.find(vote => vote.ideaId === idea.ideaId && vote.voterUserId === loggedInUser.userId) : undefined;
    return this.returnLater({ ...idea, vote: vote || {} });
  }
  ideaSearch(request: Client.IdeaSearchRequest): Promise<Client.IdeaWithVoteSearchResponse> {
    return this.ideaSearchGeneric({
      ...request,
      ideaSearchAdmin: {
        ...request.ideaSearch as any,
      },
    });
  }
  ideaSearchAdmin(request: Admin.IdeaSearchAdminRequest): Promise<Admin.IdeaSearchResponse> {
    return this.ideaSearchGeneric(request);
  }
  ideaSearchGeneric(request: Admin.IdeaSearchAdminRequest): Promise<Client.IdeaWithVoteSearchResponse> {
    var searchText;
    if (!!request.ideaSearchAdmin.similarToIdeaId) {
      const idea = this.getProject(request.projectId).ideas.find(idea => idea.ideaId === request.ideaSearchAdmin.similarToIdeaId);
      if (!idea) return this.throwLater(404, 'Idea not found');
      searchText = idea.title.split(' ')[0] || '';
    } else {
      searchText = request.ideaSearchAdmin.searchText;
    }
    const allIdeas: Admin.Idea[] = this.getProject(request.projectId).ideas;
    const ideas: Admin.Idea[] = request.ideaSearchAdmin.fundedByMeAndActive
      ? this.getProject(request.projectId).votes
        .filter(v => v.fundAmount && v.fundAmount > 0)
        .map(v => allIdeas.find(i => i.ideaId === v.ideaId)!)
      : allIdeas;
    const categories = this.getProject(request.projectId).config.config.content.categories;
    return this.returnLater(this.filterCursor(this.sort(ideas
      .filter(idea => request.ideaSearchAdmin.filterAuthorId === undefined
        || (idea.authorUserId === request.ideaSearchAdmin.filterAuthorId))
      .filter(idea => !request.ideaSearchAdmin.fundedByMeAndActive
        || !idea.statusId
        || categories.find(c => c.categoryId === idea.categoryId)!
          .workflow
          .statuses
          .find(s => s.statusId === idea.statusId)!
          .disableFunding !== true)
      .filter(idea => request.ideaSearchAdmin.filterCreatedStart === undefined
        || (idea.created >= request.ideaSearchAdmin.filterCreatedStart))
      .filter(idea => request.ideaSearchAdmin.similarToIdeaId === undefined
        || (idea.ideaId !== request.ideaSearchAdmin.similarToIdeaId))
      .filter(idea => request.ideaSearchAdmin.filterCreatedEnd === undefined
        || (idea.created <= request.ideaSearchAdmin.filterCreatedEnd))
      .filter(idea => !request.ideaSearchAdmin.filterTagIds
        || request.ideaSearchAdmin.filterTagIds.length === 0
        || (request.ideaSearchAdmin.filterTagIds.filter(tagId => idea.tagIds && idea.tagIds.includes(tagId)).length > 0
          !== !!request.ideaSearchAdmin.invertTag))
      .filter(idea => !request.ideaSearchAdmin.filterCategoryIds
        || (request.ideaSearchAdmin.filterCategoryIds.includes(idea.categoryId)
          !== !!request.ideaSearchAdmin.invertCategory))
      .filter(idea => request.ideaSearchAdmin.filterStatusIds === undefined
        || request.ideaSearchAdmin.filterStatusIds.length === 0
        || ((idea.statusId && request.ideaSearchAdmin.filterStatusIds.includes(idea.statusId))
          !== !!request.ideaSearchAdmin.invertStatus))
      .filter(idea => searchText === undefined
        || idea.title.indexOf(searchText) >= 0
        || (idea.description || '').indexOf(searchText) >= 0)
      .map(idea => {
        const loggedInUser = this.getProject(request.projectId).loggedInUser;
        const vote = loggedInUser ? this.getProject(request.projectId).votes.find(vote => vote.ideaId === idea.ideaId && vote.voterUserId === loggedInUser.userId) : undefined;
        return { ...idea, vote: vote || {} };
      })
      , [(l, r) => {
        switch (request.ideaSearchAdmin.sortBy) {
          default: case Admin.IdeaSearchAdminSortByEnum.Trending: return this.calcTrendingScore(r) - this.calcTrendingScore(l);
          case Admin.IdeaSearchAdminSortByEnum.Top: return (this.calcScore(r) - this.calcScore(l));
          case Admin.IdeaSearchAdminSortByEnum.New: return r.created.getTime() - l.created.getTime();
          case Admin.IdeaSearchAdminSortByEnum.Random: return Math.random() - 0.5;
          case Admin.IdeaSearchAdminSortByEnum.DragAndDrop: return (r.order || r.created.getTime()) - (l.order || l.created.getTime());
        }
      }])
      , request.ideaSearchAdmin.limit || this.DEFAULT_LIMIT, request.cursor), 1000);
  }
  ideaHistogramAdmin(request: Admin.IdeaHistogramAdminRequest): Promise<Admin.HistogramResponse> {
    return this.genericHistogramAdmin(request.projectId, request.ideaHistogramSearchAdmin);
  }
  commentHistogramAdmin(request: Admin.CommentHistogramAdminRequest): Promise<Admin.HistogramResponse> {
    return this.genericHistogramAdmin(request.projectId, request.histogramSearchAdmin);
  }
  userHistogramAdmin(request: Admin.UserHistogramAdminRequest): Promise<Admin.HistogramResponse> {
    return this.genericHistogramAdmin(request.projectId, request.histogramSearchAdmin);
  }
  genericHistogramAdmin(projectId: string, search: Admin.HistogramSearchAdmin): Promise<Admin.HistogramResponse> {
    var start = search.filterCreatedStart;
    var end = search.filterCreatedEnd;
    if (!end) end = new Date();
    if (!start) start = new Date(end.getTime() - 600 * 86400000);

    var currDay: Date = new Date(start);
    const results: Admin.HistogramResponse = {
      points: [],
      hits: {
        value: Math.round(Math.random() * 100 + 40),
      },
    };
    var intervalInDays: number;
    switch (search.interval) {
      default:
      case 'DAY':
        intervalInDays = 1;
        break;
      case 'WEEK':
        intervalInDays = 7;
        break;
      case 'MONTH':
        intervalInDays = 30;
        break;
      case 'QUARTER':
        intervalInDays = 90;
        break;
      case 'YEAR':
        intervalInDays = 365;
        break;
    }
    while (currDay.getTime() < end.getTime()) {
      results.points.push({ ts: currDay, cnt: Math.round(Math.random() * 10) });
      currDay = new Date(currDay.getTime() + intervalInDays * 86400000);
    }

    return this.returnLater(results, undefined);
  }
  ideaCategoryAggregateAdmin(request: Admin.IdeaCategoryAggregateAdminRequest): Promise<Admin.IdeaAggregateResponse> {
    const project = this.getProject(request.projectId);
    if (!project) return this.throwLater(404, 'Project not found');
    const results: Admin.IdeaAggregateResponse = {
      total: 0,
      statuses: {},
      tags: {},
    };
    this.getProject(request.projectId).ideas
      .filter(idea => idea.categoryId === request.categoryId)
      .forEach(idea => {
        results.total++;
        if (idea.statusId) results.statuses[idea.statusId] = (results.statuses[idea.statusId] || 0) + 1;
        idea.tagIds.forEach(tagId => {
          results.tags[tagId] = (results.tags[tagId] || 0) + 1;
        });
      });
    return this.returnLater(results);
  }
  ideaUpdate(request: Client.IdeaUpdateRequest): Promise<Client.Idea> {
    return this.ideaUpdateAdmin({
      ...request,
      ideaUpdateAdmin: {
        ...request.ideaUpdate,
      },
    });
  }
  async configBindSlug(request: Client.ConfigBindSlugRequest): Promise<Client.ConfigBindSlugResult> {
    const project = await this.getProjectBySlug(request.slug);
    if (!project) return this.throwLater(404, 'Project does not exist or was deleted by owner');
    return this.returnLater({
      projectId: project.config.config.projectId,
      config: project.config,
    });
  }
  async userBindSlug(request: Client.UserBindSlugRequest): Promise<Client.UserBindResponse> {
    const project = await this.getProjectBySlug(request.slug);
    if (!project) return this.throwLater(404, 'Project does not exist or was deleted by owner');
    return this.userBind({
      projectId: project.config.config.projectId,
      ...request,
    });
  }
  async configAndUserBindSlug(request: Client.ConfigAndUserBindSlugRequest): Promise<Client.ConfigAndUserBindSlugResult> {
    const project = await this.getProjectBySlug(request.slug);
    if (!project) return this.throwLater(404, 'Project does not exist or was deleted by owner');

    const configGet = await this.configBindSlug(request);
    const userBind = await this.userBindSlug(request);

    return this.returnLater({
      projectId: project.config.config.projectId,
      config: configGet.config,
      user: userBind.user,
    });
  }
  userCreate(request: Client.UserCreateRequest): Promise<Client.UserCreateResponse> {
    if (request.userCreate.email && this.getProject(request.projectId).users.some(u => u.email === request.userCreate.email)) {
      return this.returnLater({ requiresEmailLogin: true });
    }
    if ((this.getProject(request.projectId).config.config.users.onboarding.notificationMethods.email?.verification === Client.EmailSignupVerificationEnum.Required
      || this.getProject(request.projectId).config.config.users.onboarding.notificationMethods.email?.allowedDomains !== undefined)
      && request.userCreate.email
      && request.userCreate.emailVerification !== '123456') {
      return this.returnLater({ requiresEmailVerification: true });
    }
    return this.userCreateAdmin({
      projectId: request.projectId,
      userCreateAdmin: {
        ...{ emailVerified: request.userCreate.emailVerification },
        ...request.userCreate,
      },
    }).then(user => {
      this.getProject(request.projectId).loggedInUser = user;
      return {
        user,
      };
    });
  }
  userDelete(request: Client.UserDeleteRequest): Promise<void> {
    const loggedInUser = this.getProject(request.projectId).loggedInUser;
    if (!loggedInUser) return this.throwLater(403, 'Not logged in');
    const userIdIndex = this.getProject(request.projectId).users.findIndex(user => user.userId === loggedInUser.userId);
    if (userIdIndex) {
      this.getProject(request.projectId).users.splice(userIdIndex, 1);
    }
    this.getProject(request.projectId).loggedInUser = undefined;
    return this.returnLater(undefined);
  }
  async userBind(request: Client.UserBindRequest): Promise<Client.UserBindResponse> {
    const project = this.getProject(request.projectId);
    if (!project) return this.throwLater(404, 'Project not found');
    const loggedInUser = project.loggedInUser;
    if (request.userBind.ssoToken) {
      var token;
      try {
        token = jsonwebtoken.verify(request.userBind.ssoToken, SSO_SECRET_KEY);
      } catch (er) {
        console.log('Failed parsing ssoToken', er);
      }
      if (token && token['email']) {
        const user = project.users.find(user => user.email === token['email']);
        if (user) {
          project.loggedInUser = user;
        } else {
          await this.userCreate({
            projectId: project.config.config.projectId,
            userCreate: {
              email: token['email'],
              name: token['name'],
              ...{
                isExternal: true,
              },
            },
          });
        }
      }
    }
    return this.returnLater({
      user: loggedInUser ? {
        ...loggedInUser,
        balance: project.balances[loggedInUser.userId] || 0,
      } : undefined,
    });
  }
  async verifySsoTokenIfExists(project, ssoToken?: string) {
  }
  forgotPassword(request: Client.ForgotPasswordRequest): Promise<void> {
    return this.returnLater(undefined);
  }
  userLogin(request: Client.UserLoginRequest): Promise<Client.UserMeWithBalance> {
    const user = this.getProject(request.projectId).users.find(user => user.email === request.userLogin.email);
    if (!user) return this.throwLater(404, 'Incorrect email or password');
    if (!!request.userLogin.password) {
      if (user['password'] !== request.userLogin.password) return this.throwLater(403, 'Incorrect email or password');
    } else if (!!request.userLogin.token) {
      if (request.userLogin.token !== '123456') return this.throwLater(403, 'Incorrect token');
    } else {
      this.throwLater(403, 'Password or token must be supplied');
    }
    this.getProject(request.projectId).loggedInUser = user;
    return this.returnLater(user);
  }
  userLogout(request: Client.UserLogoutRequest): Promise<void> {
    this.getProject(request.projectId).loggedInUser = undefined;
    return this.returnLater(undefined);
  }
  userUpdate(request: Client.UserUpdateRequest): Promise<Client.UserMeWithBalance> {
    const user: Admin.UserAdmin = this.getImmutable(
      this.getProject(request.projectId).users,
      user => user.userId === request.userId);
    if (request.userUpdate.name !== undefined) user.name = request.userUpdate.name;
    if (request.userUpdate.email !== undefined) user.email = request.userUpdate.email === '' ? undefined : request.userUpdate.email;
    if (request.userUpdate.emailNotify !== undefined) user.emailNotify = request.userUpdate.emailNotify;
    if (request.userUpdate.password !== undefined) {
      user.hasPassword = true;
    }
    if (request.userUpdate.iosPushToken !== undefined) {
      user.iosPush = request.userUpdate.iosPushToken !== '';
    };
    if (request.userUpdate.androidPushToken !== undefined) {
      user.androidPush = request.userUpdate.androidPushToken !== '';
    };
    if (request.userUpdate.browserPushToken !== undefined) {
      user.browserPush = request.userUpdate.browserPushToken !== '';
    };
    return this.returnLater(user);
  }
  ideaVoteGetOwn(request: Client.IdeaVoteGetOwnRequest): Promise<Client.IdeaVoteGetOwnResponse> {
    const loggedInUser = this.getProject(request.projectId).loggedInUser;
    if (!loggedInUser) return this.throwLater(403, 'Not logged in');
    const votes = this.getProject(request.projectId).votes.filter(vote => vote.voterUserId === loggedInUser.userId && request.ideaIds.includes(vote.ideaId));
    return this.returnLater({
      votesByIdeaId: votes.filter(vote => vote.vote).reduce((map, vote) => {
        map[vote.ideaId] = vote.vote;
        return map;
      }, {}),
      expressionByIdeaId: votes.filter(vote => vote.expression).reduce((map, vote) => {
        map[vote.ideaId] = vote.expression;
        return map;
      }, {}),
      fundAmountByIdeaId: votes.filter(vote => vote.fundAmount).reduce((map, vote) => {
        map[vote.ideaId] = vote.fundAmount;
        return map;
      }, {}),
    });
  }
  commentVoteGetOwn(request: Client.CommentVoteGetOwnRequest): Promise<Client.CommentVoteGetOwnResponse> {
    const loggedInUser = this.getProject(request.projectId).loggedInUser;
    if (!loggedInUser) return this.throwLater(403, 'Not logged in');
    const votes = this.getProject(request.projectId).commentVotes.filter(vote => vote.voterUserId === loggedInUser.userId && request.commentIds.includes(vote.commentId));
    return this.returnLater({
      votesByCommentId: votes.filter(vote => vote.vote).reduce((map, vote) => {
        map[vote.commentId] = vote.vote;
        return map;
      }, {}),
    });
  }
  notificationClear(request: Client.NotificationClearRequest): Promise<void> {
    const loggedInUser = this.getProject(request.projectId).loggedInUser;
    if (!loggedInUser) return this.throwLater(403, 'Not logged in');
    this.getProject(request.projectId).notifications = this.getProject(request.projectId).notifications
      .filter(notification => notification.userId !== loggedInUser.userId
        || notification.notificationId !== request.notificationId);
    return this.returnLater(undefined);
  }
  notificationClearAll(request: Client.NotificationClearAllRequest): Promise<void> {
    const loggedInUser = this.getProject(request.projectId).loggedInUser;
    if (!loggedInUser) return this.throwLater(403, 'Not logged in');
    this.getProject(request.projectId).notifications = this.getProject(request.projectId).notifications
      .filter(notification => notification.userId !== loggedInUser.userId);
    return this.returnLater(undefined);
  }
  notificationSearch(request: Client.NotificationSearchRequest): Promise<Client.NotificationSearchResponse> {
    const loggedInUser = this.getProject(request.projectId).loggedInUser;
    if (!loggedInUser) return this.throwLater(403, 'Not logged in');
    const notifications = this.getProject(request.projectId).notifications
      .filter(notification => notification.userId === loggedInUser.userId);
    return this.returnLater(this.filterCursor<Client.Notification>(notifications, 10, request.cursor));
  }
  commentDeleteAdmin(request: Admin.CommentDeleteAdminRequest): Promise<Admin.Comment> {
    const comment: CommentWithAuthorWithParentPath = this.getImmutable(
      this.getProject(request.projectId).comments,
      comment => comment.commentId === request.commentId);
    comment.content = undefined;
    comment.authorUserId = undefined;
    comment.authorName = undefined;
    comment.authorIsMod = undefined;
    comment.edited = new Date();
    return this.returnLater(comment);
  }
  transactionSearchAdmin(request: Admin.TransactionSearchAdminRequest): Promise<Admin.TransactionSearchAdminResponse> {
    throw new Error("Method not implemented.");
  }
  async ideaCreateAdmin(request: Admin.IdeaCreateAdminRequest): Promise<Admin.IdeaWithVote> {
    const author = this.getProject(request.projectId).users.find(user => user.userId === request.ideaCreateAdmin.authorUserId);
    if (!author) return this.throwLater(404, 'Author of idea not found');
    const idea: Admin.Idea = {
      ideaId: stringToSlug(request.ideaCreateAdmin.title + '-' + randomUuid().substring(0, 5)),
      created: new Date(),
      commentCount: 0,
      childCommentCount: 0,
      authorName: author.name,
      authorIsMod: author.isMod,
      voteValue: 1,
      ...(request.ideaCreateAdmin),
    };
    if (request.ideaCreateAdmin.statusId === undefined) {
      idea.statusId = this.getProject(request.projectId).config.config.content.categories
        .find(c => c.categoryId === request.ideaCreateAdmin.categoryId)!.workflow.entryStatus;
    }
    for (const linkedFromPostId of (request.ideaCreateAdmin.linkedFromPostIds || [])) {
      const linkedFromPost: Admin.Idea = this.getImmutable(this.getProject(request.projectId).ideas, idea => idea.ideaId === linkedFromPostId);
      linkedFromPost.linkedToPostIds = [...(linkedFromPost.linkedToPostIds || []), idea.ideaId];
    }
    this.getProject(request.projectId).ideas.push(idea);
    this.getProject(request.projectId).votes.push({
      voterUserId: author.userId,
      ideaId: idea.ideaId,
      vote: Client.VoteOption.Upvote,
    });
    if (request.deleteDraftId) {
      const deleteDraftIndex = this.getProject(request.projectId).drafts.findIndex(draft => draft.draftId === request.deleteDraftId);
      if (deleteDraftIndex !== -1) {
        this.getProject(request.projectId).drafts.splice(deleteDraftIndex, 1);
      }
    }
    return this.returnLater({
      ...idea,
      vote: {
        vote: Client.VoteOption.Upvote,
      },
    });
  }
  ideaDeleteAdmin(request: Admin.IdeaDeleteAdminRequest): Promise<void> {
    const ideaIndex = this.getProject(request.projectId).ideas.findIndex(idea => idea.ideaId === request.ideaId);
    if (ideaIndex !== -1) {
      this.getProject(request.projectId).ideas.splice(ideaIndex, 1);
    }
    return this.returnLater(undefined);
  }
  ideaDeleteBulkAdmin(request: Admin.IdeaDeleteBulkAdminRequest): Promise<void> {
    throw new Error("Method not implemented.");
  }
  ideaGetAdmin(request: Admin.IdeaGetAdminRequest): Promise<Admin.Idea> {
    return this.ideaGetAdmin(request);
  }
  ideaUpdateAdmin(request: Admin.IdeaUpdateAdminRequest): Promise<Admin.Idea> {
    const idea: Admin.Idea = this.getImmutable(
      this.getProject(request.projectId).ideas,
      idea => idea.ideaId === request.ideaId);
    if (request.ideaUpdateAdmin.title !== undefined) idea.title = request.ideaUpdateAdmin.title;
    if (request.ideaUpdateAdmin.description !== undefined) idea.description = request.ideaUpdateAdmin.description;
    if (request.ideaUpdateAdmin.response !== undefined || request.ideaUpdateAdmin.statusId !== undefined) {
      const user = request.ideaUpdateAdmin.responseAuthorUserId
        && this.getProject(request.projectId).users.find(user => user.userId === request.ideaUpdateAdmin.responseAuthorUserId)
        || this.getProject(request.projectId).loggedInUser;
      if (user) {
        idea.responseAuthorName = user.name;
        idea.responseAuthorUserId = user.userId;
        idea.responseEdited = new Date();
      }
    }
    if (request.ideaUpdateAdmin.response !== undefined) idea.response = request.ideaUpdateAdmin.response;
    if (request.ideaUpdateAdmin.statusId !== undefined) idea.statusId = request.ideaUpdateAdmin.statusId;
    if (request.ideaUpdateAdmin.tagIds !== undefined) idea.tagIds = request.ideaUpdateAdmin.tagIds;
    if (request.ideaUpdateAdmin.fundGoal !== undefined) idea.fundGoal = request.ideaUpdateAdmin.fundGoal;
    if (!request.ideaUpdateAdmin.suppressNotifications) {
      // Should send notifications here
    };
    return this.returnLater(idea);
  }
  ideaLinkAdmin(request: Admin.IdeaLinkAdminRequest): Promise<Admin.IdeaConnectResponse> {
    const idea: Admin.Idea = this.getImmutable(this.getProject(request.projectId).ideas, idea => idea.ideaId === request.ideaId);
    const parentIdea: Admin.Idea = this.getImmutable(this.getProject(request.projectId).ideas, idea => idea.ideaId === request.parentIdeaId);
    if (idea.ideaId === parentIdea.ideaId) return this.throwLater(400, 'Cannot link into itself');
    if (idea.linkedToPostIds?.includes(parentIdea.ideaId)) return this.throwLater(400, 'Already linked');
    idea.linkedToPostIds = [...(idea.linkedToPostIds || []), parentIdea.ideaId];
    parentIdea.linkedFromPostIds = [...(parentIdea.linkedFromPostIds || []), idea.ideaId];
    return this.returnLater({ idea, parentIdea });
  }
  ideaUnLinkAdmin(request: Admin.IdeaUnLinkAdminRequest): Promise<Admin.IdeaConnectResponse> {
    const idea: Admin.Idea = this.getImmutable(this.getProject(request.projectId).ideas, idea => idea.ideaId === request.ideaId);
    const parentIdea: Admin.Idea = this.getImmutable(this.getProject(request.projectId).ideas, idea => idea.ideaId === request.parentIdeaId);
    if (idea.ideaId === parentIdea.ideaId) return this.throwLater(400, 'Cannot unlink from itself');
    if (!idea.linkedToPostIds?.includes(parentIdea.ideaId)) return this.throwLater(400, 'Not linked');
    idea.linkedToPostIds = idea.linkedToPostIds?.filter(ideaId => ideaId !== parentIdea.ideaId);
    parentIdea.linkedFromPostIds = parentIdea.linkedFromPostIds?.filter(ideaId => ideaId !== idea.ideaId);
    return this.returnLater({ idea, parentIdea });
  }
  ideaVotersGetAdmin(request: Admin.IdeaVotersGetAdminRequest): Promise<Admin.IdeaVotersAdminResponse> {
    return this.returnLater(this.filterCursor(this.getProject(request.projectId).users
      , this.DEFAULT_LIMIT, request.cursor));
  }
  ideaMerge(request: Client.IdeaMergeRequest): Promise<Client.IdeaConnectResponse> {
    return this.ideaMergeAdmin(request);
  }
  ideaMergeAdmin(request: Admin.IdeaMergeAdminRequest): Promise<Admin.IdeaConnectResponse> {
    const idea: Admin.Idea = this.getImmutable(this.getProject(request.projectId).ideas, idea => idea.ideaId === request.ideaId);
    const parentIdea: Admin.Idea = this.getImmutable(this.getProject(request.projectId).ideas, idea => idea.ideaId === request.parentIdeaId);
    if (idea.ideaId === parentIdea.ideaId) return this.throwLater(400, 'Cannot merge into itself');
    if (idea.mergedToPostId) return this.throwLater(400, 'Already merged');
    idea.mergedToPostId = parentIdea.ideaId;
    idea.mergedToPostTime = new Date();
    parentIdea.mergedPostIds = [...(parentIdea.mergedPostIds || []), idea.ideaId];
    parentIdea.commentCount += idea.commentCount;
    if (idea.funded) {
      parentIdea.funded = (parentIdea.funded || 0) + (idea.funded || 0);
      idea.funded = 0;
    }
    if (idea.fundersCount) {
      parentIdea.fundersCount = (parentIdea.fundersCount || 0) + (idea.fundersCount || 0);
      idea.fundersCount = 0;
    }
    if (idea.voteValue) parentIdea.voteValue = (parentIdea.voteValue || 0) + (idea.voteValue || 0);
    if (idea.expressionsValue) parentIdea.expressionsValue = (parentIdea.expressionsValue || 0) + (idea.expressionsValue || 0);
    if (idea.expressions?.length) {
      if (!parentIdea.expressions) parentIdea.expressions = {};
      for (const expression of Object.keys(idea.expressions || {})) {
        parentIdea.expressions[expression] = (parentIdea.expressions[expression] || 0) + (idea.expressions[expression] || 0);
      }
    }
    return this.returnLater({ idea, parentIdea });
  }
  ideaUnMergeAdmin(request: Admin.IdeaUnMergeAdminRequest): Promise<Admin.IdeaConnectResponse> {
    const idea: Admin.Idea = this.getImmutable(this.getProject(request.projectId).ideas, idea => idea.ideaId === request.ideaId);
    const parentIdea: Admin.Idea = this.getImmutable(this.getProject(request.projectId).ideas, idea => idea.ideaId === request.parentIdeaId);
    if (idea.ideaId === parentIdea.ideaId) return this.throwLater(400, 'Cannot unmerge from itself');
    if (idea.mergedToPostId !== parentIdea.ideaId) return this.throwLater(400, 'Not merged');
    idea.mergedToPostId = undefined;
    idea.mergedToPostTime = undefined;
    parentIdea.mergedPostIds = parentIdea.mergedPostIds?.filter(postId => postId !== idea.ideaId);
    parentIdea.commentCount -= idea.commentCount;
    if (idea.funded) parentIdea.funded = (parentIdea.funded || 0) - (idea.funded || 0);
    if (idea.fundersCount) parentIdea.fundersCount = (parentIdea.fundersCount || 0) - (idea.fundersCount || 0);
    if (idea.voteValue) parentIdea.voteValue = (parentIdea.voteValue || 0) - (idea.voteValue || 0);
    if (idea.expressionsValue) parentIdea.expressionsValue = (parentIdea.expressionsValue || 0) - (idea.expressionsValue || 0);
    if (idea.expressions?.length) {
      if (!parentIdea.expressions) parentIdea.expressions = {};
      for (const expression of Object.keys(idea.expressions || {})) {
        parentIdea.expressions[expression] = (parentIdea.expressions[expression] || 0) - (idea.expressions[expression] || 0);
      }
    }
    return this.returnLater({ idea, parentIdea });
  }
  ideaDraftCreateAdmin(request: Admin.IdeaDraftCreateAdminRequest): Promise<Admin.IdeaDraftAdmin> {
    const draft: Admin.IdeaDraftAdmin = {
      ...request.ideaCreateAdmin,
      lastSaved: new Date(),
      draftId: randomUuid(),
    };
    this.getProject(request.projectId).drafts.unshift(draft);
    return this.returnLater(draft);
  }
  ideaDraftGetAdmin(request: Admin.IdeaDraftGetAdminRequest): Promise<Admin.IdeaDraftAdmin> {
    const draft = this.getProject(request.projectId).drafts
      .find(draft => request.draftId === draft.draftId);
    if (!draft) return this.throwLater(404, 'Draft not found');
    return this.returnLater(draft);
  }
  ideaDraftSearchAdmin(request: Admin.IdeaDraftSearchAdminRequest): Promise<Admin.IdeaDraftSearchResponse> {
    return this.returnLater(this.filterCursor(this.getProject(request.projectId).drafts
      .filter(draft => !request.ideaDraftSearch.filterCategoryIds
        || request.ideaDraftSearch.filterCategoryIds.includes(draft.categoryId)),
      this.DEFAULT_LIMIT, request.cursor), 1000);
  }
  ideaDraftUpdateAdmin(request: Admin.IdeaDraftUpdateAdminRequest): Promise<void> {
    const draftIndex = this.getProject(request.projectId).drafts.findIndex(draft => draft.draftId === request.draftId);
    if (draftIndex === -1) return this.throwLater(404, 'Draft not found');
    const draftId = this.getProject(request.projectId).drafts.find(draft => draft.draftId === request.draftId)?.draftId;
    if (!draftId) return this.throwLater(404, 'Draft not found');
    this.getProject(request.projectId).drafts[draftIndex] = {
      ...request.ideaCreateAdmin,
      lastSaved: new Date(),
      draftId,
    };
    return this.returnLater(undefined);
  }
  ideaDraftDeleteAdmin(request: Admin.IdeaDraftDeleteAdminRequest): Promise<void> {
    const draftIndex = this.getProject(request.projectId).drafts.findIndex(draft => draft.draftId === request.draftId);
    if (draftIndex === -1) return this.throwLater(404, 'Draft not found');
    this.getProject(request.projectId).ideas.splice(draftIndex, 1);
    return this.returnLater(undefined);
  }
  configGetAdmin(request: Admin.ConfigGetAdminRequest): Promise<Admin.VersionedConfigAdmin> {
    if (!this.getProject(request.projectId)) return this.throwLater(404, 'Project not found');
    return this.returnLater(this.getProject(request.projectId).config);
  }
  async configGetAllAndUserBindAllAdmin(): Promise<Admin.ConfigAndBindAllResult> {
    if (!this.loggedIn) return this.throwLater(403, 'Not logged in');
    const byProjectId = {};
    for (const projectId of Object.keys(this.db)) {
      if (projectId.startsWith('demo-')) continue;
      byProjectId[projectId] = {
        config: this.db[projectId].config,
        user: await this.getOrCreateAdminUser(projectId),
        isExternal: this.db[projectId].isExternal,
      };
    }
    return this.returnLater({
      byProjectId,
    });
  }
  configSetAdmin(request: Admin.ConfigSetAdminRequest): Promise<Admin.VersionedConfigAdmin> {
    if (request.versionLast !== undefined && this.getProject(request.projectId).config.version !== request.versionLast) this.throwLater(412, 'Config changed since last reload');
    this.getProject(request.projectId).config = { config: request.configAdmin, version: randomUuid() };
    return this.returnLater(this.getProject(request.projectId).config);
  }
  async projectCreateAdmin(request: Admin.ProjectCreateAdminRequest): Promise<Admin.NewProjectResult> {
    if (!this.loggedIn) return this.throwLater(403, 'Not logged in');
    const projectId = request.configAdmin.projectId || `${request.configAdmin.slug}-${randomUuid().substring(0, 3)}`;
    request.configAdmin.projectId = projectId;
    this.getProject(projectId).config.config = request.configAdmin;
    return this.returnLater({
      projectId,
      config: this.getProject(projectId).config,
      user: await this.getOrCreateAdminUser(projectId),
    });
  }
  projectDeleteAdmin(request: Admin.ProjectDeleteAdminRequest): Promise<void> {
    this.deleteProject(request.projectId);
    return this.returnLater(undefined);
  }
  projectExportAdmin(request: Admin.ProjectExportAdminRequest): Promise<Admin.FileDownload> {
    return this.returnLater({
      filename: `${request.projectId}.csv`,
      contentType: 'application/csv',
      blob: new Blob(['a,b\n1,4'], { type: 'application/csv' }),
    }, undefined);
  }
  projectImportPostAdmin(request: Admin.ProjectImportPostAdminRequest): Promise<Admin.ImportResponse> {
    return this.returnLater({
      userFacingMessage: 'Imported successfully',
    });
  }
  userCreateAdmin(request: Admin.UserCreateAdminRequest): Promise<Admin.UserAdmin> {
    const user: Admin.UserAdmin = {
      userId: randomUuid(),
      created: new Date(),
      balance: 0,
      isMod: !!request.userCreateAdmin.isMod,
      emailNotify: !!request.userCreateAdmin.email,
      iosPush: !!request.userCreateAdmin.iosPushToken,
      androidPush: !!request.userCreateAdmin.androidPushToken,
      browserPush: !!request.userCreateAdmin.browserPushToken,
      hasPassword: !!request.userCreateAdmin.password,
      ...request.userCreateAdmin,
    };
    this.getProject(request.projectId).users.push(user);
    const creditOnSignup = this.getProject(request.projectId).config.config.users.credits?.creditOnSignup?.amount || 0;
    if (creditOnSignup > 0) {
      const newBalance = user.balance + creditOnSignup;
      user.balance = newBalance;
      const balanceUpdateTransaction = {
        userId: user.userId,
        transactionId: randomUuid(),
        created: new Date(),
        amount: creditOnSignup,
        transactionType: Admin.TransactionType.Income,
        summary: this.getProject(request.projectId).config.config.users.credits?.creditOnSignup?.summary || 'Sign-up credits',
      };
      this.getProject(request.projectId).transactions.push(balanceUpdateTransaction);
      this.getProject(request.projectId).balances[user.userId] = newBalance;
    }
    return this.returnLater(user);
  }
  userDeleteAdmin(request: Admin.UserDeleteAdminRequest): Promise<void> {
    const userIdIndex = this.getProject(request.projectId).users.findIndex(user => user.userId === request.userId);
    if (userIdIndex === -1) return this.throwLater(404, 'User not found');
    this.getProject(request.projectId).users.splice(userIdIndex, 1);
    if (this.getProject(request.projectId).loggedInUser?.userId === request.userId) {
      this.getProject(request.projectId).loggedInUser = undefined;
    }
    return this.returnLater(undefined);
  }
  userDeleteBulkAdmin(request: Admin.UserDeleteBulkAdminRequest): Promise<void> {
    throw new Error("Method not implemented.");
  }
  userGet(request: Client.UserGetRequest): Promise<Client.User> {
    return this.userGetAdmin(request);
  }
  userGetAdmin(request: Admin.UserGetAdminRequest): Promise<Admin.UserAdmin> {
    const user = this.getProject(request.projectId).users.find(user => user.userId === request.userId);
    return user ? this.returnLater(user) : this.throwLater(404, 'User not found');
  }
  userSearchAdmin(request: Admin.UserSearchAdminRequest): Promise<Admin.UserSearchResponse> {
    return this.returnLater(this.filterCursor(this.getProject(request.projectId).users
      .filter(user => request.userSearchAdmin.isMod === undefined || request.userSearchAdmin.isMod === user.isMod)
      .filter(user => !request.userSearchAdmin.searchText
        || user.name && user.name.indexOf(request.userSearchAdmin.searchText) >= 0
        || user.email && user.email.indexOf(request.userSearchAdmin.searchText) >= 0)
      .map(user => ({
        ...user,
        balance: this.getProject(request.projectId).balances[user.userId],
      })), this.DEFAULT_LIMIT, request.cursor));
  }
  userUpdateAdmin(request: Admin.UserUpdateAdminRequest): Promise<Admin.UserAdmin> {
    const user: Admin.UserAdmin = this.getImmutable(
      this.getProject(request.projectId).users,
      user => user.userId === request.userId);
    if (request.userUpdateAdmin.name !== undefined) user.name = request.userUpdateAdmin.name;
    if (request.userUpdateAdmin.email !== undefined) user.email = request.userUpdateAdmin.email === '' ? undefined : request.userUpdateAdmin.email;
    if (request.userUpdateAdmin.emailNotify !== undefined) user.emailNotify = request.userUpdateAdmin.emailNotify;
    if (request.userUpdateAdmin.password !== undefined) user.hasPassword = true;
    if (request.userUpdateAdmin.iosPush === false) user.iosPush = false;
    if (request.userUpdateAdmin.androidPush === false) user.androidPush = false;
    if (request.userUpdateAdmin.browserPush === false) user.browserPush = false;
    var balance = this.getProject(request.projectId).balances[request.userId];
    var balanceUpdateTransaction: Admin.Transaction | undefined;
    if (request.userUpdateAdmin.transactionCreate !== undefined) {
      balance = (balance || 0) + request.userUpdateAdmin.transactionCreate.amount;
      balanceUpdateTransaction = {
        userId: request.userId,
        transactionId: randomUuid(),
        created: new Date(),
        amount: request.userUpdateAdmin.transactionCreate.amount,
        transactionType: Admin.TransactionType.Adjustment,
        summary: request.userUpdateAdmin.transactionCreate.summary,
      };
      this.getProject(request.projectId).transactions.push(balanceUpdateTransaction);
      this.getProject(request.projectId).balances[request.userId] = balance;
    }
    if (request.userUpdateAdmin.isMod !== undefined) {
      user.isMod = request.userUpdateAdmin.isMod;
    };
    return this.returnLater({
      ...user,
      balance,
    });
  }
  ideaVoteUpdate(request: Client.IdeaVoteUpdateRequest): Promise<Client.IdeaVoteUpdateResponse> {
    const loggedInUser = this.getProject(request.projectId).loggedInUser;
    if (!loggedInUser) return this.throwLater(403, 'Not logged in');
    const idea: Admin.Idea = this.getImmutable(
      this.getProject(request.projectId).ideas,
      idea => idea.ideaId === request.ideaId);
    const vote: VoteWithAuthorAndIdeaId = this.getImmutable(
      this.getProject(request.projectId).votes,
      v => v.voterUserId === loggedInUser.userId && v.ideaId === request.ideaId,
      () => ({ ideaId: idea.ideaId, voterUserId: loggedInUser.userId }));
    var balance: number | undefined;
    var transaction: Admin.Transaction | undefined;
    if (request.ideaVoteUpdate.fundDiff !== undefined) {
      const fundDiff = request.ideaVoteUpdate.fundDiff;
      if (fundDiff === 0) return this.throwLater(400, 'Cannot fund zero');
      balance = this.getProject(request.projectId).balances[loggedInUser.userId] || 0;
      balance -= fundDiff;
      if (balance < 0) return this.throwLater(403, 'Insufficient funds');
      const fundersCountDiff = ((vote.fundAmount || 0) + fundDiff > 0 ? 1 : 0) - ((vote.fundAmount || 0) > 0 ? 1 : 0)
      transaction = {
        userId: loggedInUser.userId,
        transactionId: randomUuid(),
        created: new Date(),
        amount: fundDiff,
        transactionType: Admin.TransactionType.Vote,
        targetId: request.ideaId,
        summary: `Funding for "${idea.title.length > 50 ? idea.title.substring(0, 47) + '...' : idea.title}"`
      };
      this.getProject(request.projectId).transactions.push(transaction);
      vote.fundAmount = (vote.fundAmount || 0) + request.ideaVoteUpdate.fundDiff;
      this.getProject(request.projectId).balances[loggedInUser.userId] = balance;
      idea.funded = (idea.funded || 0) + fundDiff;
      if (fundersCountDiff !== 0) idea.fundersCount = (idea.fundersCount || 0) + fundersCountDiff;
    }
    if (request.ideaVoteUpdate.vote) {
      var votePrevValue: number = 0;
      switch (vote.vote) {
        case Client.VoteOption.Upvote:
          votePrevValue = 1;
          break;
        case Client.VoteOption.Downvote:
          votePrevValue = -1;
          break;
      }
      var voteValue: number = 0;
      switch (request.ideaVoteUpdate.vote) {
        case Client.VoteOption.Upvote:
          voteValue = 1;
          vote.vote = Client.VoteOption.Upvote;
          break;
        case Client.VoteOption.Downvote:
          voteValue = -1;
          vote.vote = Client.VoteOption.Downvote;
          break;
        case Client.VoteOption.None:
          voteValue = 0;
          vote.vote = undefined;
          break;
      }
      const voteValueDiff = voteValue - votePrevValue;
      if (voteValueDiff !== 0) idea.voteValue = (idea.voteValue || 0) + voteValueDiff;
    }
    if (request.ideaVoteUpdate.expressions) {
      var expressionsSet = new Set<string>(vote.expression || []);
      idea.expressionsValue = idea.expressionsValue || 0;
      idea.expressions = idea.expressions || {};

      var expressionsToAdd: string[] = [];
      var expressionsToRemove: string[] = [];
      if (request.ideaVoteUpdate.expressions.action === Client.IdeaVoteUpdateExpressionsActionEnum.Set) {
        expressionsSet = new Set<string>([request.ideaVoteUpdate.expressions.expression!]);
        expressionsToAdd.push(request.ideaVoteUpdate.expressions.expression!);
        expressionsToRemove = (vote.expression || []).filter(e => e !== request.ideaVoteUpdate.expressions!.expression);
      } else if (request.ideaVoteUpdate.expressions.action === Client.IdeaVoteUpdateExpressionsActionEnum.Unset) {
        expressionsSet = new Set<string>();
        expressionsToRemove = vote.expression || [];
      } else if (request.ideaVoteUpdate.expressions.action === Client.IdeaVoteUpdateExpressionsActionEnum.Add) {
        if (!expressionsSet.has(request.ideaVoteUpdate.expressions.expression!)) {
          expressionsToAdd.push(request.ideaVoteUpdate.expressions.expression!);
          expressionsSet.add(request.ideaVoteUpdate.expressions.expression!);
        }
      } else if (request.ideaVoteUpdate.expressions.action === Client.IdeaVoteUpdateExpressionsActionEnum.Remove) {
        if (expressionsSet.has(request.ideaVoteUpdate.expressions.expression!)) {
          expressionsToRemove.push(request.ideaVoteUpdate.expressions.expression!);
          expressionsSet.delete(request.ideaVoteUpdate.expressions.expression!);
        }
      }

      const expressing = this.getProject(request.projectId).config.config.content.categories.find(c => c.categoryId === idea.categoryId)!.support.express;
      expressionsToAdd.forEach(expression => {
        const weight = expressing?.limitEmojiSet ? expressing.limitEmojiSet.find(e => e.display === expression)?.weight || 0 : 1;
        idea.expressionsValue! += weight;
        idea.expressions![expression] = (idea.expressions![expression] || 0) + 1
      })
      expressionsToRemove.forEach(expression => {
        const weight = expressing?.limitEmojiSet ? expressing.limitEmojiSet.find(e => e.display === expression)?.weight || 0 : 1;
        idea.expressionsValue! -= weight;
        idea.expressions![expression] = (idea.expressions![expression] || 0) - 1
        if (idea.expressions![expression] <= 0) delete idea.expressions![expression];
      })
      vote.expression = Array.from(expressionsSet);
    }
    return this.returnLater({
      vote,
      idea,
      transaction,
      ...(balance !== undefined ? { balance: { balance } } : {}),
    });
  }
  commentVoteUpdate(request: Client.CommentVoteUpdateRequest): Promise<Client.CommentVoteUpdateResponse> {
    const loggedInUser = this.getProject(request.projectId).loggedInUser;
    if (!loggedInUser) return this.throwLater(403, 'Not logged in');
    const comment: CommentWithAuthorWithParentPath = this.getImmutable(
      this.getProject(request.projectId).comments,
      comment => comment.commentId === request.commentId);
    const vote: VoteWithAuthorAndCommentId = this.getImmutable(
      this.getProject(request.projectId).commentVotes,
      v => v.voterUserId === loggedInUser.userId && v.commentId === request.commentId,
      () => ({ voterUserId: loggedInUser.userId, commentId: comment.commentId }));

    var votePrevValue: number = 0;
    switch (vote.vote) {
      case Client.VoteOption.Upvote:
        votePrevValue = 1;
        break;
      case Client.VoteOption.Downvote:
        votePrevValue = -1;
        break;
    }
    var voteValue: number = 0;
    switch (request.commentVoteUpdate.vote) {
      case Client.VoteOption.Upvote:
        voteValue = 1;
        vote.vote = Client.VoteOption.Upvote;
        break;
      case Client.VoteOption.Downvote:
        voteValue = -1;
        vote.vote = Client.VoteOption.Downvote;
        break;
      case Client.VoteOption.None:
        voteValue = 0;
        vote.vote = Client.VoteOption.None;
        break;
    }
    const voteValueDiff = voteValue - votePrevValue;
    if (voteValueDiff !== 0) comment.voteValue = (comment.voteValue || 0) + voteValueDiff;

    return this.returnLater({
      vote,
      comment,
    });
  }
  categorySubscribe(request: Client.CategorySubscribeRequest): Promise<Admin.UserMe> {
    const loggedInUser = this.getProject(request.projectId).loggedInUser;
    if (!loggedInUser) return this.throwLater(403, 'Not logged in');
    const subscribedToSet = new Set(loggedInUser.categorySubscriptions || []);
    if (!!request.subscribe) {
      subscribedToSet.add(request.categoryId);
    } else {
      subscribedToSet.delete(request.categoryId);
    }
    loggedInUser.categorySubscriptions = [...subscribedToSet];
    return this.returnLater(loggedInUser);
  }
  accountNoopAdmin(): Promise<void> {
    return this.returnLater(undefined);
  }
  ideaSubscribeAdmin(request: Admin.IdeaSubscribeAdminRequest): Promise<void> {
    throw new Error("Method not implemented.");
  }
  ideaUnsubscribeAdmin(request: Admin.IdeaUnsubscribeAdminRequest): Promise<void> {
    throw new Error("Method not implemented.");
  }
  userSubscribeAdmin(request: Admin.UserSubscribeAdminRequest): Promise<void> {
    throw new Error("Method not implemented.");
  }
  userUnsubscribeAdmin(request: Admin.UserUnsubscribeAdminRequest): Promise<void> {
    throw new Error("Method not implemented.");
  }
  commentSubscribeAdmin(request: Admin.CommentSubscribeAdminRequest): Promise<void> {
    throw new Error("Method not implemented.");
  }
  commentUnsubscribeAdmin(request: Admin.CommentUnsubscribeAdminRequest): Promise<void> {
    throw new Error("Method not implemented.");
  }

  contentUploadAsAdmin(request: Admin.ContentUploadAsAdminRequest): Promise<Admin.ContentUploadAsAdminResponse> {
    return this.contentUpload(request);
  }
  async contentUpload(request: Client.ContentUploadRequest): Promise<Client.ContentUploadResponse> {
    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => {
        // Always a string since using readAsDataURL below
        resolve(reader.result as string);
      };
      reader.readAsDataURL(request.body);
    });
    return this.returnLater({ url: data });
  }

  // **** Private methods

  addNotification(projectId: string, user: Admin.User, description: string, relatedIdeaId?: string, relatedCommentId?: string) {
    this.getProject(projectId).notifications.push({
      projectId,
      notificationId: randomUuid(),
      userId: user.userId,
      relatedIdeaId,
      relatedCommentId,
      created: new Date(),
      description,
    });
  }

  sendWebNotification(projectId: string, title: string, description: string) {
    const icon = this.getProject(projectId).config.config.logoUrl;
    const notificationOptions: NotificationOptions = {
      body: description,
      icon,
    };
    const notificationData = { notificationTitle: title, notificationOptions };
    // This was taken from sw.js, if changed, change it there too.
    WebNotification.getInstance().getSwRegistration()!.showNotification(
      notificationData.notificationTitle,
      notificationData.notificationOptions,
    );
  }

  getProject(projectId: string) {
    var project = this.db[projectId];
    if (project === undefined) {
      const editor = new ConfigEditor.EditorImpl();
      editor.getProperty<ConfigEditor.StringProperty>(['projectId']).set(projectId);
      editor.getProperty<ConfigEditor.StringProperty>(['name']).set(projectId);
      editor.getProperty<ConfigEditor.StringProperty>(['slug']).set(projectId);
      project = {
        config: { config: editor.getConfig(), version: randomUuid() },
        comments: [],
        transactions: [],
        ideas: [],
        drafts: [],
        users: [],
        votes: [],
        commentVotes: [],
        balances: {},
        notifications: [],
        admins: [
          ...(this.account ? [{
            accountId: this.account.accountId,
            email: this.account.email,
            name: this.account.name,
            role: Admin.ProjectAdminRoleEnum.Owner,
          }] : []),
          {
            accountId: randomUuid(),
            email: 'johndoe@example.com',
            name: 'John Doe',
            role: Admin.ProjectAdminRoleEnum.Admin,
          },
          {
            accountId: randomUuid(),
            email: 'dohnjoe@example.com',
            name: 'Dohn Joe',
            role: Admin.ProjectAdminRoleEnum.Admin,
          },
        ],
        invitations: [],
        isExternal: false,
      };
      this.db[projectId] = project;
    }
    return project;
  }

  async getProjectBySlug(slug: string) {
    slug = slug.split('.')[0];
    const project = Object.values(this.db).find(p =>
      p.config.config.slug === slug
      || p.config.config.domain === slug);

    if (project) return project;

    return this.getProject((await mock(slug)).config.projectId);
  }

  deleteProject(projectId: string) {
    delete this.db[projectId];
  }

  calcScore(idea: Admin.Idea) {
    return (idea.fundersCount || 0) + (idea.voteValue || 0) + (idea.funded || 0) + (idea.expressionsValue || 0) + 1;
  }

  calcTrendingScore(idea: Admin.Idea) {
    var score = this.calcScore(idea);
    var order = Math.log(Math.max(score, 1));
    var seconds = idea.created.getTime() - 1134028003;
    return Math.ceil(order + seconds / 45000);
  }

  filterCursor<T>(data: T[], limit: number, cursor?: string): { results: T[], cursor?: string, hits?: Client.Hits } {
    var currentCursor = cursor ? parseInt(cursor) : 0;
    return {
      results: data.slice(currentCursor, Math.min(data.length, currentCursor + limit)),
      cursor: (data.length >= currentCursor + limit) ? currentCursor + limit + '' : undefined,
      hits: {
        value: data.length,
      },
    };
  }

  sort<T>(data: T[], sorters: ((l: T, r: T) => number)[]): any[] {
    data.sort((l, r) => {
      for (let i = 0; i < sorters.length; i++) {
        const result = sorters[i](l, r);
        if (result !== 0) {
          return result;
        }
      }
      return 0;
    });
    return data;
  }

  getImmutable<T extends object>(arr: T[], filter: (t: T) => boolean, loader?: () => T) {
    const index: number = arr.findIndex(filter);
    var t;
    if (index === -1) {
      if (!loader) throw Error('Not found');
      t = loader();
      arr.push(t);
    } else {
      t = { ...arr[index] };
      arr[index] = t;
    }
    return t;
  }

  async getOrCreateAdminUser(projectId: string): Promise<Admin.UserAdmin> {
    if (!this.loggedIn || !this.account) return this.throwLater(403, 'Not logged in');
    const accountEmail = this.account.email;
    var adminUser = this.getProject(projectId).users.find(u => u.email === accountEmail);
    if (!adminUser) {
      adminUser = await this.userCreateAdmin({
        projectId,
        userCreateAdmin: {
          email: accountEmail,
          name: this.account.name,
          ssoGuid: accountEmail,
          isMod: true,
        },
      });
    }
    return adminUser;
  }

  async returnLater<T>(returnValue: T, additionalLatency?: number): Promise<T> {
    // if (!isProd()) console.log('Server SEND:', returnValue);
    if (additionalLatency) await this.wait(additionalLatency);
    await this.waitLatency();
    return cloneDeep<T>(returnValue);
  }

  async throwLater(httpStatus: number, userFacingMessage?: string): Promise<any> {
    if (!isProd()) console.log('Server THROW:', httpStatus, userFacingMessage);
    console.trace();
    await this.waitLatency();
    // eslint-disable-next-line no-throw-literal
    throw {
      status: httpStatus,
      json: () => Promise.resolve(Admin.ErrorResponseToJSON({
        userFacingMessage: userFacingMessage,
      })),
    };
  }

  async rateLimitLater(captcha?: boolean, userFacingMessage?: string): Promise<any> {
    if (!isProd()) console.log('Server THROW: rateLimit captcha:', captcha);
    console.trace();
    await this.waitLatency();
    var headers = new Map<string, string>();
    if (captcha) {
      headers.set('x-cf-challenge', JSON.stringify({
        version: 'RECAPTCHA_V2',
        // Recaptcha 'clearflask-localhost2' site key
        challenge: '6LewiegbAAAAAH4Epm0Burza9qNvWsCoNhTHsmug'
      }));
    }
    // eslint-disable-next-line no-throw-literal
    throw {
      status: 429,
      headers: headers,
      json: () => Promise.resolve(Admin.ErrorResponseToJSON({
        userFacingMessage: userFacingMessage,
      })),
    };
  }

  async waitLatency(): Promise<void> {
    if (this.hasLatency) {
      await this.wait(this.BASE_LATENCY + this.BASE_LATENCY * Math.random());
    }
  }

  async wait(latency: number): Promise<void> {
    await new Promise<void>(resolve => setTimeout(resolve, latency));
  }

  generateId(): string {
    return randomUuid();
  }
}

export default ServerMock;
