import * as Client from './client';
import * as Admin from './admin';
import randomUuid from '../common/util/uuid';
import * as ConfigEditor from '../common/config/configEditor';

interface Id {
  id:string;
}

class ServerMock implements Client.ApiInterface, Admin.ApiInterface {
  static instance:ServerMock|undefined;

  readonly LATENCY = 300;
  readonly DEFAULT_LIMIT = 10;

  // Mock server-side cookie data
  loggedInUser?:Admin.User;

  // Mock database
  readonly db:{
    [projectId:string]: {
      config: Admin.ConfigAdmin,
      comments:(Admin.Comment & {ideaId:string})[];
      transactions:Admin.Credit[];
      ideas:Admin.IdeaAdmin[];
      users:Admin.UserAdmin[];
      votes:Admin.VoteAdmin[];
    }
  } = {};

  static get():ServerMock {
    if(ServerMock.instance === undefined) ServerMock.instance = new ServerMock();
    return ServerMock.instance;
  }

  commentCreate(request: Client.CommentCreateRequest): Promise<Client.Comment> {
    throw new Error("Method not implemented.");
  }
  commentDelete(request: Client.CommentDeleteRequest): Promise<void> {
    throw new Error("Method not implemented.");
  }
  commentList(request: Client.CommentListRequest): Promise<Client.CommentSearchResponse> {
    return this.returnLater(this.filterCursor(this.sort(this.db[request.projectId].comments
      .filter(comment => comment.ideaId === request.ideaId)
      ,[(l,r) => r.created.getTime() - l.created.getTime()]) // TODO improve sort
      ,this.DEFAULT_LIMIT, request.cursor));
  }
  commentUpdate(request: Client.CommentUpdateRequest): Promise<Client.Comment> {
    throw new Error("Method not implemented.");
  }
  creditSearch(request: Client.CreditSearchRequest): Promise<Client.CreditSearchResponse> {
    throw new Error("Method not implemented.");
  }
  ideaCreate(request: Client.IdeaCreateRequest): Promise<Client.Idea> {
    throw new Error("Method not implemented.");
  }
  ideaDelete(request: Client.IdeaDeleteRequest): Promise<void> {
    throw new Error("Method not implemented.");
  }
  ideaGet(request: Client.IdeaGetRequest): Promise<Client.Idea> {
    return this.ideaGet(request);
  }
  ideaSearch(request: Client.IdeaSearchRequest): Promise<Client.IdeaSearchResponse> {
    return this.returnLater(this.filterCursor(this.sort(this.db[request.projectId].ideas
      .filter(idea => !request.search.filterIdeaTagIds
        || request.search.filterIdeaTagIds.filter(tagId =>
            idea.tagIds && idea.tagIds.includes(tagId)
          ).length > 0)
      .filter(idea => !request.search.filterIdeaGroupIds
        || request.search.filterIdeaGroupIds.includes(idea.groupId))
      .filter(idea => request.search.filterIdeaStatusIds === undefined
        || (request.search.filterIdeaStatusIds.length === 0 && !idea.statusId)
        || (idea.statusId && request.search.filterIdeaStatusIds.includes(idea.statusId)))
      .filter(idea => request.search.searchText === undefined
        || idea.title.indexOf(request.search.searchText) >= 0
        || idea.description.indexOf(request.search.searchText) < 0)
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
  configGet(request: Client.ConfigGetRequest): Promise<Client.Config> {
    return this.configGetAdmin(request);
  }
  userCreate(request: Client.UserCreateRequest): Promise<Client.User> {
    throw new Error("Method not implemented.");
  }
  userDelete(request: Client.UserDeleteRequest): Promise<void> {
    throw new Error("Method not implemented.");
  }
  userGet(request: Client.UserGetRequest): Promise<Client.User> {
    const user = this.db[request.projectId].users.find(user => user.userId === request.userId);
    return user ? this.returnLater(user) : this.throwLater(404, 'User not found');
  }
  userLogin(request: Client.UserLoginRequest): Promise<Client.User> {
    throw new Error("Method not implemented.");
  }
  userUpdate(request: Client.UserUpdateRequest): Promise<Client.User> {
    throw new Error("Method not implemented.");
  }
  voteCreate(request: Client.VoteCreateRequest): Promise<Client.Vote> {
    throw new Error("Method not implemented.");
  }
  voteDelete(request: Client.VoteDeleteRequest): Promise<void> {
    throw new Error("Method not implemented.");
  }
  voteUpdate(request: Client.VoteUpdateRequest): Promise<Client.Vote> {
    throw new Error("Method not implemented.");
  }
  commentCreateAdmin(request: Admin.CommentCreateAdminRequest): Promise<Admin.Comment> {
    throw new Error("Method not implemented.");
  }
  commentDeleteAdmin(request: Admin.CommentDeleteAdminRequest): Promise<void> {
    throw new Error("Method not implemented.");
  }
  commentDeleteBulkAdmin(request: Admin.CommentDeleteBulkAdminRequest): Promise<void> {
    throw new Error("Method not implemented.");
  }
  commentSearchAdmin(request: Admin.CommentSearchAdminRequest): Promise<Admin.CommentSearchResponse> {
    throw new Error("Method not implemented.");
  }
  commentUpdateAdmin(request: Admin.CommentUpdateAdminRequest): Promise<Admin.Comment> {
    throw new Error("Method not implemented.");
  }
  creditCreateAdmin(request: Admin.CreditCreateAdminRequest): Promise<Admin.Credit> {
    throw new Error("Method not implemented.");
  }
  creditSearchAdmin(request: Admin.CreditSearchAdminRequest): Promise<Admin.CreditSearchResponse> {
    throw new Error("Method not implemented.");
  }
  ideaCreateAdmin(request: Admin.IdeaCreateAdminRequest): Promise<Admin.IdeaAdmin> {
    throw new Error("Method not implemented.");
  }
  ideaDeleteAdmin(request: Admin.IdeaDeleteAdminRequest): Promise<void> {
    throw new Error("Method not implemented.");
  }
  ideaDeleteBulkAdmin(request: Admin.IdeaDeleteBulkAdminRequest): Promise<void> {
    throw new Error("Method not implemented.");
  }
  ideaGetAdmin(request: Admin.IdeaGetAdminRequest): Promise<Admin.IdeaAdmin> {
    const idea = this.db[request.projectId].ideas.find(idea => idea.ideaId === request.ideaId);
    return idea ? this.returnLater(idea) : this.throwLater(404, 'Idea not found');
  }
  ideaSearchAdmin(request: Admin.IdeaSearchAdminRequest): Promise<Admin.IdeaSearchResponse> {
    throw new Error("Method not implemented.");
  }
  ideaUpdateAdmin(request: Admin.IdeaUpdateAdminRequest): Promise<Admin.IdeaAdmin> {
    throw new Error("Method not implemented.");
  }
  configGetAdmin(request: Admin.ConfigGetAdminRequest): Promise<Admin.ConfigAdmin> {
    if(!this.db[request.projectId]) return this.throwLater(404, 'Project not found');
    return this.returnLater(this.db[request.projectId].config);
  }
  configGetAllAdmin(): Promise<Admin.Projects> {
    return this.returnLater({
      configs: Object.values(this.db).map(p => p.config),
    });
  }
  configSetAdmin(request: Admin.ConfigSetAdminRequest): Promise<Admin.NewConfigResult> {
    throw new Error("Method not implemented.");
  }
  projectCreateAdmin(request: Admin.ProjectCreateAdminRequest): Promise<Admin.NewProjectResult> {
    const editor = new ConfigEditor.EditorImpl();
    editor.getProperty<ConfigEditor.StringProperty>(['projectId']).set(request.projectId);
    this.db[request.projectId] = {
      config: editor.getConfig(),
      comments: [],
      transactions: [],
      ideas: [],
      users: [],
      votes: [],
    };
    return this.returnLater({
      projectId: request.projectId,
      config: editor.getConfig(),
    });
  }
  userCreateAdmin(request: Admin.UserCreateAdminRequest): Promise<Admin.UserAdmin> {
    throw new Error("Method not implemented.");
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
  userLoginAdmin(request: Admin.UserLoginAdminRequest): Promise<Admin.User> {
    throw new Error("Method not implemented.");
  }
  userSearchAdmin(request: Admin.UserSearchAdminRequest): Promise<Admin.UserSearchResponse> {
    throw new Error("Method not implemented.");
  }
  userUpdateAdmin(request: Admin.UserUpdateAdminRequest): Promise<Admin.UserAdmin> {
    throw new Error("Method not implemented.");
  }
  voteCreateAdmin(request: Admin.VoteCreateAdminRequest): Promise<Admin.VoteAdmin> {
    throw new Error("Method not implemented.");
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
  voteUpdateAdmin(request: Admin.VoteUpdateAdminRequest): Promise<Admin.VoteAdmin> {
    throw new Error("Method not implemented.");
  }

  // TODO remove commented code once I migrate it over

  // // ### CommentApiInterface
  // getComments(request: GetCommentsRequest): Promise<Array<Comment>> {
  //   console.log("Server RECV: getComments", requestParameters);
  //   return this.returnLater(this.ideaIdToComments[requestParameters.ideaId] || []);
  // }

  // // ### ConfigApiInterface

  // getConfig(): Promise<Conf> {
  //   console.log("Server RECV: getConfig");
  //   return this.returnLater(this.conf);
  // }

  // // ### CreditApiInterface

  // getTransactions(request: GetTransactionsRequest): Promise<Array<Transaction>> {
  //   console.log("Server RECV: getTransactions", requestParameters);
  //   if(!this.loggedInUser || requestParameters.userId !== this.loggedInUser.id) {
  //     return this.throwLater(403, 'Cannot get transaction for other users');
  //   }

  //   return this.returnLater(this.userIdToTransactions[requestParameters.userId] || []);
  // }

  // voteIdea(request: VoteIdeaRequest): Promise<VoteIdeaResult> {
  //   console.log("Server RECV: voteIdea", requestParameters);
  //   const idea = this.ideas[requestParameters.ideaId];
  //   if(!this.loggedInUser) {
  //     return this.throwLater(403, 'Need to be logged in');
  //   }
  //   if(!idea) {
  //     return this.throwLater(404, 'Idea does not exist anymore');
  //   }
    
  //   const group = this.conf.ideaGroups[idea.groupId];
  //   const supportType = group.supportType || this.conf.supportType;

  //   if(supportType === ConfSupportType.None) {
  //     return this.throwLater(400, 'Invalid request: idea does not support voting nor funding');
  //   }

  //   var creditAmount = requestParameters.creditAmount || 0 > 0 ? requestParameters.creditAmount || 0 : 0;
  //   if(creditAmount > 0) {
  //     if(supportType === ConfSupportType.VotingOnly) {
  //       return this.throwLater(400, 'Invalid request: idea does not support funding');
  //     }
  //     var creditsOwned = this.userIdToCredits[this.loggedInUser.id];
  //     if(!creditsOwned || creditsOwned < creditAmount) {
  //       return this.throwLater(403, 'Not enought credits on your account');
  //     }

  //     this.userIdToCredits[this.loggedInUser.id] = creditsOwned - creditAmount;

  //     idea.credits = idea.credits ? idea.credits + creditAmount : creditAmount;
  //     idea.funderCount = idea.funderCount ? idea.funderCount + 1 : 1;
  //   }

  //   if(supportType === ConfSupportType.FundingVoting || supportType === ConfSupportType.VotingOnly) {
  //     idea.supporterCount = idea.supporterCount ? idea.supporterCount + 1 : 1;
  //   }

  //   const transaction = creditAmount > 0 ? TransactionFromJSON({
  //     id: this.generateId(),
  //     created: new Date(),
  //     amount: creditAmount,
  //     transactionType: TransactionTransactionTypeEnum.VoteIdea,
  //     targetId: idea.id,
  //   }) : undefined;
  //   if(transaction) {
  //     var transactions = this.userIdToTransactions[this.loggedInUser.id];
  //     if(!transactions) {
  //       transactions = [];
  //       this.userIdToTransactions[this.loggedInUser.id] = transactions;
  //     }
  //     transactions.push(transaction);
  //   }

  //   return this.returnLater(VoteIdeaResultFromJSON({
  //     idea: idea,
  //     transaction: transaction,
  //   }));
  // }

  // changeVoteIdea(request: ChangeVoteIdeaRequest): Promise<VoteIdeaResult> {
  //   console.log("Server RECV: changeVoteIdea", requestParameters);
  //   throw new Error("Method not implemented.");
  // }

  // unvoteIdea(request: UnvoteIdeaRequest): Promise<VoteIdeaResult> {
  //   console.log("Server RECV: unvoteIdea", requestParameters);
  //   throw new Error("Method not implemented.");
  // }

  // // ### IdeaApiInterface

  // createIdea(request: CreateIdeaRequest): Promise<Idea> {
  //   console.log("Server RECV: createIdea", requestParameters);
  //   if(!this.loggedInUser) {
  //     return this.throwLater(403, 'Need to be logged in');
  //   }

  //   const group = this.conf.ideaGroups.find(g => g.id === requestParameters.groupId);
  //   if(!group) {
  //     return this.throwLater(400, 'Invalid request: Unknown group');
  //   }

  //   const supportType = group.supportType || this.conf.supportType;
  //   const isIdeaFunding = requestParameters.creditsToFund && requestParameters.creditsToFund > 0;
  //   if(supportType === ConfSupportType.None) {
  //     return this.throwLater(400, 'Invalid request: Voting not allowed');
  //   }
  //   if(isIdeaFunding && supportType === ConfSupportType.VotingOnly) {
  //     return this.throwLater(400, 'Invalid request: Only voting allowed, funding is not');
  //   }
  //   if(!isIdeaFunding && supportType === ConfSupportType.FundingOnly) {
  //     return this.throwLater(400, 'Invalid request: Only funding allowed, voting is not');
  //   }

  //   const addVote = supportType === ConfSupportType.FundingVoting
  //     || supportType === ConfSupportType.VotingOnly;

  //   const idea = IdeaFromJSON({
  //     id: this.generateId(),
  //     authorUserId: this.loggedInUser,
  //     created: new Date(),
  //     title: requestParameters.title,
  //     description: requestParameters.description,
  //     groupId: requestParameters.groupId,
  //     statusId: group.defaultIdeaStatusId || this.conf.defaultIdeaStatusId,
  //     tagIds: requestParameters.tagIds,
  //     credits: requestParameters.creditsToFund || 0,
  //     creditGoal: 0,
  //     funderCount: isIdeaFunding ? 1 : 0,
  //     supporterCount: addVote ? 1 : 0,
  //     myCredits: requestParameters.creditsToFund,
  //     mySupport: addVote,
  //   });

  //   if(idea.tagIds) {
  //     for(let tagId of idea.tagIds) {
  //       if(group.settableIdeaTagIdsOnCreate && group.settableIdeaTagIdsOnCreate.indexOf(tagId) >= 0
  //         || this.conf.settableIdeaTagIdsOnCreate && this.conf.settableIdeaTagIdsOnCreate.indexOf(tagId) >= 0) {
  //         var tagName = this.conf.ideaTags ? this.conf.ideaTags[tagId] || undefined : undefined;
  //         if(tagName) {
  //           return this.throwLater(400, 'Invalid request: Idea tag not found: ' + tagId);
  //         } else {
  //           return this.throwLater(400, 'Invalid request: Idea tag not allowed: ' + tagName);
  //         }
  //       }
  //     }
  //   }

  //   this.ideas[idea.id] = idea;

  //   if(addVote) {
  //     this.addVoteToVotesSet(this.loggedInUser.id, idea.id);
  //   }

  //   return this.returnLater(idea);
  // }

  // deleteIdea(request: DeleteIdeaRequest): Promise<void> {
  //   console.log("Server RECV: deleteIdea", requestParameters);
  //   if(!this.loggedInUser) {
  //     return this.throwLater(403, 'You need to login first to delete an idea');
  //   }

  //   const idea = this.ideas[requestParameters.ideaId];
  //   if(!idea) {
  //     return this.throwLater(404, 'Idea does not exist anymore');
  //   }

  //   if(!this.loggedInUser.isAdmin && idea.authorUserId !== this.loggedInUser.id) {
  //     return this.throwLater(403, 'You cannot delete an idea that is not yours');
  //   }

  //   delete this.ideas[requestParameters.ideaId];
  //   return this.returnLater();
  // }

  // getIdea(request: GetIdeaRequest): Promise<Idea> {
  //   console.log("Server RECV: getIdea", requestParameters);
  //   const idea = this.ideas[requestParameters.ideaId];
  //   if(!idea) {
  //     return this.throwLater(404, 'Idea does not exist anymore');
  //   }
  //   return this.returnLater(idea);
  // }

  // getIdeas(request: GetIdeasRequest): Promise<Ideas> {
  //   console.log("Server RECV: getIdeas", requestParameters);
  //   const limit = requestParameters.searchQuery.limit || 10;
  //   if(limit < 0 || limit > 50) {
  //     return this.throwLater(400, 'Invalid request: limit is out of bounds');
  //   }

  //   var result:Array<Idea> = [];
  //   for(var idea of Object.values(this.ideas)) {
  //     if(requestParameters.searchQuery.filterIdeaStatusIds
  //       && requestParameters.searchQuery.filterIdeaStatusIds.length > 0
  //       && !requestParameters.searchQuery.filterIdeaStatusIds.includes(idea.statusId)) {
  //       continue;
  //     }

  //     if(requestParameters.searchQuery.filterIdeaGroupIds
  //       && requestParameters.searchQuery.filterIdeaGroupIds.length > 0
  //       && !requestParameters.searchQuery.filterIdeaGroupIds.includes(idea.groupId)) {
  //       continue;
  //     }

  //     if(requestParameters.searchQuery.filterIdeaTagIds
  //       && requestParameters.searchQuery.filterIdeaTagIds.length > 0
  //       && (!idea.tagIds
  //       || requestParameters.searchQuery.filterIdeaTagIds.filter(tagId =>
  //           idea.tagIds && idea.tagIds.includes(tagId)
  //         ).length > 0)) {
  //       continue;
  //     }


  //     if(requestParameters.searchQuery.searchText
  //       && idea.title.indexOf(requestParameters.searchQuery.searchText) < 0
  //       && idea.description.indexOf(requestParameters.searchQuery.searchText) < 0) {
  //       continue;
  //     }

  //     result.push(idea);
  //   }

  //   if(requestParameters.searchQuery.sortBy === SortBy.Top) {
  //     result.sort((l, r) => 
  //       (r.credits || r.supporterCount || 0)
  //       - (l.credits || l.supporterCount || 0)
  //     );
  //   } else if(requestParameters.searchQuery.sortBy === SortBy.New) {
  //     result.sort((l, r) => 
  //       r.created.getTime() - l.created.getTime()
  //     );
  //   } else if(requestParameters.searchQuery.sortBy === SortBy.Trending) {
  //     result.sort((l, r) => 
  //       this.calcTrendingScore(r) - this.calcTrendingScore(l)
  //     );
  //   }

  //   var currentCursor = 0;
  //   if(requestParameters.cursor) {
  //     currentCursor = parseInt(requestParameters.cursor);
  //   }

  //   var nextCursor:string|undefined = undefined;
  //   if(result.length >= currentCursor + limit) {
  //     nextCursor = currentCursor + limit + '';
  //   }

  //   result.slice(currentCursor, Math.min(result.length, currentCursor + limit));

  //   return this.returnLater(IdeasFromJSON({
  //     ideas: result,
  //     cursor: nextCursor,
  //   }));
  // }

  // updateIdea(request: UpdateIdeaRequest): Promise<void> {
  //   console.log("Server RECV: updateIdea", requestParameters);
  //   throw new Error("Method not implemented.");
  // }

  // // ### UserApiInterface

  // getUser(request: GetUserRequest): Promise<User> {
  //   console.log("Server RECV: getUser", requestParameters);
  //   const user = this.users[requestParameters.userId];
  //   if(!user) {
  //     return this.throwLater(404, 'User does not exist anymore');
  //   }
  //   return this.returnLater(user);
  // }

  // bindUser(request: BindUserRequest): Promise<AuthSuccessResult> {
  //   console.log("Server RECV: bindUser", requestParameters);
  //   throw new Error("Method not implemented.");
  // }

  // loginUser(request: LoginUserRequest): Promise<AuthSuccessResult> {
  //   console.log("Server RECV: loginUser", requestParameters);
  //   throw new Error("Method not implemented.");
  // }

  // registerUser(request: RegisterUserRequest): Promise<AuthSuccessResult> {
  //   console.log("Server RECV: registerUser", requestParameters);
  //   const newUser = UserFromJSON({
  //     'id': randomUuid(),
  //     'name': requestParameters.name || 'Anonymous',
  //     'isAdmin': false,
  //     'avatar': requestParameters.avatar,
  //   });
  //   this.users[newUser.id] = newUser;
  //   this.loggedInUser = newUser;
  //   return this.returnLater(newUser);
  // }

  // updateUser(request: UpdateUserRequest): Promise<void> {
  //   console.log("Server RECV : updateUser", requestParameters);
  //   throw new Error("Method not implemented.");
  // }

  // // ### Private methods

  // addVoteToVotesSet(userId:string, ideaId:string) {
  //   var userIdVotes = this.ideaIdToUserIdVotes[ideaId];
  //   if(!userIdVotes) {
  //     userIdVotes = new Set();
  //     this.ideaIdToUserIdVotes[ideaId] = userIdVotes;
  //   }
  //   userIdVotes.add(userId);
  // }

  calcScore(idea:Admin.IdeaAdmin) {
    return (idea.fundersCount || 0) + (idea.supportersCount || 0) + (idea.funded || 0) + 1;
  }

  calcTrendingScore(idea:Admin.IdeaAdmin) {
    var score = this.calcScore(idea);
    var order = Math.log(Math.max(score, 1));
    var seconds = idea.created.getTime() - 1134028003;
    return Math.ceil(order + seconds / 45000);
  }

  filterCursor(data:any[], limit:number, cursor?:string) {
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

  async returnLater<T>(returnValue:T):Promise<T> {
    console.log('Server SEND:', returnValue);
    await new Promise(resolve => setTimeout(resolve, this.LATENCY));
    return returnValue;
  }

  async throwLater(httpStatus:number, userFacingMessage?:string):Promise<any> {
    console.log('Server THROW:', httpStatus, userFacingMessage);
    await new Promise(resolve => setTimeout(resolve, this.LATENCY));
    throw {
      status: httpStatus,
      json: Promise.resolve(Admin.ErrorResponseFromJSON({
        userFacingMessage: userFacingMessage,
      })),
    };
  }

  generateId():string {
    return randomUuid();
  }
}

export default ServerMock;
