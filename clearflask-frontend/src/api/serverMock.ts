import {
  ApiInterface,
  GetCommentsRequest,
  GetTransactionsRequest,
  Transaction,
  VoteIdeaRequest,
  Idea,
  DeleteIdeaRequest,
  GetIdeaRequest,
  GetIdeasRequest,
  GetUserRequest,
  User,
  Conf,
  Comment,
  Ideas,
  IdeaFromJSON,
  ErrorResponseFromJSON,
  ConfSupportType,
  SortBy,
  VoteIdeaResult,
  CreateIdeaRequest,
  VoteIdeaResultFromJSON,
  TransactionTransactionTypeEnum,
  TransactionFromJSON,
  IdeasFromJSON,
  ChangeVoteIdeaRequest,
  UnvoteIdeaRequest,
  UpdateUserRequest,
  RegisterUserRequest,
  LoginUserRequest,
  BindUserRequest,
  UpdateIdeaRequest,
  UserFromJSON,
} from './client';
import randomUuid from '../util/uuid';
import { AuthSuccessResult } from './client/models/AuthSuccessResult';

class ServerMock implements ApiInterface {
  readonly LATENCY = 300;

  conf:Conf;
  loggedInUser?:User;

  ideas:{[ideaId:string]:Idea} = {};
  ideaIdToComments:{[ideaId:string]:Array<Comment>} = {};
  ideaIdToUserIdVotes:{[ideaId:string]:Set<string>} = {};

  users:{[userId:string]:User} = {};
  userIdToTransactions:{[ideaId:string]:Array<Transaction>} = {};
  userIdToCredits:{[ideaId:string]:number} = {};

  constructor(conf:Conf, loggedInUser?:User) {
    console.log("Server CREATED: ", conf, loggedInUser);
    this.conf = conf;
    if(loggedInUser) {
      this.loggedInUser = loggedInUser
      this.users[loggedInUser.id] = loggedInUser;
    }
  }

  // ### CommentApiInterface
  getComments(requestParameters: GetCommentsRequest): Promise<Array<Comment>> {
    console.log("Server RECV: getComments", requestParameters);
    return this.returnLater(this.ideaIdToComments[requestParameters.ideaId] || []);
  }

  // ### ConfigApiInterface

  getConfig(): Promise<Conf> {
    console.log("Server RECV: getConfig");
    return this.returnLater(this.conf);
  }

  // ### CreditApiInterface

  getTransactions(requestParameters: GetTransactionsRequest): Promise<Array<Transaction>> {
    console.log("Server RECV: getTransactions", requestParameters);
    if(!this.loggedInUser || requestParameters.userId !== this.loggedInUser.id) {
      return this.throwLater(403, 'Cannot get transaction for other users');
    }

    return this.returnLater(this.userIdToTransactions[requestParameters.userId] || []);
  }

  voteIdea(requestParameters: VoteIdeaRequest): Promise<VoteIdeaResult> {
    console.log("Server RECV: voteIdea", requestParameters);
    const idea = this.ideas[requestParameters.ideaId];
    if(!this.loggedInUser) {
      return this.throwLater(403, 'Need to be logged in');
    }
    if(!idea) {
      return this.throwLater(404, 'Idea does not exist anymore');
    }
    
    const group = this.conf.ideaGroups[idea.groupId];
    const supportType = group.supportType || this.conf.supportType;

    if(supportType === ConfSupportType.None) {
      return this.throwLater(400, 'Invalid request: idea does not support voting nor funding');
    }

    var creditAmount = requestParameters.creditAmount || 0 > 0 ? requestParameters.creditAmount || 0 : 0;
    if(creditAmount > 0) {
      if(supportType === ConfSupportType.VotingOnly) {
        return this.throwLater(400, 'Invalid request: idea does not support funding');
      }
      var creditsOwned = this.userIdToCredits[this.loggedInUser.id];
      if(!creditsOwned || creditsOwned < creditAmount) {
        return this.throwLater(403, 'Not enought credits on your account');
      }

      this.userIdToCredits[this.loggedInUser.id] = creditsOwned - creditAmount;

      idea.credits = idea.credits ? idea.credits + creditAmount : creditAmount;
      idea.funderCount = idea.funderCount ? idea.funderCount + 1 : 1;
    }

    if(supportType === ConfSupportType.FundingVoting || supportType === ConfSupportType.VotingOnly) {
      idea.supporterCount = idea.supporterCount ? idea.supporterCount + 1 : 1;
    }

    const transaction = creditAmount > 0 ? TransactionFromJSON({
      id: this.generateId(),
      created: new Date(),
      amount: creditAmount,
      transactionType: TransactionTransactionTypeEnum.VoteIdea,
      targetId: idea.id,
    }) : undefined;
    if(transaction) {
      var transactions = this.userIdToTransactions[this.loggedInUser.id];
      if(!transactions) {
        transactions = [];
        this.userIdToTransactions[this.loggedInUser.id] = transactions;
      }
      transactions.push(transaction);
    }

    return this.returnLater(VoteIdeaResultFromJSON({
      idea: idea,
      transaction: transaction,
    }));
  }

