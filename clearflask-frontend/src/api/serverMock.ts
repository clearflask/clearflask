import * as Client from './client';
import * as Admin from './admin';
import randomUuid from '../common/util/uuid';
import * as ConfigEditor from '../common/config/configEditor';
import stringToSlug from '../common/util/slugger';
import WebNotification from '../common/notification/webNotification';

class ServerMock implements Client.ApiInterface, Admin.ApiInterface {
  static instance:ServerMock|undefined;

  readonly BASE_LATENCY = 300;
  readonly DEFAULT_LIMIT = 10;
  hasLatency:boolean = false;

  // Mock database
  readonly db:{
    [projectId:string]: {
      loggedInUser?:Admin.User; // Mock server-side cookie data
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

  commentCreate(request: Client.CommentCreateRequest): Promise<Client.Comment> {
    throw new Error("Method not implemented.");
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
    if(request.search.filterAmountMax !== undefined
      || request.search.filterAmountMin !== undefined
      || request.search.filterCreatedEnd !== undefined
      || request.search.filterCreatedStart !== undefined
      || request.search.filterTransactionTypes !== undefined
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
    return this.ideaCreateAdmin(request);
  }
  ideaDelete(request: Client.IdeaDeleteRequest): Promise<void> {
    throw new Error("Method not implemented.");
  }
  ideaGet(request: Client.IdeaGetRequest): Promise<Client.IdeaWithAuthorAndVote> {
    return this.ideaGetAdmin(request);
  }
  ideaSearch(request: Client.IdeaSearchRequest): Promise<Client.IdeaSearchResponse> {
    const allIdeas:Admin.IdeaAdmin[] = this.getProject(request.projectId).ideas;
    const ideas:Admin.IdeaAdmin[] = request.search.fundedByMeAndActive
      ? this.getProject(request.projectId).votes
        .filter(v => v.fundAmount && v.fundAmount > 0)
        .map(v => allIdeas.find(i => i.ideaId === v.ideaId)!)
      : allIdeas;
    const categories = this.getProject(request.projectId).config.config.content.categories;
    return this.returnLater(this.filterCursor(this.sort(ideas
      .filter(idea => !request.search.fundedByMeAndActive
        || !idea.statusId
        || categories.find(c => c.categoryId === idea.categoryId)!
            .workflow
            .statuses
            .find(s => s.statusId === idea.statusId)!
            .disableFunding !== true)
      .filter(idea => !request.search.filterTagIds
        || request.search.filterTagIds.length === 0
        || request.search.filterTagIds.filter(tagId =>
            idea.tagIds && idea.tagIds.includes(tagId)
          ).length > 0)
      .filter(idea => !request.search.filterCategoryIds
        || request.search.filterCategoryIds.includes(idea.categoryId))
      .filter(idea => request.search.filterStatusIds === undefined
        || request.search.filterStatusIds.length === 0
        || (idea.statusId && request.search.filterStatusIds.includes(idea.statusId)))
      .filter(idea => request.search.searchText === undefined
        || idea.title.indexOf(request.search.searchText) >= 0
        || (idea.description || '').indexOf(request.search.searchText) >= 0)
      .map(idea => {
        const author = this.getProject(request.projectId).users.find(user => user.userId === idea.authorUserId);
        if(!author) throw Error('Author of idea not found');
        const loggedInUser = this.getProject(request.projectId).loggedInUser;
        const vote = loggedInUser ? this.getProject(request.projectId).votes.find(vote => vote.ideaId === idea.ideaId && vote.voterUserId === loggedInUser.userId) : undefined;
        return { ...idea, author: author, vote: vote };
      })
      ,[(l,r) => {switch(request.search.sortBy){
          default: case Admin.IdeaSearchSortByEnum.Trending: return this.calcTrendingScore(r) - this.calcTrendingScore(l);
          case Admin.IdeaSearchSortByEnum.Top: return (this.calcScore(r) - this.calcScore(l));
          case Admin.IdeaSearchSortByEnum.New: return r.created.getTime() - l.created.getTime();
      }}])
      ,request.search.limit || this.DEFAULT_LIMIT, request.cursor));
  }
  ideaUpdate(request: Client.IdeaUpdateRequest): Promise<Client.Idea> {
    throw new Error("Method not implemented.");
  }
  configGet(request: Client.ConfigGetRequest): Promise<Client.VersionedConfig> {
    return this.configGetAdmin(request);
  }
  userCreate(request: Client.UserCreateRequest, isSso?:boolean): Promise<Client.UserMeWithBalance> {
    return this.userCreateAdmin(request, isSso).then(user => {
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
  userBind(request: Client.UserBindRequest): Promise<Client.UserMeWithBalance> {
    const loggedInUser = this.getProject(request.projectId).loggedInUser;
    return loggedInUser
      ? this.returnLater({
        ...loggedInUser,
        balance: this.getProject(request.projectId).balances[loggedInUser.userId],
      })
      : this.throwLater(404, 'User not logged in');
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
      token = JSON.parse(request.token);
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
      create: typeof token === 'object' ? {...token} : {},
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
    const votes = this.getProject(request.projectId).votes.filter(vote => vote.voterUserId === loggedInUser.userId && request.ideaIds.includes(vote.ideaId));
    return this.returnLater({results: votes});
  }
  voteUpdate(request: Client.VoteUpdateRequest): Promise<Client.VoteUpdateResponse> {
    const loggedInUser = this.getProject(request.projectId).loggedInUser;
    if(!loggedInUser) return this.throwLater(403, 'Not logged in');
    return this.voteUpdateAdmin({
      ...request,
      update: {
        ...(request.update),
        voterUserId: loggedInUser.userId,
      }
    });
  }
  notificationClear(request: Client.NotificationClearRequest): Promise<void> {
    const loggedInUser = this.getProject(request.projectId).loggedInUser;
    if(!loggedInUser || request.userId !== loggedInUser.userId) return this.throwLater(403, 'Not logged in');
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
      ...(request.comment),
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
    comment.content = request.update.content;
    comment.edited = new Date();
    return this.returnLater(comment);
  }
  transactionCreateAdmin(request: Admin.TransactionCreateAdminRequest): Promise<Admin.Transaction> {
    var balance = this.getProject(request.projectId).balances[request.userId] || 0;
    balance += request.transaction.amount;
    const transaction = {
      userId: request.userId,
      transactionId: randomUuid(),
      created: new Date(),
      amount: request.transaction.amount,
      balance: balance,
      transactionType: Admin.TransactionType.Adjustment,
      summary: request.transaction.summary,
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
      ideaId: stringToSlug(request.create.title + '-' + randomUuid().substring(0,5)),
      created: new Date(),
      ...(request.create),
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
  configGetAllAdmin(): Promise<Admin.Projects> {
    return this.returnLater({
      configs: Object.values(this.db).map(p => p.config),
    });
  }
  configSetAdmin(request: Admin.ConfigSetAdminRequest): Promise<Admin.VersionedConfigAdmin> {
    if(this.getProject(request.projectId).config.version !== request.versionLast) this.throwLater(412, 'Config changed since last reload');
    this.getProject(request.projectId).config = { config: request.config, version: randomUuid() };
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
      emailNotify: !!request.create.email,
      iosPush: !!request.create.iosPushToken,
      androidPush: !!request.create.androidPushToken,
      browserPush: !!request.create.browserPushToken,
      isSso: !!isSso,
      ...request.create,
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
  userBindAdmin(): Promise<Admin.UserMeWithBalance> {
    throw new Error("Method not implemented.");
  }
  userLoginAdmin(request: Admin.UserLoginAdminRequest): Promise<Admin.UserMeWithBalance> {
    throw new Error("Method not implemented.");
  }
  userSearchAdmin(request: Admin.UserSearchAdminRequest): Promise<Admin.UserSearchResponse> {
    throw new Error("Method not implemented.");
  }
  userUpdateAdmin(request: Admin.UserUpdateAdminRequest): Promise<Admin.UserAdmin> {
    const user = this.getImmutable(
      this.getProject(request.projectId).users,
      user => user.userId === request.userId);
    if(request.update.name !== undefined) user.name = request.update.name;
    if(request.update.email !== undefined) user.email = request.update.email === '' ? undefined : request.update.email;
    if(request.update.emailNotify !== undefined) user.emailNotify = request.update.emailNotify;
    if(request.update.password !== undefined) user.password = request.update.password === '' ? undefined : request.update.password;
    if(request.update.iosPushToken !== undefined) {
      user.iosPushToken = request.update.iosPushToken === '' ? undefined : request.update.iosPushToken;
      user.iosPush = request.update.iosPushToken !== '';
    };
    if(request.update.androidPushToken !== undefined) {
      user.androidPushToken = request.update.androidPushToken === '' ? undefined : request.update.androidPushToken;
      user.androidPush = request.update.androidPushToken !== '';
    };
    if(request.update.browserPushToken !== undefined) {
      user.browserPushToken = request.update.browserPushToken === '' ? undefined : request.update.browserPushToken;
      user.browserPush = request.update.browserPushToken !== '';
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
      idea => idea.ideaId === request.update.ideaId);
    const vote = this.getImmutable(
      this.getProject(request.projectId).votes,
      vote => vote.voterUserId === request.update.voterUserId && vote.ideaId === request.update.ideaId,
      () => ({ ideaId: idea.ideaId, voterUserId: request.update.voterUserId }));
    var balance:number|undefined;
    var transaction:Admin.Transaction|undefined;
    if(request.update.fundAmount !== undefined){
      if(request.update.fundAmount < 0) return this.throwLater(400, 'Cannot fund negative value');
      const fundDiff = request.update.fundAmount - (vote.fundAmount || 0);
      balance = this.getProject(request.projectId).balances[request.update.voterUserId] || 0;
      balance -= fundDiff;
      if(balance < 0) return this.throwLater(403, 'Insufficient funds');
      const fundersCountDiff = (request.update.fundAmount > 0 ? 1 : 0) - (vote.fundAmount && vote.fundAmount > 0 ? 1 : 0)

      transaction = {
        userId: request.update.voterUserId,
        transactionId: randomUuid(),
        created: new Date(),
        amount: fundDiff,
        balance: balance,
        transactionType: Admin.TransactionType.Vote,
        targetId: request.update.ideaId,
        summary: `Funding for "${idea.title.length > 50 ? idea.title.substring(0,47) + '...' : idea.title}"`
      };
      this.getProject(request.projectId).transactions.push(transaction);
      vote.fundAmount = request.update.fundAmount;
      this.getProject(request.projectId).balances[request.update.voterUserId] = balance;
      idea.funded = (idea.funded || 0) + fundDiff;
      if(fundersCountDiff !== 0) idea.fundersCount = (idea.fundersCount || 0) + fundersCountDiff;
    }
    if(request.update.vote) {
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
      switch(request.update.vote) {
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
    if(request.update.expressions) {
      const expressionsSet = new Set<string>(vote.expressions || []);
      idea.expressionsValue = idea.expressionsValue || 0;
      idea.expressions = idea.expressions || [];
      const expressing:Admin.Expressing = this.getProject(request.projectId).config.config.content.categories.find(c => c.categoryId === idea.categoryId)!.support.express as Admin.Expressing;
      request.update.expressions.add && request.update.expressions.add.forEach(expression => {
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
      request.update.expressions.remove && request.update.expressions.remove.forEach(expression => {
        if(!expressionsSet.has(expression)) return;
        expressionsSet.delete(expression);
        if(expressing && expressing.limitEmojiSet) {
          const weight = expressing.limitEmojiSet.find(e => e.display === expression)!.weight;
          idea.expressionsValue! -= weight;
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
    await this.waitLatency();
    throw {
      status: httpStatus,
      json: Admin.ErrorResponseToJSON({
        userFacingMessage: userFacingMessage,
      }),
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
