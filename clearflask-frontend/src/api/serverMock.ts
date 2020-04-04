import * as ConfigEditor from '../common/config/configEditor';
import WebNotification from '../common/notification/webNotification';
import stringToSlug from '../common/util/slugger';
import randomUuid from '../common/util/uuid';
import * as Admin from './admin';
import * as Client from './client';

const AvailablePlans: { [planid: string]: Admin.Plan } = {
  '7CC22CC8-16C5-49DF-8AEB-2FD98D9059A7': {
    planid: '7CC22CC8-16C5-49DF-8AEB-2FD98D9059A7', title: 'Basic',
    pricing: { price: 50, period: Admin.PlanPricingPeriodEnum.Yearly },
    perks: [
      { desc: 'Unlimited users', terms: 'description' },
      { desc: 'Simple user voting', terms: 'description' },
      { desc: '1 hour feature credit', terms: 'description' },
    ],
    beta: true,
  },
  '9C7EA3A5-B4AE-46AA-9C2E-98659BC65B89': {
    planid: '9C7EA3A5-B4AE-46AA-9C2E-98659BC65B89', title: 'Basic',
    pricing: { price: 80, period: Admin.PlanPricingPeriodEnum.Monthly },
    perks: [
      { desc: 'Unlimited users', terms: 'description' },
      { desc: 'Simple user voting', terms: 'description' },
      { desc: '5 minute feature credit', terms: 'description' },
    ],
    beta: true,
  },
  'CDBF4982-1805-4352-8A57-824AFB565973': {
    planid: 'CDBF4982-1805-4352-8A57-824AFB565973', title: 'Analytic',
    perks: [
      { desc: 'Content analytics and search', terms: 'description' },
      { desc: 'Crowd-funding', terms: 'description' },
      { desc: 'Unlimited projects, users', terms: 'description' },
    ],
    comingSoon: true,
  },
  '597099E1-83B3-40AC-8AC3-52E9BF59A562': {
    planid: '597099E1-83B3-40AC-8AC3-52E9BF59A562', title: 'Enterprise',
    perks: [
      { desc: 'Multi-Agent Access', terms: 'description' },
      { desc: 'Whitelabel', terms: 'description' },
      { desc: 'Integrations, API Access', terms: 'description' },
      { desc: 'Dedicated/Onsite hosting', terms: 'description' },
      { desc: 'Custom SLA', terms: 'description' },
    ],
    comingSoon: true,
  },
};
const FeaturesTable: Admin.FeaturesTable = {
  plans: ['Basic', 'Analytic', 'Enterprise'],
  features: [
    { feature: 'Projects', values: ['Unlimited', 'Unlimited', 'Unlimited'] },
    { feature: 'Active users', values: ['Unlimited†', 'Unlimited†', 'Unlimited†'] },
    { feature: 'Customizable pages: Ideas, Roadmap, FAQ, Knowledge base, etc...', values: ['Yes', 'Yes', 'Yes'] },
    { feature: 'Voting and Emoji expressions', values: ['No', 'Yes', 'Yes'] },
    { feature: 'Credit system / Crowd-funding', values: ['No', 'Yes', 'Yes'] },
    { feature: 'Analytics', values: ['No', 'No', 'Yes'] },
    { feature: 'Multi agent access', values: ['No', 'No', 'Yes'] },
    { feature: 'Integrations', values: ['No', 'No', 'Yes'] },
    { feature: 'API access', values: ['No', 'No', 'Yes'] },
    { feature: 'Whitelabel', values: ['No', 'No', 'Yes'] },
  ],
  extraTerms: `† Unlimited assumes reasonable usage. Please contact us prior to deployment to ensure we are prepared for your traffic level.`,
};

interface CommentWithAuthorWithParentPath extends Client.CommentWithAuthor {
  parentIdPath: string[];
}

interface VoteWithAuthorAndIdeaId extends Admin.Vote {
  voterUserId: string;
  ideaId: string;
}

class ServerMock implements Client.ApiInterface, Admin.ApiInterface {
  static instance: ServerMock | undefined;

  readonly BASE_LATENCY = 1000;
  readonly DEFAULT_LIMIT = 10;
  hasLatency: boolean = false;