  changeVoteIdea(requestParameters: ChangeVoteIdeaRequest): Promise<VoteIdeaResult> {
    console.log("Server RECV: changeVoteIdea", requestParameters);
    throw new Error("Method not implemented.");
  }

  unvoteIdea(requestParameters: UnvoteIdeaRequest): Promise<VoteIdeaResult> {
    console.log("Server RECV: unvoteIdea", requestParameters);
    throw new Error("Method not implemented.");
  }

  // ### IdeaApiInterface

  createIdea(requestParameters: CreateIdeaRequest): Promise<Idea> {
    console.log("Server RECV: createIdea", requestParameters);
    if(!this.loggedInUser) {
      return this.throwLater(403, 'Need to be logged in');
    }

    const group = this.conf.ideaGroups.find(g => g.id === requestParameters.groupId);
    if(!group) {
      return this.throwLater(400, 'Invalid request: Unknown group');
    }

    const supportType = group.supportType || this.conf.supportType;
    const isIdeaFunding = requestParameters.creditsToFund && requestParameters.creditsToFund > 0;
    if(supportType === ConfSupportType.None) {
      return this.throwLater(400, 'Invalid request: Voting not allowed');
    }
    if(isIdeaFunding && supportType === ConfSupportType.VotingOnly) {
      return this.throwLater(400, 'Invalid request: Only voting allowed, funding is not');
    }
    if(!isIdeaFunding && supportType === ConfSupportType.FundingOnly) {
      return this.throwLater(400, 'Invalid request: Only funding allowed, voting is not');
    }

    const addVote = supportType === ConfSupportType.FundingVoting
      || supportType === ConfSupportType.VotingOnly;

    const idea = IdeaFromJSON({
      id: this.generateId(),
      authorUserId: this.loggedInUser,
      created: new Date(),
      title: requestParameters.title,
      description: requestParameters.description,
      groupId: requestParameters.groupId,
      statusId: group.defaultIdeaStatusId || this.conf.defaultIdeaStatusId,
      tagIds: requestParameters.tagIds,
      credits: requestParameters.creditsToFund || 0,
      creditGoal: 0,
      funderCount: isIdeaFunding ? 1 : 0,
      supporterCount: addVote ? 1 : 0,
      myCredits: requestParameters.creditsToFund,
      mySupport: addVote,
    });

    if(idea.tagIds) {
      for(let tagId of idea.tagIds) {
        if(group.settableIdeaTagIdsOnCreate && group.settableIdeaTagIdsOnCreate.indexOf(tagId) >= 0
          || this.conf.settableIdeaTagIdsOnCreate && this.conf.settableIdeaTagIdsOnCreate.indexOf(tagId) >= 0) {
          var tagName = this.conf.ideaTags ? this.conf.ideaTags[tagId] || undefined : undefined;
          if(tagName) {
            return this.throwLater(400, 'Invalid request: Idea tag not found: ' + tagId);
          } else {
            return this.throwLater(400, 'Invalid request: Idea tag not allowed: ' + tagName);
          }
        }
      }
    }

    this.ideas[idea.id] = idea;

    if(addVote) {
      this.addVoteToVotesSet(this.loggedInUser.id, idea.id);
    }

    return this.returnLater(idea);
  }

  deleteIdea(requestParameters: DeleteIdeaRequest): Promise<void> {
    console.log("Server RECV: deleteIdea", requestParameters);
    if(!this.loggedInUser) {
      return this.throwLater(403, 'You need to login first to delete an idea');
    }

    const idea = this.ideas[requestParameters.ideaId];
    if(!idea) {
      return this.throwLater(404, 'Idea does not exist anymore');
    }

    if(!this.loggedInUser.isAdmin && idea.authorUserId !== this.loggedInUser.id) {
      return this.throwLater(403, 'You cannot delete an idea that is not yours');
    }

    delete this.ideas[requestParameters.ideaId];
    return this.returnLater();
  }

  getIdea(requestParameters: GetIdeaRequest): Promise<Idea> {
    console.log("Server RECV: getIdea", requestParameters);
    const idea = this.ideas[requestParameters.ideaId];
    if(!idea) {
      return this.throwLater(404, 'Idea does not exist anymore');
    }
    return this.returnLater(idea);
  }

