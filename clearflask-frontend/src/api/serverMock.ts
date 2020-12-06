import jsonwebtoken from 'jsonwebtoken';
import * as ConfigEditor from '../common/config/configEditor';
import WebNotification from '../common/notification/webNotification';
import notEmpty from '../common/util/arrayUtil';
import { isProd } from '../common/util/detectEnv';
import stringToSlug from '../common/util/slugger';
import randomUuid from '../common/util/uuid';
import * as Admin from './admin';
import * as Client from './client';

export const SSO_SECRET_KEY = '63195fc1-d8c0-4909-9039-e15ce3c96dce';

export const SuperAdminEmail = 'admin@clearflask.com';
const termsProjects = 'You can create separate projects each having their own set of users and content';
const AvailablePlans: { [planId: string]: Admin.Plan } = {
  'growth-monthly': {
    basePlanId: 'growth-monthly', title: 'Growth',
    pricing: { basePrice: 50, baseMau: 50, unitPrice: 30, unitMau: 50, period: Admin.PlanPricingPeriodEnum.Monthly },
    perks: [
      { desc: 'Unlimited projects', terms: termsProjects },
      { desc: 'Credit System' },
      { desc: 'Roadmap' },
    ],
  },
  'standard-monthly': {
    basePlanId: 'standard-monthly', title: 'Standard',
    pricing: { basePrice: 200, baseMau: 300, unitPrice: 100, unitMau: 300, period: Admin.PlanPricingPeriodEnum.Monthly },
    perks: [
      { desc: 'Single Sign-On' },
      { desc: 'Private projects' },
      { desc: 'Site template' },
    ],
  },
  'flat-yearly': {
    basePlanId: 'flat-yearly', title: 'Flat',
    perks: [
      { desc: 'Predictable annual price' },
      { desc: 'Tailored plan' },
    ],
  },
};
const FeaturesTable: Admin.FeaturesTable | undefined = {
  plans: ['Growth', 'Standard'],
  features: [
    { feature: 'Projects', values: ['No limit', 'No limit'] },
    { feature: 'Credit System', values: ['Yes', 'Yes'] },
    { feature: 'Roadmap view', values: ['Yes', 'Yes'] },
    { feature: 'Content customization', values: ['Yes', 'Yes'] },
    { feature: 'Private projects', values: ['No', 'Yes'], terms: 'Create a private project so only authorized users can view and provide feedback.' },
    { feature: 'Single Sign-On', values: ['No', 'Yes'], terms: 'Use your existing user accounts to log into ClearFlask' },
    { feature: 'Site template', values: ['No', 'Yes'], terms: 'Use your own HTML template to display parts of the site.' },
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
  account?: Admin.AccountAdmin & { planId: string } = undefined;
  accountPass?: string = undefined;
  // Mock project database
  readonly db: {
    [projectId: string]: {
      loggedInUser?: Admin.UserAdmin; // Mock server-side cookie data
      config: Admin.VersionedConfigAdmin,
      comments: CommentWithAuthorWithParentPath[];
      ideas: Admin.Idea[];
      users: Admin.UserAdmin[];
      votes: VoteWithAuthorAndIdeaId[];
      commentVotes: VoteWithAuthorAndCommentId[];
      transactions: Admin.Transaction[];
      balances: { [userId: string]: number };
      notifications: Client.Notification[];
    }
  } = {};
  nextCommentId = 10000;

  static get(): ServerMock {
    if (ServerMock.instance === undefined) ServerMock.instance = new ServerMock();
    return ServerMock.instance;
  }

  setLatency(enabled: boolean) {
    this.hasLatency = enabled;
  }

  supportMessage(request: Admin.SupportMessageRequest): Promise<void> {
    console.log('Received support message with content:', request.supportMessage.content);
    return this.returnLater();
  }
  plansGet(): Promise<Admin.PlansGetResponse> {
    return this.returnLater({
      plans: Object.values(AvailablePlans),
      featuresTable: FeaturesTable,
    });
  }
  legalGet(): Promise<Admin.LegalResponse> {
    return this.returnLater({
      terms: 'Here are Terms of Service',
      privacy: 'Here is a privacy policy.',
    });
  }
  accountBindAdmin(): Promise<Admin.AccountBindAdminResponse> {
    return this.returnLater(this.loggedIn && this.account
      ? {
        account: this.account,
        isSuperAdmin: !!this.superLoggedIn || !!this.account.isSuperAdmin,
      } : {
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
  accountLogoutAdmin(): Promise<void> {
    this.loggedIn = false;
    this.superLoggedIn = false;
    return this.returnLater();
  }
  accountSignupAdmin(request: Admin.AccountSignupAdminRequest): Promise<Admin.AccountAdmin> {
    const account: Admin.AccountAdmin = {
      basePlanId: request.accountSignupAdmin.basePlanId,
      name: request.accountSignupAdmin.name,
      email: request.accountSignupAdmin.email,
      isSuperAdmin: request.accountSignupAdmin.email === SuperAdminEmail || undefined,
      cfJwt: jsonwebtoken.sign({
        guid: request.accountSignupAdmin.email,
        email: request.accountSignupAdmin.email,
        name: request.accountSignupAdmin.name,
      }, SSO_SECRET_KEY),
      subscriptionStatus: Admin.SubscriptionStatus.ActiveTrial,
      hasApiKey: false,
    };
    this.accountPass = request.accountSignupAdmin.password;
    this.account = {
      planId: account.basePlanId,
      ...account
    };
    this.loggedIn = true;
    if (this.account.isSuperAdmin) {
      this.superLoggedIn = true;
    }
    return this.returnLater(account);
  }
  accountDeleteAdmin(): Promise<void> {
    if (!this.account) return this.throwLater(403, 'Not logged in');
    this.loggedIn = false;
    Object.keys(this.db).forEach(projectId => delete this.db[projectId]);
    this.account = undefined;
    this.accountPass = undefined;
    return this.returnLater();
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
      this.account.planId = request.accountUpdateAdmin.basePlanId
      this.account.basePlanId = request.accountUpdateAdmin.basePlanId
    };
    if (request.accountUpdateAdmin.apiKey) this.account.hasApiKey = true;
    return this.returnLater(this.account);
  }
  accountUpdateSuperAdmin(request: Admin.AccountUpdateSuperAdminRequest): Promise<Admin.AccountAdmin> {
    if (!this.account) return this.throwLater(403, 'Not logged in');
    if (request.accountUpdateSuperAdmin.changeToFlatPlanWithYearlyPrice !== undefined) {
      const basePlanId = 'flat-yearly';
      const newPlanId = `${basePlanId}-${Math.round(Math.random() * 1000)}`;
      AvailablePlans[newPlanId] = {
        ...AvailablePlans[basePlanId],
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
    return this.returnLater(this.account);
  }
  accountBillingAdmin(): Promise<Admin.AccountBilling> {
    if (!this.account) return this.throwLater(403, 'Not logged in');
    const billingPeriodEnd = new Date();
    billingPeriodEnd.setDate(billingPeriodEnd.getDate() + 3);
    const invoiceDate = new Date();
    invoiceDate.setDate(invoiceDate.getDate() - 24);
    return this.returnLater({
      plan: AvailablePlans[this.account.planId]!,
      subscriptionStatus: this.account.subscriptionStatus,
      payment: (this.account.subscriptionStatus === Admin.SubscriptionStatus.ActiveTrial
        || this.account.subscriptionStatus === Admin.SubscriptionStatus.NoPaymentMethod) ? undefined : {
          brand: 'mastercard',
          last4: "4242",
          expiryMonth: 7,
          expiryYear: 2032,
        },
      billingPeriodEnd: this.account.subscriptionStatus === Admin.SubscriptionStatus.ActiveTrial ? undefined : billingPeriodEnd,
      billingPeriodMau: 341,
      availablePlans: Object.values(AvailablePlans),
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
    return this.returnLater();
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
  ideaCommentSearch(request: Client.IdeaCommentSearchRequest): Promise<Client.IdeaCommentSearchResponse> {
    const minCommentIdToExclude: string | '' = [
      ...(request.ideaCommentSearch.excludeChildrenCommentIds || []),
      ...(request.ideaCommentSearch.parentCommentId ? [request.ideaCommentSearch.parentCommentId] : []),
    ].reduce((l, r) => l > r ? l : r, '');
    const loggedInUser = this.getProject(request.projectId).loggedInUser;
    const data = this.sort(this.getProject(request.projectId).comments
      .filter(comment => comment.ideaId === request.ideaId)
      .filter(comment => !request.ideaCommentSearch.parentCommentId || (comment.parentIdPath && comment.parentIdPath.includes(request.ideaCommentSearch.parentCommentId)))
      .filter(comment => !request.ideaCommentSearch.excludeChildrenCommentIds ||
        !request.ideaCommentSearch.excludeChildrenCommentIds.some(ec =>
          ec === comment.commentId
          || comment.parentIdPath.some(pc => ec === pc)))
      .filter(comment => !minCommentIdToExclude || comment.commentId > minCommentIdToExclude)
      .map(comment => {
        return {
          ...comment,
          author: comment.authorUserId ? this.getProject(request.projectId).users.find(user => user.userId === comment.authorUserId)! : undefined,
          vote: loggedInUser ? this.getProject(request.projectId).commentVotes.find(vote => vote.voterUserId === comment.commentId && vote.voterUserId === loggedInUser.userId) : undefined,
        }
      })
      , [(l, r) => l.created.getTime() - r.created.getTime()]);
    return this.returnLater({
      results: data.slice(0, Math.min(data.length, 10)),
    });
  }
  commentSearch(request: Client.CommentSearchRequest): Promise<Client.CommentSearchResponse> {
    return this.returnLater(this.filterCursor(this.sort(this.getProject(request.projectId).comments
      .filter(comment => comment.authorUserId === request.commentSearch.filterAuthorId)
      , [(l, r) => l.created.getTime() - r.created.getTime()])
      , this.DEFAULT_LIMIT, request.cursor));
  }
  commentUpdate(request: Client.CommentUpdateRequest): Promise<Client.CommentWithVote> {
    const comment = this.getImmutable(
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
        || comment.content && comment.content.indexOf(request.commentSearchAdmin.searchText) >= 0), this.DEFAULT_LIMIT, request.cursor));
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
    var searchText;
    if (!!request.ideaSearch.similarToIdeaId) {
      const idea = this.getProject(request.projectId).ideas.find(idea => idea.ideaId === request.ideaSearch.similarToIdeaId);
      if (!idea) return this.throwLater(404, 'Idea not found');
      searchText = idea.title.split(' ')[0] || '';
    } else {
      searchText = request.ideaSearch.searchText;
    }
    const allIdeas: Admin.Idea[] = this.getProject(request.projectId).ideas;
    const ideas: Admin.Idea[] = request.ideaSearch.fundedByMeAndActive
      ? this.getProject(request.projectId).votes
        .filter(v => v.fundAmount && v.fundAmount > 0)
        .map(v => allIdeas.find(i => i.ideaId === v.ideaId)!)
      : allIdeas;
    const categories = this.getProject(request.projectId).config.config.content.categories;
    return this.returnLater(this.filterCursor(this.sort(ideas
      .filter(idea => request.ideaSearch.filterAuthorId === undefined
        || (idea.authorUserId === request.ideaSearch.filterAuthorId))
      .filter(idea => !request.ideaSearch.fundedByMeAndActive
        || !idea.statusId
        || categories.find(c => c.categoryId === idea.categoryId)!
          .workflow
          .statuses
          .find(s => s.statusId === idea.statusId)!
          .disableFunding !== true)
      .filter(idea => !request.ideaSearch.filterTagIds
        || request.ideaSearch.filterTagIds.length === 0
        || request.ideaSearch.filterTagIds.filter(tagId =>
          idea.tagIds && idea.tagIds.includes(tagId)
        ).length > 0)
      .filter(idea => !request.ideaSearch.filterCategoryIds
        || request.ideaSearch.filterCategoryIds.includes(idea.categoryId))
      .filter(idea => request.ideaSearch.filterStatusIds === undefined
        || request.ideaSearch.filterStatusIds.length === 0
        || (idea.statusId && request.ideaSearch.filterStatusIds.includes(idea.statusId)))
      .filter(idea => searchText === undefined
        || idea.title.indexOf(searchText) >= 0
        || (idea.description || '').indexOf(searchText) >= 0)
      .map(idea => {
        const loggedInUser = this.getProject(request.projectId).loggedInUser;
        const vote = loggedInUser ? this.getProject(request.projectId).votes.find(vote => vote.ideaId === idea.ideaId && vote.voterUserId === loggedInUser.userId) : undefined;
        return { ...idea, vote: vote || {} };
      })
      , [(l, r) => {
        switch (request.ideaSearch.sortBy) {
          default: case Admin.IdeaSearchSortByEnum.Trending: return this.calcTrendingScore(r) - this.calcTrendingScore(l);
          case Admin.IdeaSearchSortByEnum.Top: return (this.calcScore(r) - this.calcScore(l));
          case Admin.IdeaSearchSortByEnum.New: return r.created.getTime() - l.created.getTime();
        }
      }])
      , request.ideaSearch.limit || this.DEFAULT_LIMIT, request.cursor), 1000);
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
  async configGet(request: Omit<Client.ConfigGetAndUserBindRequest, 'userBind'>): Promise<Omit<Client.ConfigAndBindResult, 'user'>> {
    const project = this.getProjectBySlug(request.slug);
    if (!project) return this.throwLater(404, 'Project not found');
    return this.returnLater({
      config: project.config,
    });
  }
  async configGetAndUserBind(request: Client.ConfigGetAndUserBindRequest): Promise<Client.ConfigAndBindResult> {
    const project = this.getProjectBySlug(request.slug);
    if (!project) return this.throwLater(404, 'Project not found');

    const configGet = await this.configGet(request);
    const userBind = await this.userBind({
      projectId: project.config.config.projectId,
      ...request,
    });

    return this.returnLater({
      config: configGet.config,
      user: userBind.user,
    });
  }
  userCreate(request: Client.UserCreateRequest): Promise<Client.UserCreateResponse> {
    if ((this.getProject(request.projectId).config.config.users.onboarding.notificationMethods.email?.verification === Client.EmailSignupVerificationEnum.Required
      || this.getProject(request.projectId).config.config.users.onboarding.notificationMethods.email?.allowedDomains !== undefined)
      && request.userCreate.email
      && !request.userCreate.emailVerification) {
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
        requiresEmailVerification: false,
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
    return this.returnLater();
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
                isSso: true,
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
    return this.returnLater();
  }
  userLogin(request: Client.UserLoginRequest): Promise<Client.UserMeWithBalance> {
    const user = this.getProject(request.projectId).users.find(user => user.email === request.userLogin.email);
    if (!user) return this.throwLater(404, 'Incorrect email or password');
    if (!request.userLogin.password) this.throwLater(403, '');
    if (user['password'] !== request.userLogin.password) this.throwLater(403, 'Incorrect email or password');
    this.getProject(request.projectId).loggedInUser = user;
    return this.returnLater(user);
  }
  userLoginAdmin(request: Admin.UserLoginAdminRequest): Promise<Client.UserMeWithBalance> {
    const user = this.getProject(request.projectId).users.find(user => user.userId === request.userId);
    if (!user) return this.throwLater(404, 'User not found');
    this.getProject(request.projectId).loggedInUser = user;
    return this.returnLater(user);
  }
  userLogout(request: Client.UserLogoutRequest): Promise<void> {
    this.getProject(request.projectId).loggedInUser = undefined;
    return this.returnLater();
  }
  userUpdate(request: Client.UserUpdateRequest): Promise<Client.UserMeWithBalance> {
    const user = this.getImmutable(
      this.getProject(request.projectId).users,
      user => user.userId === request.userId);
    if (request.userUpdate.name !== undefined) user.name = request.userUpdate.name;
    if (request.userUpdate.email !== undefined) user.email = request.userUpdate.email === '' ? undefined : request.userUpdate.email;
    if (request.userUpdate.emailNotify !== undefined) user.emailNotify = request.userUpdate.emailNotify;
    if (request.userUpdate.password !== undefined) {
      user.password = request.userUpdate.password;
      user.hasPassword = true;
    }
    if (request.userUpdate.iosPushToken !== undefined) {
      user.iosPushToken = request.userUpdate.iosPushToken === '' ? undefined : request.userUpdate.iosPushToken;
      user.iosPush = request.userUpdate.iosPushToken !== '';
    };
    if (request.userUpdate.androidPushToken !== undefined) {
      user.androidPushToken = request.userUpdate.androidPushToken === '' ? undefined : request.userUpdate.androidPushToken;
      user.androidPush = request.userUpdate.androidPushToken !== '';
    };
    if (request.userUpdate.browserPushToken !== undefined) {
      user.browserPushToken = request.userUpdate.browserPushToken === '' ? undefined : request.userUpdate.browserPushToken;
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
    return this.returnLater();
  }
  notificationClearAll(request: Client.NotificationClearAllRequest): Promise<void> {
    const loggedInUser = this.getProject(request.projectId).loggedInUser;
    if (!loggedInUser) return this.throwLater(403, 'Not logged in');
    this.getProject(request.projectId).notifications = this.getProject(request.projectId).notifications
      .filter(notification => notification.userId !== loggedInUser.userId);
    return this.returnLater();
  }
  notificationSearch(request: Client.NotificationSearchRequest): Promise<Client.NotificationSearchResponse> {
    const loggedInUser = this.getProject(request.projectId).loggedInUser;
    if (!loggedInUser) return this.throwLater(403, 'Not logged in');
    const notifications = this.getProject(request.projectId).notifications
      .filter(notification => notification.userId === loggedInUser.userId);
    return this.returnLater(this.filterCursor<Client.Notification>(notifications, 10, request.cursor));
  }
  commentDeleteAdmin(request: Admin.CommentDeleteAdminRequest): Promise<Admin.Comment> {
    const comment = this.getImmutable(
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
  ideaCreateAdmin(request: Admin.IdeaCreateAdminRequest): Promise<Admin.IdeaWithVote> {
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
    this.getProject(request.projectId).ideas.push(idea);
    this.getProject(request.projectId).votes.push({
      voterUserId: author.userId,
      ideaId: idea.ideaId,
      vote: Client.VoteOption.Upvote,
    });
    return this.returnLater({
      ...idea,
      vote: {
        vote: Client.VoteOption.Upvote,
      },
    });
  }
  ideaDeleteAdmin(request: Admin.IdeaDeleteAdminRequest): Promise<void> {
    const ideaIdIndex = this.getProject(request.projectId).ideas.findIndex(idea => idea.ideaId === request.ideaId);
    if (ideaIdIndex) {
      this.getProject(request.projectId).ideas.splice(ideaIdIndex, 1);
    }
    return this.returnLater();
  }
  ideaDeleteBulkAdmin(request: Admin.IdeaDeleteBulkAdminRequest): Promise<void> {
    throw new Error("Method not implemented.");
  }
  ideaGetAdmin(request: Admin.IdeaGetAdminRequest): Promise<Admin.Idea> {
    return this.ideaGetAdmin(request);
  }
  ideaSearchAdmin(request: Admin.IdeaSearchAdminRequest): Promise<Admin.IdeaSearchResponse> {
    throw new Error("Method not implemented.");
  }
  ideaUpdateAdmin(request: Admin.IdeaUpdateAdminRequest): Promise<Admin.Idea> {
    const idea = this.getImmutable(
      this.getProject(request.projectId).ideas,
      idea => idea.ideaId === request.ideaId);
    if (request.ideaUpdateAdmin.title !== undefined) idea.title = request.ideaUpdateAdmin.title;
    if (request.ideaUpdateAdmin.description !== undefined) idea.description = request.ideaUpdateAdmin.description;
    if (request.ideaUpdateAdmin.response !== undefined) {
      idea.response = request.ideaUpdateAdmin.response;
      const user = this.getProject(request.projectId).loggedInUser;
      if (user) {
        idea.responseAuthorName = user.name;
        idea.responseAuthorUserId = user.userId;
      }
    }
    if (request.ideaUpdateAdmin.statusId !== undefined) idea.statusId = request.ideaUpdateAdmin.statusId;
    if (request.ideaUpdateAdmin.tagIds !== undefined) idea.tagIds = request.ideaUpdateAdmin.tagIds;
    if (request.ideaUpdateAdmin.fundGoal !== undefined) idea.fundGoal = request.ideaUpdateAdmin.fundGoal;
    if (!request.ideaUpdateAdmin.suppressNotifications) {
      // Should send notifications here
    };
    return this.returnLater(idea);
  }
  configGetAdmin(request: Admin.ConfigGetAdminRequest): Promise<Admin.VersionedConfigAdmin> {
    if (!this.getProject(request.projectId)) return this.throwLater(404, 'Project not found');
    return this.returnLater(this.getProject(request.projectId).config);
  }
  configGetAllAndUserBindAllAdmin(): Promise<Admin.ConfigAndBindAllResult> {
    if (!this.loggedIn) return this.throwLater(403, 'Not logged in');
    const byProjectId = {};
    Object.keys(this.db).forEach(projectId => byProjectId[projectId] = {
      config: this.db[projectId].config,
      user: this.db[projectId].loggedInUser,
    })
    return this.returnLater({
      byProjectId,
    });
  }
  configSetAdmin(request: Admin.ConfigSetAdminRequest): Promise<Admin.VersionedConfigAdmin> {
    if (request.versionLast !== undefined && this.getProject(request.projectId).config.version !== request.versionLast) this.throwLater(412, 'Config changed since last reload');
    this.getProject(request.projectId).config = { config: request.configAdmin, version: randomUuid() };
    return this.returnLater(this.getProject(request.projectId).config);
  }
  projectCreateAdmin(request: Admin.ProjectCreateAdminRequest): Promise<Admin.NewProjectResult> {
    const projectId = `${request.configAdmin.slug}-${randomUuid().substring(0, 3)}`;
    request.configAdmin.projectId = projectId;
    this.getProject(projectId).config.config = request.configAdmin;
    return this.returnLater({
      projectId,
      config: this.getProject(projectId).config,
    });
  }
  projectDeleteAdmin(request: Admin.ProjectDeleteAdminRequest): Promise<void> {
    this.deleteProject(request.projectId);
    return this.returnLater();
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
    if (userIdIndex === undefined) return this.throwLater(404, 'User not found');
    this.getProject(request.projectId).users.splice(userIdIndex, 1);
    if (this.getProject(request.projectId).loggedInUser?.userId === request.userId) {
      this.getProject(request.projectId).loggedInUser = undefined;
    }
    return this.returnLater();
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
    const user = this.getImmutable(
      this.getProject(request.projectId).users,
      user => user.userId === request.userId);
    if (request.userUpdateAdmin.name !== undefined) user.name = request.userUpdateAdmin.name;
    if (request.userUpdateAdmin.email !== undefined) user.email = request.userUpdateAdmin.email === '' ? undefined : request.userUpdateAdmin.email;
    if (request.userUpdateAdmin.emailNotify !== undefined) user.emailNotify = request.userUpdateAdmin.emailNotify;
    if (request.userUpdateAdmin.password !== undefined) {
      user.password = request.userUpdateAdmin.password;
      user.hasPassword = true;
    }
    if (request.userUpdateAdmin.iosPush === false) {
      user.iosPushToken = undefined;
      user.iosPush = false;
    };
    if (request.userUpdateAdmin.androidPush === false) {
      user.androidPushToken = undefined;
      user.androidPush = false;
    };
    if (request.userUpdateAdmin.browserPush === false) {
      user.browserPushToken = undefined;
      user.browserPush = false;
    };
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
    const idea = this.getImmutable(
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
      idea.expressions = idea.expressions || [];

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
        idea.expressions[expression] = (idea.expressions[expression] || 0) + 1
      })
      expressionsToRemove.forEach(expression => {
        const weight = expressing?.limitEmojiSet ? expressing.limitEmojiSet.find(e => e.display === expression)?.weight || 0 : 1;
        idea.expressionsValue! -= weight;
        idea.expressions[expression] = (idea.expressions[expression] || 0) - 1
        if (idea.expressions[expression] <= 0) delete idea.expressions[expression];
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
    const comment = this.getImmutable(
      this.getProject(request.projectId).comments,
      comment => comment.commentId === request.commentId);
    const vote = this.getImmutable(
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
        users: [],
        votes: [],
        commentVotes: [],
        balances: {},
        notifications: [],
      };
      this.db[projectId] = project;
    }
    return project;
  }

  getProjectBySlug(slug: string) {
    return Object.values(this.db).find(p => p.config.config.slug === slug);
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

  async returnLater<T>(returnValue: T | undefined = undefined, additionalLatency?: number): Promise<T> {
    // if (!isProd()) console.log('Server SEND:', returnValue);
    if (additionalLatency) await this.wait(additionalLatency);
    await this.waitLatency();
    return returnValue === undefined ? undefined : JSON.parse(JSON.stringify(returnValue));
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
        // Recaptcha 'clearflask-localhost' site key
        challenge: '6Lcnvs4UAAAAAG2X4PqlukwjGIhgR_A_oXDt3XU2'
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
    await new Promise(resolve => setTimeout(resolve, latency));
  }

  generateId(): string {
    return randomUuid();
  }
}

export default ServerMock;