  // Mock account login (server-side cookie data)
  loggedIn: boolean = false;
  account?: Admin.AccountAdmin = undefined;
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
      ? { account: this.account } : {});
  }
  accountLoginAdmin(request: Admin.AccountLoginAdminRequest): Promise<Admin.AccountAdmin> {
    if (!this.account
      || request.accountLogin.email !== this.account.email
      || request.accountLogin.password !== this.accountPass) {
      return this.throwLater(403, 'Username or email incorrect');
    }
    this.loggedIn = true;
    return this.returnLater(this.account);
  }
  accountLogoutAdmin(): Promise<void> {
    this.loggedIn = false;
    return this.returnLater();
  }
  accountSignupAdmin(request: Admin.AccountSignupAdminRequest): Promise<Admin.AccountAdmin> {
    const plan = AvailablePlans[request.accountSignupAdmin.planid];
    if (!plan) return this.throwLater(404, 'Requested plan could not be found');
    const account: Admin.AccountAdmin = {
      plan: AvailablePlans[request.accountSignupAdmin.planid]!,
      company: request.accountSignupAdmin.company,
      name: request.accountSignupAdmin.name,
      email: request.accountSignupAdmin.email,
      phone: request.accountSignupAdmin.phone,
    };
    this.accountPass = request.accountSignupAdmin.password;
    this.account = account;
    this.loggedIn = true;
    return this.returnLater(account);
  }
  accountUpdateAdmin(request: Admin.AccountUpdateAdminRequest): Promise<Admin.AccountAdmin> {
    if (!this.account) return this.throwLater(403, 'Not logged in');
    if (request.accountUpdateAdmin.name) this.account.name = request.accountUpdateAdmin.name;
    if (request.accountUpdateAdmin.email) this.account.email = request.accountUpdateAdmin.email;
    if (request.accountUpdateAdmin.password) this.accountPass = request.accountUpdateAdmin.password;
    return this.returnLater(this.account);
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
      author: loggedInUser,
      authorUserId: loggedInUser.userId,
      created: new Date(),
      parentIdPath: parentIdPath,
      childCommentCount: 0,
      ...(request.commentCreate),
    };
    console.log('DEBUG', request, comment, request.commentCreate);
    parentComment && parentComment.childCommentCount++;
    const idea = this.getProject(request.projectId).ideas.find(idea => idea.ideaId === request.ideaId)!;
    idea.commentCount++;
    if (!comment.parentCommentId) {
      idea.childCommentCount++;
    }
    this.getProject(request.projectId).comments.push(comment);
    return this.returnLater(comment);
  }
  commentDelete(request: Client.CommentDeleteRequest): Promise<Admin.CommentWithAuthor> {
    return this.commentDeleteAdmin(request);
  }
  commentList(request: Client.CommentListRequest): Promise<Client.CommentSearchResponse> {
    const minCommentIdToExclude: string | '' = [
      ...(request.commentSearch.excludeChildrenCommentIds || []),
      ...(request.commentSearch.parentCommentId ? [request.commentSearch.parentCommentId] : []),
    ].reduce((l, r) => l > r ? l : r, '');
    const data = this.sort(this.getProject(request.projectId).comments
      .filter(comment => comment.ideaId === request.ideaId)
      .filter(comment => !request.commentSearch.parentCommentId || (comment.parentIdPath && comment.parentIdPath.includes(request.commentSearch.parentCommentId)))
      .filter(comment => !request.commentSearch.excludeChildrenCommentIds ||
        !request.commentSearch.excludeChildrenCommentIds.some(ec =>
          ec === comment.commentId
          || comment.parentIdPath.some(pc => ec === pc)))
      .filter(comment => !minCommentIdToExclude || comment.commentId > minCommentIdToExclude)
      .map(comment => {
        return {
          ...comment,
          author: comment.authorUserId ? this.getProject(request.projectId).users.find(user => user.userId === comment.authorUserId)! : undefined,
        }
      })
      , [(l, r) => l.created.getTime() - r.created.getTime()]);
    return this.returnLater({
      results: data.slice(0, Math.min(data.length, 10)),
    });
  }
  commentUpdate(request: Client.CommentUpdateRequest): Promise<Client.CommentWithAuthor> {
    const comment = this.getImmutable(
      this.getProject(request.projectId).comments,
      comment => comment.commentId === request.commentId);
    comment.content = request.commentUpdate.content;
    comment.edited = new Date();
    return this.returnLater(comment);
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
  ideaCreate(request: Client.IdeaCreateRequest): Promise<Client.Idea> {
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
    const allIdeas: Admin.Idea[] = this.getProject(request.projectId).ideas;
    const ideas: Admin.Idea[] = request.ideaSearch.fundedByMeAndActive
      ? this.getProject(request.projectId).votes
        .filter(v => v.fundAmount && v.fundAmount > 0)
        .map(v => allIdeas.find(i => i.ideaId === v.ideaId)!)
      : allIdeas;
    const categories = this.getProject(request.projectId).config.config.content.categories;
    return this.returnLater(this.filterCursor(this.sort(ideas
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
      .filter(idea => request.ideaSearch.searchText === undefined
        || idea.title.indexOf(request.ideaSearch.searchText) >= 0
        || (idea.description || '').indexOf(request.ideaSearch.searchText) >= 0)
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
      , request.ideaSearch.limit || this.DEFAULT_LIMIT, request.cursor));
  }
  ideaUpdate(request: Client.IdeaUpdateRequest): Promise<Client.Idea> {
    return this.ideaUpdateAdmin({
      ...request,
      ideaUpdateAdmin: {
        ...request.ideaUpdate,
      },
    });
  }
  configGetAndUserBind(request: Client.ConfigGetAndUserBindRequest): Promise<Client.ConfigAndBindResult> {
    if (!this.getProject(request.projectId)) return this.throwLater(404, 'Project not found');
    const loggedInUser = this.getProject(request.projectId).loggedInUser;
    return this.returnLater({
      config: this.getProject(request.projectId).config,
      user: loggedInUser ? {
        ...loggedInUser,
        balance: this.getProject(request.projectId).balances[loggedInUser.userId] || 0,
      } : undefined,
    });
  }
  projectLegalGet(request: Client.ProjectLegalGetRequest): Promise<Client.Legal> {
    if (!this.getProject(request.projectId)) return this.throwLater(404, 'Project not found');
    return this.returnLater(this.getProject(request.projectId).config.config.legal
      ? this.getProject(request.projectId).config.config.legal
      : {
        documents: [
          { shortName: 'Privacy', name: 'Privacy Policy', link: 'https://clearflask.com/privacy-policy' },
          { shortName: 'Terms', name: 'Terms of Service', link: 'https://clearflask.com/terms-of-service' },
        ]
      });
  }
  userCreate(request: Client.UserCreateRequest): Promise<Client.UserMeWithBalance> {
    return this.userCreateAdmin({
      projectId: request.projectId,
      userCreateAdmin: request.userCreate,
    }).then(user => {
      this.getProject(request.projectId).loggedInUser = user;
      return user;
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
  userGet(request: Client.UserGetRequest): Promise<Client.User> {
    const user = this.getProject(request.projectId).users.find(user => user.userId === request.userId);
    return user ? this.returnLater(user) : this.throwLater(404, 'User not found');
  }
  userLogin(request: Client.UserLoginRequest): Promise<Client.UserMeWithBalance> {
    throw new Error("Method not implemented.");
  }
  userLogout(request: Client.UserLogoutRequest): Promise<void> {
    this.getProject(request.projectId).loggedInUser = undefined;
    return this.returnLater();
  }
  userSsoCreateOrLogin(request: Client.UserSsoCreateOrLoginRequest): Promise<Client.UserMeWithBalance> {
    var token;
    try {
      token = JSON.parse(request.userSsoCreateOrLogin.token);
    } catch (er) {
      console.log('Failed parsing sso path param', er);
    }
    if (token['userId']) {
      const user = this.getProject(request.projectId).users.find(user => user.userId === token['userId']);
      if (user) {
        const balance = this.getProject(request.projectId).balances[user.userId] || 0;
        const userMeWithBalance = Admin.UserMeWithBalanceToJSON({ ...user, balance });
        this.getProject(request.projectId).loggedInUser = userMeWithBalance;
        return this.returnLater(userMeWithBalance);
      }
    }
    return this.userCreate({
      projectId: request.projectId,
      userCreate: typeof token === 'object' ? { ...token } : {},
    });
  }
  userUpdate(request: Client.UserUpdateRequest): Promise<Client.UserMeWithBalance> {
    const user = this.getImmutable(
      this.getProject(request.projectId).users,
      user => user.userId === request.userId);
    if (request.userUpdate.name !== undefined) user.name = request.userUpdate.name;
    if (request.userUpdate.email !== undefined) user.email = request.userUpdate.email === '' ? undefined : request.userUpdate.email;
    if (request.userUpdate.emailNotify !== undefined) user.emailNotify = request.userUpdate.emailNotify;
    if (request.userUpdate.password !== undefined) user.password = request.userUpdate.password === '' ? undefined : request.userUpdate.password;
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
  voteGetOwn(request: Client.VoteGetOwnRequest): Promise<Client.VoteGetOwnResponse> {
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
      results: votes
    });
  }
  voteUpdate(request: Client.VoteUpdateRequest): Promise<Client.VoteUpdateResponse> {
    const loggedInUser = this.getProject(request.projectId).loggedInUser;
    if (!loggedInUser) return this.throwLater(403, 'Not logged in');
    return this.voteUpdateAdmin({
      ...request,
      voteUpdateAdmin: {
        ...(request.voteUpdate),
        vote: request.voteUpdate.vote,
        voterUserId: loggedInUser.userId,
      }
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
  commentDeleteAdmin(request: Admin.CommentDeleteAdminRequest): Promise<Admin.CommentWithAuthor> {
    const comment = this.getImmutable(
      this.getProject(request.projectId).comments,
      comment => comment.commentId === request.commentId);
    comment.content = undefined;
    comment.authorUserId = undefined;
    comment.author = undefined;
    comment.edited = new Date();
    return this.returnLater(comment);
  }
  transactionCreateAdmin(request: Admin.TransactionCreateAdminRequest): Promise<Admin.Transaction> {
    var balance = this.getProject(request.projectId).balances[request.userId] || 0;
    balance += request.transactionCreateAdmin.amount;
    const transaction = {
      userId: request.userId,
      transactionId: randomUuid(),
      created: new Date(),
      amount: request.transactionCreateAdmin.amount,
      balance: balance,
      transactionType: Admin.TransactionType.Adjustment,
      summary: request.transactionCreateAdmin.summary,
    };
    this.getProject(request.projectId).transactions.push(transaction);
    this.getProject(request.projectId).balances[request.userId] = balance;
    return this.returnLater(transaction);
  }
  transactionSearchAdmin(request: Admin.TransactionSearchAdminRequest): Promise<Admin.TransactionSearchAdminResponse> {
    throw new Error("Method not implemented.");
  }
  ideaCreateAdmin(request: Admin.IdeaCreateAdminRequest): Promise<Admin.Idea> {
    const author = this.getProject(request.projectId).users.find(user => user.userId === request.ideaCreateAdmin.authorUserId);
    if (!author) return this.throwLater(404, 'Author of idea not found');
    const idea: Admin.Idea = {
      ideaId: stringToSlug(request.ideaCreateAdmin.title + '-' + randomUuid().substring(0, 5)),
      created: new Date(),
      commentCount: 0,
      childCommentCount: 0,
      authorName: author.name,
      ...(request.ideaCreateAdmin),
    };
    if (request.ideaCreateAdmin.statusId === undefined) {
      idea.statusId = this.getProject(request.projectId).config.config.content.categories
        .find(c => c.categoryId === request.ideaCreateAdmin.categoryId)!.workflow.entryStatus;
    }
    this.getProject(request.projectId).ideas.push(idea);
    return this.returnLater(idea);
  }
  ideaDeleteAdmin(request: Admin.IdeaDeleteAdminRequest): Promise<void> {
    throw new Error("Method not implemented.");
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
    if (request.ideaUpdateAdmin.response !== undefined) idea.response = request.ideaUpdateAdmin.response;
    if (request.ideaUpdateAdmin.statusId !== undefined) idea.statusId = request.ideaUpdateAdmin.statusId;
    if (request.ideaUpdateAdmin.tagIds !== undefined) idea.tagIds = request.ideaUpdateAdmin.tagIds;
    if (request.ideaUpdateAdmin.fundGoal !== undefined) idea.fundGoal = request.ideaUpdateAdmin.fundGoal;
    if (!request.ideaUpdateAdmin.suppressNotifications) {
      // TODO send notifications
    };
    return this.returnLater(idea);
  }
  configGetAdmin(request: Admin.ConfigGetAdminRequest): Promise<Admin.VersionedConfigAdmin> {
    if (!this.getProject(request.projectId)) return this.throwLater(404, 'Project not found');
    return this.returnLater(this.getProject(request.projectId).config);
  }
  configGetAllAdmin(): Promise<Admin.ConfigGetAllResult> {
    if (!this.loggedIn) return this.throwLater(403, 'Not logged in');
    return this.returnLater({
      configs: Object.values(this.db).map(p => p.config),
    });
  }
  configSetAdmin(request: Admin.ConfigSetAdminRequest): Promise<Admin.VersionedConfigAdmin> {
    if (request.versionLast !== undefined && this.getProject(request.projectId).config.version !== request.versionLast) this.throwLater(412, 'Config changed since last reload');
    this.getProject(request.projectId).config = { config: request.configAdmin, version: randomUuid() };
    return this.returnLater(this.getProject(request.projectId).config);
  }
  projectCreateAdmin(request: Admin.ProjectCreateAdminRequest): Promise<Admin.NewProjectResult> {
    this.getProject(request.projectId).config.config = request.configAdmin;
    return this.returnLater({
      projectId: request.projectId,
      config: this.getProject(request.projectId).config,
    });
  }
  userCreateAdmin(request: Admin.UserCreateAdminRequest): Promise<Admin.UserAdmin> {
    const user: Admin.UserAdmin = {
      userId: randomUuid(),
      created: new Date(),
      balance: 0,
      emailNotify: !!request.userCreateAdmin.email,
      iosPush: !!request.userCreateAdmin.iosPushToken,
      androidPush: !!request.userCreateAdmin.androidPushToken,
      browserPush: !!request.userCreateAdmin.browserPushToken,
      ...request.userCreateAdmin,
    };
    this.getProject(request.projectId).users.push(user);
    return this.returnLater(user);
  }
  userDeleteAdmin(request: Admin.UserDeleteAdminRequest): Promise<void> {
    const userIdIndex = this.getProject(request.projectId).users.findIndex(user => user.userId === request.userId);
    if (userIdIndex) {
      this.getProject(request.projectId).users.splice(userIdIndex, 1);
    }
    return this.returnLater();
  }
  userDeleteBulkAdmin(request: Admin.UserDeleteBulkAdminRequest): Promise<void> {
    throw new Error("Method not implemented.");
  }
  userGetAdmin(request: Admin.UserGetAdminRequest): Promise<Admin.UserAdmin> {
    throw new Error("Method not implemented.");
  }
  userSearchAdmin(request: Admin.UserSearchAdminRequest): Promise<Admin.UserSearchResponse> {
    return this.returnLater(this.filterCursor(this.getProject(request.projectId).users
      .filter(user => !request.userSearchAdmin.searchText
        || user.name && user.name.indexOf(request.userSearchAdmin.searchText) >= 0
        || user.email && user.email.indexOf(request.userSearchAdmin.searchText) >= 0)
      .map(user => ({
        ...user,
        balance: this.getProject(request.projectId).balances[user.userId],
      }))
      , this.DEFAULT_LIMIT, request.cursor));
  }
  userUpdateAdmin(request: Admin.UserUpdateAdminRequest): Promise<Admin.UserAdmin> {
    const user = this.getImmutable(
      this.getProject(request.projectId).users,
      user => user.userId === request.userId);
    if (request.userUpdateAdmin.name !== undefined) user.name = request.userUpdateAdmin.name;
    if (request.userUpdateAdmin.email !== undefined) user.email = request.userUpdateAdmin.email === '' ? undefined : request.userUpdateAdmin.email;
    if (request.userUpdateAdmin.emailNotify !== undefined) user.emailNotify = request.userUpdateAdmin.emailNotify;
    if (request.userUpdateAdmin.password !== undefined) user.password = request.userUpdateAdmin.password === '' ? undefined : request.userUpdateAdmin.password;
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
    if (request.userUpdateAdmin.transactionCreate !== undefined) {
      balance = (balance || 0) + request.userUpdateAdmin.transactionCreate.amount;
      const transaction = {
        userId: request.userId,
        transactionId: randomUuid(),
        created: new Date(),
        amount: request.userUpdateAdmin.transactionCreate.amount,
        balance: balance,
        transactionType: Admin.TransactionType.Adjustment,
        summary: request.userUpdateAdmin.transactionCreate.summary,
      };
      this.getProject(request.projectId).transactions.push(transaction);
      this.getProject(request.projectId).balances[request.userId] = balance;
    }
    return this.returnLater({
      ...user,
      balance: balance,
    });
  }
  voteDeleteAdmin(request: Admin.VoteDeleteAdminRequest): Promise<void> {
    throw new Error("Method not implemented.");
  }
  voteDeleteBulkAdmin(request: Admin.VoteDeleteBulkAdminRequest): Promise<void> {
    throw new Error("Method not implemented.");
  }
  voteSearchAdmin(request: Admin.VoteSearchAdminRequest): Promise<Admin.VoteSearchResponse> {
    throw new Error("Method not implemented.");
  }
  voteUpdateAdmin(request: Admin.VoteUpdateAdminRequest): Promise<Admin.VoteUpdateAdminResponse> {
    const idea = this.getImmutable(
      this.getProject(request.projectId).ideas,
      idea => idea.ideaId === request.voteUpdateAdmin.ideaId);
    const vote: VoteWithAuthorAndIdeaId = this.getImmutable(
      this.getProject(request.projectId).votes,
      vote => vote.voterUserId === request.voteUpdateAdmin.voterUserId && vote.ideaId === request.voteUpdateAdmin.ideaId,
      () => ({ ideaId: idea.ideaId, voterUserId: request.voteUpdateAdmin.voterUserId }));
    var balance: number | undefined;
    var transaction: Admin.Transaction | undefined;
    if (request.voteUpdateAdmin.fundDiff !== undefined) {
      const fundDiff = request.voteUpdateAdmin.fundDiff;
      if (fundDiff === 0) return this.throwLater(400, 'Cannot fund zero');
      balance = this.getProject(request.projectId).balances[request.voteUpdateAdmin.voterUserId] || 0;
      balance -= fundDiff;
      if (balance < 0) return this.throwLater(403, 'Insufficient funds');
      const fundersCountDiff = ((vote.fundAmount || 0) + fundDiff > 0 ? 1 : 0) - ((vote.fundAmount || 0) > 0 ? 1 : 0)
      transaction = {
        userId: request.voteUpdateAdmin.voterUserId,
        transactionId: randomUuid(),
        created: new Date(),
        amount: fundDiff,
        balance: balance,
        transactionType: Admin.TransactionType.Vote,
        targetId: request.voteUpdateAdmin.ideaId,
        summary: `Funding for "${idea.title.length > 50 ? idea.title.substring(0, 47) + '...' : idea.title}"`
      };
      this.getProject(request.projectId).transactions.push(transaction);
      vote.fundAmount = (vote.fundAmount || 0) + request.voteUpdateAdmin.fundDiff;
      this.getProject(request.projectId).balances[request.voteUpdateAdmin.voterUserId] = balance;
      idea.funded = (idea.funded || 0) + fundDiff;
      if (fundersCountDiff !== 0) idea.fundersCount = (idea.fundersCount || 0) + fundersCountDiff;
    }
    if (request.voteUpdateAdmin.vote) {
      var votePrevValue: number = 0;
      switch (vote.vote) {
        case Admin.VoteOption.Upvote:
          votePrevValue = 1;
          break;
        case Admin.VoteOption.Downvote:
          votePrevValue = -1;
          break;
      }
      var voteValue: number = 0;
      switch (request.voteUpdateAdmin.vote) {
        case Admin.VoteOption.Upvote:
          voteValue = 1;
          vote.vote = Admin.VoteOption.Upvote;
          break;
        case Admin.VoteOption.Downvote:
          voteValue = -1;
          vote.vote = Admin.VoteOption.Downvote;
          break;
        case Admin.VoteOption.None:
          voteValue = 0;
          vote.vote = undefined;
          break;
      }
      const votersCountDiff = Math.abs(voteValue) - Math.abs(votePrevValue);
      if (votersCountDiff !== 0) idea.votersCount = (idea.votersCount || 0) + votersCountDiff;
      const voteValueDiff = voteValue - votePrevValue;
      if (voteValueDiff !== 0) idea.voteValue = (idea.voteValue || 0) + voteValueDiff;
    }
    if (request.voteUpdateAdmin.expressions) {
      var expressionsSet = new Set<string>(vote.expression || []);
      idea.expressionsValue = idea.expressionsValue || 0;
      idea.expressions = idea.expressions || [];

      var expressionsToAdd: string[] = [];
      var expressionsToRemove: string[] = [];
      if (request.voteUpdateAdmin.expressions.action === Admin.VoteUpdateExpressionsActionEnum.Set) {
        expressionsSet = new Set<string>([request.voteUpdateAdmin.expressions.expression!]);
        expressionsToAdd.push(request.voteUpdateAdmin.expressions.expression!);
        expressionsToRemove = (vote.expression || []).filter(e => e !== request.voteUpdateAdmin.expressions!.expression);
      } else if (request.voteUpdateAdmin.expressions.action === Admin.VoteUpdateExpressionsActionEnum.Unset) {
        expressionsSet = new Set<string>();
        expressionsToRemove = vote.expression || [];
      } else if (request.voteUpdateAdmin.expressions.action === Admin.VoteUpdateExpressionsActionEnum.Add) {
        if (!expressionsSet.has(request.voteUpdateAdmin.expressions.expression!)) {
          expressionsToAdd.push(request.voteUpdateAdmin.expressions.expression!);
          expressionsSet.add(request.voteUpdateAdmin.expressions.expression!);
        }
      } else if (request.voteUpdateAdmin.expressions.action === Admin.VoteUpdateExpressionsActionEnum.Remove) {
        if (expressionsSet.has(request.voteUpdateAdmin.expressions.expression!)) {
          expressionsToRemove.push(request.voteUpdateAdmin.expressions.expression!);
          expressionsSet.delete(request.voteUpdateAdmin.expressions.expression!);
        }
      }

      const expressing: Admin.Expressing = this.getProject(request.projectId).config.config.content.categories.find(c => c.categoryId === idea.categoryId)!.support.express as Admin.Expressing;
      expressionsToAdd.forEach(expression => {
        const weight = expressing.limitEmojiSet ? expressing.limitEmojiSet.find(e => e.display === expression)!.weight : 1;
        idea.expressionsValue! += weight;
        idea.expressions[expression] = (idea.expressions[expression] || 0) + 1
      })
      expressionsToRemove.forEach(expression => {
        const weight = expressing.limitEmojiSet ? expressing.limitEmojiSet.find(e => e.display === expression)!.weight : 1;
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
    WebNotification.getInstance().swRegistration!.showNotification(
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
        balances: {},
        notifications: [],
      };
      this.db[projectId] = project;
    }
    return project;
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

  filterCursor<T>(data: T[], limit: number, cursor?: string): { results: T[], cursor?: string } {
    var currentCursor = cursor ? parseInt(cursor) : 0;
    return {
      results: data.slice(currentCursor, Math.min(data.length, currentCursor + limit)),
      cursor: (data.length >= currentCursor + limit) ? currentCursor + limit + '' : undefined,
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

  async returnLater<T>(returnValue: T | undefined = undefined): Promise<T> {
    // console.log('Server SEND:', returnValue);
    await this.waitLatency();
    return returnValue === undefined ? undefined : JSON.parse(JSON.stringify(returnValue));
  }

  async throwLater(httpStatus: number, userFacingMessage?: string): Promise<any> {
    console.log('Server THROW:', httpStatus, userFacingMessage);
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
    console.log('Server THROW: rateLimit captcha:', captcha);
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
      await new Promise(resolve => setTimeout(resolve, this.BASE_LATENCY + this.BASE_LATENCY * Math.random()));
    }
  }

  generateId(): string {
    return randomUuid();
  }
}

export default ServerMock;