  getIdeas(requestParameters: GetIdeasRequest): Promise<Ideas> {
    console.log("Server RECV: getIdeas", requestParameters);
    const limit = requestParameters.searchQuery.limit || 10;
    if(limit < 0 || limit > 50) {
      return this.throwLater(400, 'Invalid request: limit is out of bounds');
    }

    var result:Array<Idea> = [];
    for(var idea of Object.values(this.ideas)) {
      if(requestParameters.searchQuery.filterIdeaStatusIds
        && requestParameters.searchQuery.filterIdeaStatusIds.length > 0
        && !requestParameters.searchQuery.filterIdeaStatusIds.includes(idea.statusId)) {
        continue;
      }

      if(requestParameters.searchQuery.filterIdeaGroupIds
        && requestParameters.searchQuery.filterIdeaGroupIds.length > 0
        && !requestParameters.searchQuery.filterIdeaGroupIds.includes(idea.groupId)) {
        continue;
      }

      if(requestParameters.searchQuery.filterIdeaTagIds
        && requestParameters.searchQuery.filterIdeaTagIds.length > 0
        && (!idea.tagIds
        || requestParameters.searchQuery.filterIdeaTagIds.filter(tagId =>
            idea.tagIds && idea.tagIds.includes(tagId)
          ).length > 0)) {
        continue;
      }


      if(requestParameters.searchQuery.searchText
        && idea.title.indexOf(requestParameters.searchQuery.searchText) < 0
        && idea.description.indexOf(requestParameters.searchQuery.searchText) < 0) {
        continue;
      }

      result.push(idea);
    }

    if(requestParameters.searchQuery.sortBy === SortBy.Top) {
      result.sort((l, r) => 
        (r.credits || r.supporterCount || 0)
        - (l.credits || l.supporterCount || 0)
      );
    } else if(requestParameters.searchQuery.sortBy === SortBy.New) {
      result.sort((l, r) => 
        r.created.getTime() - l.created.getTime()
      );
    } else if(requestParameters.searchQuery.sortBy === SortBy.Trending) {
      result.sort((l, r) => 
        this.calcTrendingScore(r) - this.calcTrendingScore(l)
      );
    }

    var currentCursor = 0;
    if(requestParameters.cursor) {
      currentCursor = parseInt(requestParameters.cursor);
    }

    var nextCursor:string|undefined = undefined;
    if(result.length >= currentCursor + limit) {
      nextCursor = currentCursor + limit + '';
    }

    result.slice(currentCursor, Math.min(result.length, currentCursor + limit));

    return this.returnLater(IdeasFromJSON({
      ideas: result,
      cursor: nextCursor,
    }));
  }

  updateIdea(requestParameters: UpdateIdeaRequest): Promise<void> {
    console.log("Server RECV: updateIdea", requestParameters);
    throw new Error("Method not implemented.");
  }

  // ### UserApiInterface

  getUser(requestParameters: GetUserRequest): Promise<User> {
    console.log("Server RECV: getUser", requestParameters);
    const user = this.users[requestParameters.userId];
    if(!user) {
      return this.throwLater(404, 'User does not exist anymore');
    }
    return this.returnLater(user);
  }

  bindUser(requestParameters: BindUserRequest): Promise<AuthSuccessResult> {
    console.log("Server RECV: bindUser", requestParameters);
    throw new Error("Method not implemented.");
  }

  loginUser(requestParameters: LoginUserRequest): Promise<AuthSuccessResult> {
    console.log("Server RECV: loginUser", requestParameters);
    throw new Error("Method not implemented.");
  }

  registerUser(requestParameters: RegisterUserRequest): Promise<AuthSuccessResult> {
    console.log("Server RECV: registerUser", requestParameters);
    const newUser = UserFromJSON({
      'id': randomUuid(),
      'name': requestParameters.name || 'Anonymous',
      'isAdmin': false,
      'avatar': requestParameters.avatar,
    });
    this.users[newUser.id] = newUser;
    this.loggedInUser = newUser;
    return this.returnLater(newUser);
  }

  updateUser(requestParameters: UpdateUserRequest): Promise<void> {
    console.log("Server RECV : updateUser", requestParameters);
    throw new Error("Method not implemented.");
  }

  // ### Private methods

  addVoteToVotesSet(userId:string, ideaId:string) {
    var userIdVotes = this.ideaIdToUserIdVotes[ideaId];
    if(!userIdVotes) {
      userIdVotes = new Set();
      this.ideaIdToUserIdVotes[ideaId] = userIdVotes;
    }
    userIdVotes.add(userId);
  }

  calcTrendingScore(idea:Idea) {
    var score = (idea.funderCount || 0) + (idea.supporterCount || 0) + (idea.credits || 0) + 1;
    var order = Math.log(Math.max(score, 1));
    var seconds = idea.created.getTime() - 1134028003;
    return Math.ceil(order + seconds / 45000);
  }

  async returnLater(returnValue?:any) {
    console.log('Server SEND:', returnValue);
    await new Promise(resolve => setTimeout(resolve, this.LATENCY));
    return returnValue;
  }

  async throwLater(httpStatus:number, userFacingMessage?:string):Promise<any> {
    console.log('Server THROW:', httpStatus, userFacingMessage);
    await new Promise(resolve => setTimeout(resolve, this.LATENCY));
    throw {
      status: httpStatus,
      json: Promise.resolve(ErrorResponseFromJSON({
        userFacingMessage: userFacingMessage,
      })),
    };
  }

  generateId():string {
    return randomUuid();
  }
}

export default ServerMock;
