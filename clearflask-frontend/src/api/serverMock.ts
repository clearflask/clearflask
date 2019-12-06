import * as Client from './client';
import * as Admin from './admin';
import randomUuid from '../common/util/uuid';
import * as ConfigEditor from '../common/config/configEditor';
import stringToSlug from '../common/util/slugger';
import WebNotification from '../common/notification/webNotification';

const AvailablePlans:{[planid:string]:Admin.Plan} = {
  '7CC22CC8-16C5-49DF-8AEB-2FD98D9059A7': {
    planid: '7CC22CC8-16C5-49DF-8AEB-2FD98D9059A7', title: 'Basic', pricing: {price: 50, period: Admin.PlanPricingPeriodEnum.Yearly},
    perks: [
      {desc: 'Unlimited users', terms: 'description'},
      {desc: 'Simple user voting', terms: 'description'},
      {desc: '1 hour credit', terms: 'description'},
    ],
  },
  '9C7EA3A5-B4AE-46AA-9C2E-98659BC65B89': {
    planid: '9C7EA3A5-B4AE-46AA-9C2E-98659BC65B89', title: 'Basic', pricing: {price: 80, period: Admin.PlanPricingPeriodEnum.Quarterly},
    perks: [
      {desc: 'Unlimited users', terms: 'description'},
      {desc: 'Simple user voting', terms: 'description'},
      {desc: '15 minute credit', terms: 'description'},
    ],
  },
  'CDBF4982-1805-4352-8A57-824AFB565973': {
    planid: 'CDBF4982-1805-4352-8A57-824AFB565973', title: 'Analytic', pricing: {price: 300, period: Admin.PlanPricingPeriodEnum.Yearly},
    perks: [
      {desc: 'Content analytics and search', terms: 'description'},
      {desc: 'Crowd-funding', terms: 'description'},
      {desc: 'Unlimited projects, users', terms: 'description'},
      {desc: '10 hour credit', terms: 'description'},
    ],
  },
  '89C4E0BB-92A8-4F83-947A-8C39DC8CEA5A': {
    planid: '89C4E0BB-92A8-4F83-947A-8C39DC8CEA5A', title: 'Analytic', pricing: {price: 450, period: Admin.PlanPricingPeriodEnum.Quarterly},
    perks: [
      {desc: 'Content analytics and search', terms: 'description'},
      {desc: 'Crowd-funding', terms: 'description'},
      {desc: 'Unlimited projects, users', terms: 'description'},
      {desc: '1 hour credit', terms: 'description'},
    ],
  },
  '597099E1-83B3-40AC-8AC3-52E9BF59A562': {
    planid: '597099E1-83B3-40AC-8AC3-52E9BF59A562', title: 'Enterprise',
    perks: [
      {desc: 'Multi-Agent Access', terms: 'description'},
      {desc: 'Whitelabel', terms: 'description'},
      {desc: 'Integrations, API Access', terms: 'description'},
      {desc: 'Dedicated/Onsite hosting', terms: 'description'},
      {desc: 'Custom SLA', terms: 'description'},
    ],
  },
};
const FeaturesTable:Admin.FeaturesTable = {
  plans: [ 'Basic', 'Analytic', 'Enterprise'],
  features:[
    {feature: 'Projects', values: ['1','Unlimited','Unlimited']},
    {feature: 'Active users', values: ['Unlimited','Unlimited','Unlimited']},
    {feature: 'User submitted content', values: ['Unlimited','Unlimited','Unlimited']},
    {feature: 'Customizable pages: Ideas, Roadmap, FAQ, Knowledge base, etc...', values: ['Yes', 'Yes', 'Yes']},
    {feature: 'Voting and Emoji expressions', values: ['No', 'Yes', 'Yes']},
    {feature: 'Credit system / Crowd-funding', values: ['No', 'Yes', 'Yes']},
    {feature: 'Analytics', values: ['No', 'No', 'Yes']},
    {feature: 'Multi agent access', values: ['No', 'No', 'Yes']},
    {feature: 'Integrations', values: ['No', 'No', 'Yes']},
    {feature: 'API access', values: ['No', 'No', 'Yes']},
    {feature: 'Whitelabel', values: ['No', 'No', 'Yes']},
  ],
};

class ServerMock implements Client.ApiInterface, Admin.ApiInterface {
  static instance:ServerMock|undefined;

  readonly BASE_LATENCY = 300;
  readonly DEFAULT_LIMIT = 10;
  hasLatency:boolean = false;

  // Mock account login (server-side cookie data)
  loggedIn:boolean = false;
  account?:Admin.AccountAdmin = undefined;
  accountPass?:string = undefined;
  // Mock project database
  readonly db:{
    [projectId:string]: {
      loggedInUser?:Admin.UserAdmin; // Mock server-side cookie data
      config: Admin.VersionedConfigAdmin,
      comments: Admin.Comment[];
      ideas: Admin.IdeaAdmin[];
      users: Admin.UserAdmin[];
      votes: Admin.Vote[];
      transactions: Admin.Transaction[];
      balances: {[userId: string]: number};
      notifications: Client.Notification[];
    }
  } = {};

  static get():ServerMock {
    if(ServerMock.instance === undefined) ServerMock.instance = new ServerMock();
    return ServerMock.instance;
  }

  setLatency(enabled:boolean) {
    this.hasLatency = enabled;
  }

  plansGet(): Promise<Admin.PlansGetResponse> {
    return this.returnLater({
      plans: Object.values(AvailablePlans),
      featuresTable: FeaturesTable,
    });
  }
  accountBindAdmin(): Promise<Admin.AccountAdmin> {
    if(!this.loggedIn || !this.account) return this.throwLater(403);
    return this.returnLater(this.account);
  }
  accountLoginAdmin(request: Admin.AccountLoginAdminRequest): Promise<Admin.AccountAdmin> {
    if(!this.account
      || request.accountLogin.email !== this.account.email
      || request.accountLogin.password !== this.accountPass) {
      return this.throwLater(403, 'Username or email incorrect');
    }
    this.loggedIn = true;
    return this.returnLater(this.account);
  }
  accountLogoutAdmin(): Promise<void> {
    this.loggedIn = false;
    return this.returnLater(undefined);
  }
  accountSignupAdmin(request: Admin.AccountSignupAdminRequest): Promise<Admin.AccountAdmin> {
    const plan = AvailablePlans[request.accountSignupAdmin.planid];
    if(!plan) return this.throwLater(404, 'Requested plan could not be found');
    const account:Admin.AccountAdmin = {
      plans: [],
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
  commentCreate(request: Client.CommentCreateRequest): Promise<Client.Comment> {
    const loggedInUser = this.getProject(request.projectId).loggedInUser;
    if(!loggedInUser) return this.throwLater(403, 'Not logged in');
    return this.commentCreateAdmin({
      ...request,
      commentCreateAdmin: {
        ...request.commentCreate,
        authorUserId: loggedInUser.userId,
      },
    });
  }
  commentDelete(request: Client.CommentDeleteRequest): Promise<Admin.Comment> {
    return this.commentDeleteAdmin(request);
  }
  commentList(request: Client.CommentListRequest): Promise<Client.CommentSearchResponse> {
    return this.returnLater(this.filterCursor(this.sort(this.getProject(request.projectId).comments
      .filter(comment => comment.ideaId === request.ideaId)
      .map(comment => {return {
        ...comment,
        author: comment.authorUserId ? this.getProject(request.projectId).users.find(user => user.userId === comment.authorUserId)! : undefined,
      }})
      ,[(l,r) => r.created.getTime() - l.created.getTime()]) // TODO improve sort
      ,this.DEFAULT_LIMIT, request.cursor));
  }
  commentUpdate(request: Client.CommentUpdateRequest): Promise<Client.Comment> {
    return this.commentUpdateAdmin(request);
  }
  transactionSearch(request: Client.TransactionSearchRequest): Promise<Client.TransactionSearchResponse> {
    const loggedInUser = this.getProject(request.projectId).loggedInUser;
    if(!loggedInUser) return this.throwLater(403, 'Not logged in');
    if(request.transactionSearch.filterAmountMax !== undefined
      || request.transactionSearch.filterAmountMin !== undefined
      || request.transactionSearch.filterCreatedEnd !== undefined
      || request.transactionSearch.filterCreatedStart !== undefined
      || request.transactionSearch.filterTransactionTypes !== undefined
      ) throw new Error("Filters not implemented.");
    const balance = this.getProject(request.projectId).balances[loggedInUser.userId] || 0;
    const transactions = this.getProject(request.projectId).transactions.filter(t => t.userId === loggedInUser.userId);
    transactions.sort((l,r) => r.created.valueOf() - l.created.valueOf());
    return this.returnLater({
      ...this.filterCursor<Client.Transaction>(transactions, 10, request.cursor),
      balance: {balance},
    });
  }
  ideaCreate(request: Client.IdeaCreateRequest): Promise<Client.Idea> {
    return this.ideaCreateAdmin({
      projectId: request.projectId,
      ideaCreateAdmin: request.ideaCreate,
    });
  }
  ideaDelete(request: Client.IdeaDeleteRequest): Promise<void> {
    throw new Error("Method not implemented.");
  }
  ideaGet(request: Client.IdeaGetRequest): Promise<Client.IdeaWithAuthorAndVote> {
    return this.ideaGetAdmin(request);
  }
  ideaSearch(request: Client.IdeaSearchRequest): Promise<Client.IdeaSearchResponse> {
    const allIdeas:Admin.IdeaAdmin[] = this.getProject(request.projectId).ideas;
    const ideas:Admin.IdeaAdmin[] = request.ideaSearch.fundedByMeAndActive
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
        const author = this.getProject(request.projectId).users.find(user => user.userId === idea.authorUserId);
        if(!author) throw Error('Author of idea not found');
        const loggedInUser = this.getProject(request.projectId).loggedInUser;
        const vote = loggedInUser ? this.getProject(request.projectId).votes.find(vote => vote.ideaId === idea.ideaId && vote.voterUserId === loggedInUser.userId) : undefined;
        return { ...idea, author: author, vote: vote };
      })
      ,[(l,r) => {switch(request.ideaSearch.sortBy){
          default: case Admin.IdeaSearchSortByEnum.Trending: return this.calcTrendingScore(r) - this.calcTrendingScore(l);
          case Admin.IdeaSearchSortByEnum.Top: return (this.calcScore(r) - this.calcScore(l));
          case Admin.IdeaSearchSortByEnum.New: return r.created.getTime() - l.created.getTime();
      }}])
      ,request.ideaSearch.limit || this.DEFAULT_LIMIT, request.cursor));
  }
  ideaUpdate(request: Client.IdeaUpdateRequest): Promise<Client.Idea> {
    throw new Error("Method not implemented.");
  }
  configGetAndUserBind(request: Client.ConfigGetAndUserBindRequest): Promise<Client.ConfigAndBindResult> {
    if(!this.getProject(request.projectId)) return this.throwLater(404, 'Project not found');
    const loggedInUser = this.getProject(request.projectId).loggedInUser;
    return this.returnLater({
      config: this.getProject(request.projectId).config,
      user: loggedInUser ? {
        ...loggedInUser,
        balance: this.getProject(request.projectId).balances[loggedInUser.userId] || 0,
      } : undefined,
    });
  }
  userCreate(request: Client.UserCreateRequest, isSso?:boolean): Promise<Client.UserMeWithBalance> {
    return this.userCreateAdmin({
      projectId: request.projectId,
      userCreateAdmin: request.userCreate,
    }, isSso).then(user => {
      this.getProject(request.projectId).loggedInUser = user;
      return user;
    });
  }
  userDelete(request: Client.UserDeleteRequest): Promise<void> {
    const loggedInUser = this.getProject(request.projectId).loggedInUser;
    if(!loggedInUser) return this.throwLater(403, 'Not logged in');
    const userIdIndex = this.getProject(request.projectId).users.findIndex(user => user.userId === loggedInUser.userId);
    if(userIdIndex) {
      this.getProject(request.projectId).users.splice(userIdIndex, 1);
    }
    this.getProject(request.projectId).loggedInUser = undefined;
    return this.returnLater(undefined);
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
    return this.returnLater(undefined);
  }
  userSsoCreateOrLogin(request: Client.UserSsoCreateOrLoginRequest): Promise<Client.UserMeWithBalance> {
    var token;
    try {
      token = JSON.parse(request.userSsoCreateOrLogin.token);
    } catch(er) {
      console.log('Failed parsing sso path param', er);
    }
    if(token['userId']) {
      const user = this.getProject(request.projectId).users.find(user => user.userId === token['userId']);
      if(user) {
        const balance = this.getProject(request.projectId).balances[user.userId] || 0;
        const userMeWithBalance = Admin.UserMeWithBalanceToJSON({...user, balance});
        this.getProject(request.projectId).loggedInUser = userMeWithBalance;
        return this.returnLater(userMeWithBalance);
      }
    }
    return this.userCreate({
      projectId: request.projectId,
      userCreate: typeof token === 'object' ? {...token} : {},
    }, true);
  }
  userUpdate(request: Client.UserUpdateRequest): Promise<Client.UserMeWithBalance> {
    return this.userUpdateAdmin(request)
      .then(user => {
        this.getProject(request.projectId).loggedInUser = user;
        return user;
      });
  }
  voteGetOwn(request: Client.VoteGetOwnRequest): Promise<Client.VoteGetOwnResponse> {
    const loggedInUser = this.getProject(request.projectId).loggedInUser;
    if(!loggedInUser) return this.throwLater(403, 'Not logged in');
    const votes = this.getProject(request.projectId).votes.filter(vote => vote.voterUserId === loggedInUser.userId && request.voteGetOwn.ideaIds.includes(vote.ideaId));
    return this.returnLater({results: votes});
  }
  voteUpdate(request: Client.VoteUpdateRequest): Promise<Client.VoteUpdateResponse> {
    const loggedInUser = this.getProject(request.projectId).loggedInUser;
    if(!loggedInUser) return this.throwLater(403, 'Not logged in');
    return this.voteUpdateAdmin({
      ...request,
      voteUpdate: {
        ...(request.voteUpdate),
        voterUserId: loggedInUser.userId,
      }
    });
  }
  notificationClear(request: Client.NotificationClearRequest): Promise<void> {
    const loggedInUser = this.getProject(request.projectId).loggedInUser;
    if(!loggedInUser || request.notificationClear.userId !== loggedInUser.userId) return this.throwLater(403, 'Not logged in');
    this.getProject(request.projectId).notifications = this.getProject(request.projectId).notifications
      .filter(notification => notification.userId !== loggedInUser.userId
        || notification.notificationId !== request.notificationId);
    return this.returnLater(undefined);
  }
  notificationClearAll(request: Client.NotificationClearAllRequest): Promise<void> {
    const loggedInUser = this.getProject(request.projectId).loggedInUser;
    if(!loggedInUser || request.userId !== loggedInUser.userId) return this.throwLater(403, 'Not logged in');
    this.getProject(request.projectId).notifications = this.getProject(request.projectId).notifications
      .filter(notification => notification.userId !== loggedInUser.userId);
    return this.returnLater(undefined);
  }
  notificationSearch(request: Client.NotificationSearchRequest): Promise<Client.NotificationSearchResponse> {
    const loggedInUser = this.getProject(request.projectId).loggedInUser;
    if(!loggedInUser || request.userId !== loggedInUser.userId) return this.throwLater(403, 'Not logged in');
    const notifications = this.getProject(request.projectId).notifications
      .filter(notification => notification.userId === loggedInUser.userId);
    return this.returnLater(this.filterCursor<Client.Notification>(notifications, 10, request.cursor));
  }
  commentCreateAdmin(request: Admin.CommentCreateAdminRequest): Promise<Admin.Comment> {
    const comment:Admin.Comment = {
      ideaId: request.ideaId,
      commentId: randomUuid(),
      created: new Date(),
      ...(request.commentCreateAdmin),
    };
    this.getProject(request.projectId).comments.push(comment);
    return this.returnLater(comment);
  }
  commentDeleteAdmin(request: Admin.CommentDeleteAdminRequest): Promise<Admin.Comment> {
    const comment = this.getImmutable(
      this.getProject(request.projectId).comments,
      comment => comment.commentId === request.commentId);
    comment.content = undefined;
    comment.authorUserId = undefined;
    comment.edited = new Date();
    return this.returnLater(comment);
  }
  commentDeleteBulkAdmin(request: Admin.CommentDeleteBulkAdminRequest): Promise<void> {
    throw new Error("Method not implemented.");
  }
  commentSearchAdmin(request: Admin.CommentSearchAdminRequest): Promise<Admin.CommentSearchResponse> {
    throw new Error("Method not implemented.");
  }
  commentUpdateAdmin(request: Admin.CommentUpdateAdminRequest): Promise<Admin.Comment> {
    const comment = this.getImmutable(
      this.getProject(request.projectId).comments,
      comment => comment.commentId === request.commentId);
    comment.content = request.commentUpdate.content;
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
  ideaCreateAdmin(request: Admin.IdeaCreateAdminRequest): Promise<Admin.IdeaAdmin> {
    const idea:Admin.IdeaAdmin = {
      ideaId: stringToSlug(request.ideaCreateAdmin.title + '-' + randomUuid().substring(0,5)),
      created: new Date(),
      ...(request.ideaCreateAdmin),
    };
    this.getProject(request.projectId).ideas.push(idea);
    return this.returnLater(idea);
  }
  ideaDeleteAdmin(request: Admin.IdeaDeleteAdminRequest): Promise<void> {
    throw new Error("Method not implemented.");
  }
  ideaDeleteBulkAdmin(request: Admin.IdeaDeleteBulkAdminRequest): Promise<void> {
    throw new Error("Method not implemented.");
  }
  ideaGetAdmin(request: Admin.IdeaGetAdminRequest): Promise<Admin.IdeaWithAuthorAndVoteAdmin> {
    const idea = this.getProject(request.projectId).ideas.find(idea => idea.ideaId === request.ideaId);
    if(!idea) return this.throwLater(404, 'Idea not found');
    const author = this.getProject(request.projectId).users.find(user => user.userId === idea.authorUserId);
    if(!author) return this.throwLater(404, 'Author of idea not found');
    const loggedInUser = this.getProject(request.projectId).loggedInUser;
    const vote = loggedInUser ? this.getProject(request.projectId).votes.find(vote => vote.ideaId === idea.ideaId && vote.voterUserId === loggedInUser.userId) : undefined;
    return this.returnLater({ ...idea, author: author, vote: vote }); 
  }
  ideaSearchAdmin(request: Admin.IdeaSearchAdminRequest): Promise<Admin.IdeaSearchResponse> {
    throw new Error("Method not implemented.");
  }
  ideaUpdateAdmin(request: Admin.IdeaUpdateAdminRequest): Promise<Admin.IdeaAdmin> {
    throw new Error("Method not implemented.");
  }
  configGetAdmin(request: Admin.ConfigGetAdminRequest): Promise<Admin.VersionedConfigAdmin> {
    if(!this.getProject(request.projectId)) return this.throwLater(404, 'Project not found');
    return this.returnLater(this.getProject(request.projectId).config);
  }
  configGetAllAdmin(): Promise<Admin.ConfigGetAllResult> {
    if(!this.loggedIn) return this.throwLater(403, 'Not logged in');
    return this.returnLater({
      configs: Object.values(this.db).map(p => p.config),
    });
  }
  configSetAdmin(request: Admin.ConfigSetAdminRequest): Promise<Admin.VersionedConfigAdmin> {
    if(this.getProject(request.projectId).config.version !== request.versionLast) this.throwLater(412, 'Config changed since last reload');
    this.getProject(request.projectId).config = { config: request.configAdmin, version: randomUuid() };
    return this.returnLater(this.getProject(request.projectId).config);
  }
  projectCreateAdmin(request: Admin.ProjectCreateAdminRequest): Promise<Admin.NewProjectResult> {
    return this.returnLater({
      projectId: request.projectId,
      config: this.getProject(request.projectId).config,
    });
  }
  userCreateAdmin(request: Admin.UserCreateAdminRequest, isSso?:boolean): Promise<Admin.UserAdmin> {
    const user:Admin.UserAdmin = {
      userId: randomUuid(),
      balance: 0,
      emailNotify: !!request.userCreateAdmin.email,
      iosPush: !!request.userCreateAdmin.iosPushToken,
      androidPush: !!request.userCreateAdmin.androidPushToken,
      browserPush: !!request.userCreateAdmin.browserPushToken,
      isSso: !!isSso,
      ...request.userCreateAdmin,
    };
    this.getProject(request.projectId).users.push(user);
    return this.returnLater(user);
  }
  userDeleteAdmin(request: Admin.UserDeleteAdminRequest): Promise<void> {
    throw new Error("Method not implemented.");
  }
  userDeleteBulkAdmin(request: Admin.UserDeleteBulkAdminRequest): Promise<void> {
    throw new Error("Method not implemented.");
  }
  userGetAdmin(request: Admin.UserGetAdminRequest): Promise<Admin.UserAdmin> {
    throw new Error("Method not implemented.");
  }
  userSearchAdmin(request: Admin.UserSearchAdminRequest): Promise<Admin.UserSearchResponse> {
    throw new Error("Method not implemented.");
  }
  userUpdateAdmin(request: Admin.UserUpdateAdminRequest): Promise<Admin.UserAdmin> {
    const user = this.getImmutable(
      this.getProject(request.projectId).users,
      user => user.userId === request.userId);
    if(request.userUpdate.name !== undefined) user.name = request.userUpdate.name;
    if(request.userUpdate.email !== undefined) user.email = request.userUpdate.email === '' ? undefined : request.userUpdate.email;
    if(request.userUpdate.emailNotify !== undefined) user.emailNotify = request.userUpdate.emailNotify;
    if(request.userUpdate.password !== undefined) user.password = request.userUpdate.password === '' ? undefined : request.userUpdate.password;
    if(request.userUpdate.iosPushToken !== undefined) {
      user.iosPushToken = request.userUpdate.iosPushToken === '' ? undefined : request.userUpdate.iosPushToken;
      user.iosPush = request.userUpdate.iosPushToken !== '';
    };
    if(request.userUpdate.androidPushToken !== undefined) {
      user.androidPushToken = request.userUpdate.androidPushToken === '' ? undefined : request.userUpdate.androidPushToken;
      user.androidPush = request.userUpdate.androidPushToken !== '';
    };
    if(request.userUpdate.browserPushToken !== undefined) {
      user.browserPushToken = request.userUpdate.browserPushToken === '' ? undefined : request.userUpdate.browserPushToken;
      user.browserPush = request.userUpdate.browserPushToken !== '';
    };
    return this.returnLater(user);
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
      idea => idea.ideaId === request.voteUpdate.ideaId);
    const vote = this.getImmutable(
      this.getProject(request.projectId).votes,
      vote => vote.voterUserId === request.voteUpdate.voterUserId && vote.ideaId === request.voteUpdate.ideaId,
      () => ({ ideaId: idea.ideaId, voterUserId: request.voteUpdate.voterUserId }));
    var balance:number|undefined;
    var transaction:Admin.Transaction|undefined;
    if(request.voteUpdate.fundAmount !== undefined){
      if(request.voteUpdate.fundAmount < 0) return this.throwLater(400, 'Cannot fund negative value');
      const fundDiff = request.voteUpdate.fundAmount - (vote.fundAmount || 0);
      balance = this.getProject(request.projectId).balances[request.voteUpdate.voterUserId] || 0;
      balance -= fundDiff;
      if(balance < 0) return this.throwLater(403, 'Insufficient funds');
      const fundersCountDiff = (request.voteUpdate.fundAmount > 0 ? 1 : 0) - (vote.fundAmount && vote.fundAmount > 0 ? 1 : 0)

      transaction = {
        userId: request.voteUpdate.voterUserId,
        transactionId: randomUuid(),
        created: new Date(),
        amount: fundDiff,
        balance: balance,
        transactionType: Admin.TransactionType.Vote,
        targetId: request.voteUpdate.ideaId,
        summary: `Funding for "${idea.title.length > 50 ? idea.title.substring(0,47) + '...' : idea.title}"`
      };
      this.getProject(request.projectId).transactions.push(transaction);
      vote.fundAmount = request.voteUpdate.fundAmount;
      this.getProject(request.projectId).balances[request.voteUpdate.voterUserId] = balance;
      idea.funded = (idea.funded || 0) + fundDiff;
      if(fundersCountDiff !== 0) idea.fundersCount = (idea.fundersCount || 0) + fundersCountDiff;
    }
    if(request.voteUpdate.vote) {
      var votePrevValue:number = 0;
      switch(vote.vote) {
        case Admin.VoteVoteEnum.Upvote:
          votePrevValue = 1;
          break;
        case Admin.VoteVoteEnum.Downvote:
          votePrevValue = -1;
          break;
      }
      var voteValue:number = 0;
      switch(request.voteUpdate.vote) {
        case Admin.VoteUpdateVoteEnum.Upvote:
          voteValue = 1;
          vote.vote = Admin.VoteVoteEnum.Upvote;
          break;
        case Admin.VoteUpdateVoteEnum.Downvote:
          voteValue = -1;
          vote.vote = Admin.VoteVoteEnum.Downvote;
          break;
        case Admin.VoteUpdateVoteEnum.None:
          voteValue = 0;
          vote.vote = undefined;
          break;
      }
      const votersCountDiff = Math.abs(voteValue) - Math.abs(votePrevValue);
      if(votersCountDiff !== 0) idea.votersCount = (idea.votersCount || 0) + votersCountDiff;
      const voteValueDiff = voteValue - votePrevValue;
      if(voteValueDiff !== 0) idea.voteValue = (idea.voteValue || 0) + voteValueDiff;
    }
    if(request.voteUpdate.expressions) {
      const expressionsSet = new Set<string>(vote.expressions || []);
      idea.expressionsValue = idea.expressionsValue || 0;
      idea.expressions = idea.expressions || [];
      const expressing:Admin.Expressing = this.getProject(request.projectId).config.config.content.categories.find(c => c.categoryId === idea.categoryId)!.support.express as Admin.Expressing;
      request.voteUpdate.expressions.add && request.voteUpdate.expressions.add.forEach(expression => {
        if(expressionsSet.has(expression)) return;
        expressionsSet.add(expression);
        if(expressing && expressing.limitEmojiSet) {
          const weight = expressing.limitEmojiSet.find(e => e.display === expression)!.weight;
          idea.expressionsValue! += weight;
        }
        var ideaExpression = idea.expressions!.find(e => e.display === expression);
        if(!ideaExpression) {
          ideaExpression = { display: expression, count: 1};
          idea.expressions!.push(ideaExpression);
        } else {
          ideaExpression.count += 1;
        }
      });
      request.voteUpdate.expressions.remove && request.voteUpdate.expressions.remove.forEach(expression => {
        if(!expressionsSet.has(expression)) return;
        expressionsSet.delete(expression);
        if(expressing && expressing.limitEmojiSet) {
          const emoji = expressing.limitEmojiSet.find(e => e.display === expression);
          if(!emoji) return;
          idea.expressionsValue! -= emoji.weight;
        }
        const ideaExpressionIndex = idea.expressions!.findIndex(e => e.display === expression);
        const ideaExpression = ideaExpressionIndex !== -1 ? idea.expressions[ideaExpressionIndex] : undefined;
        if(ideaExpression && ideaExpression.count === 1) {
          idea.expressions.splice(ideaExpressionIndex, 1);
        } else if(ideaExpression) {
          ideaExpression.count -= 1;
        }
      });
      idea.expressions.sort((l,r) => r.count - l.count);
      vote.expressions = Array.from(expressionsSet);
    }
    return this.returnLater({
      vote,
      idea,
      transaction,
      ...(balance !== undefined ? {balance:{balance}} : {}),
    });
  }

  // **** Private methods

  addNotification(projectId:string, user:Admin.User, title:string, description:string, url:string) {
    this.getProject(projectId).notifications.push({
      projectId,
      notificationId: randomUuid(),
      userId: user.userId,
      type: Client.NotificationTypeEnum.Other,
      created: new Date(),
      title,
      description,
      url,
    });
  }

  sendWebNotification(projectId:string, title:string, description:string) {
    const icon = this.getProject(projectId).config.config.logoUrl;
    const notificationOptions:NotificationOptions = {
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

  getProject(projectId:string) {
    var project = this.db[projectId];
    if(!project) {
      const editor = new ConfigEditor.EditorImpl();
      editor.getProperty<ConfigEditor.StringProperty>(['projectId']).set(projectId);
      editor.getProperty<ConfigEditor.StringProperty>(['name']).set(projectId);
      project = {
        config: {config: editor.getConfig(), version: randomUuid()},
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

  deleteProject(projectId:string) {
    delete this.db[projectId];
  }

  calcScore(idea:Admin.IdeaAdmin) {
    return (idea.fundersCount || 0) + (idea.voteValue || 0) + (idea.funded || 0) + (idea.expressionsValue || 0) + 1;
  }

  calcTrendingScore(idea:Admin.IdeaAdmin) {
    var score = this.calcScore(idea);
    var order = Math.log(Math.max(score, 1));
    var seconds = idea.created.getTime() - 1134028003;
    return Math.ceil(order + seconds / 45000);
  }

  filterCursor<T>(data:T[], limit:number, cursor?:string):{results:T[], cursor?:string} {
    var currentCursor = cursor ? parseInt(cursor) : 0;
    return {
      results: data.slice(currentCursor, Math.min(data.length, currentCursor + limit)),
      cursor: (data.length >= currentCursor + limit) ? currentCursor + limit + '' : undefined,
    };
  }

  sort<T>(data:T[], sorters:((l:T,r:T)=>number)[]):any[] {
    data.sort((l,r) => {
      for (let i = 0; i < sorters.length; i++) {
        const result = sorters[i](l,r);
        if(result !== 0) {
          return result;
        }
      }
      return 0;
    });
    return data;
  }

  getImmutable<T extends object>(arr:T[], filter:(t:T)=>boolean, loader?:()=>T) {
    const index:number = arr.findIndex(filter);
    var t;
    if(index === -1) {
      if(!loader) throw Error('Not found');
      t = loader();
      arr.push(t);
    } else {
      t = { ...arr[index] };
      arr[index] = t;
    }
    return t;
  }

  async returnLater<T>(returnValue:T):Promise<T> {
    console.log('Server SEND:', returnValue);
    await this.waitLatency();
    return returnValue === undefined ? undefined : JSON.parse(JSON.stringify(returnValue));
  }

  async throwLater(httpStatus:number, userFacingMessage?:string):Promise<any> {
    console.log('Server THROW:', httpStatus, userFacingMessage);
    console.trace();
    await this.waitLatency();
    throw {
      status: httpStatus,
      json: () => Promise.resolve(Admin.ErrorResponseToJSON({
        userFacingMessage: userFacingMessage,
      })),
    };
  }

  async waitLatency():Promise<void> {
    if(this.hasLatency){
      await new Promise(resolve => setTimeout(resolve, this.BASE_LATENCY + this.BASE_LATENCY * Math.random()));
    }
  }

  generateId():string {
    return randomUuid();
  }
}

export default ServerMock;
