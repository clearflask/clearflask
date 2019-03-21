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
} from './client';
import randomUuid from '../util/uuid';

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
    this.conf = conf;
    if(loggedInUser) {
      this.loggedInUser = loggedInUser
      this.users[loggedInUser.id] = loggedInUser;
    }
  }

  // ### CommentApiInterface
  getComments(requestParameters: GetCommentsRequest): Promise<Array<Comment>> {
    return this.returnLater(this.ideaIdToComments[requestParameters.ideaId] || []);
  }

  // ### ConfigApiInterface

  getConfig(): Promise<Conf> {
    return this.returnLater(this.conf);
  }

  // ### CreditApiInterface

  getTransactions(requestParameters: GetTransactionsRequest): Promise<Array<Transaction>> {
    if(!this.loggedInUser || requestParameters.userId !== this.loggedInUser.id) {
      return this.throwLater(403, 'Cannot get transaction for other users');
    }

    return this.returnLater(this.userIdToTransactions[requestParameters.userId] || []);
  }

  voteIdea(requestParameters: VoteIdeaRequest): Promise<VoteIdeaResult> {
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

    var creditAmount = requestParameters.creditAmountOpt || 0 > 0 ? requestParameters.creditAmountOpt || 0 : 0;
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

  // ### IdeaApiInterface

  createIdea(requestParameters: CreateIdeaRequest): Promise<Idea> {
    if(!this.loggedInUser) {
      return this.throwLater(403, 'Need to be logged in');
    }

    requestParameters.createIdeaBody.idea.groupId
    const group = this.conf.ideaGroups[requestParameters.createIdeaBody.idea.groupId];
    if(!group) {
      return this.throwLater(400, 'Invalid request: Unknown group');
    }

    const supportType = group.supportType || this.conf.supportType;
    const isIdeaFunding = requestParameters.createIdeaBody.creditsToFund && requestParameters.createIdeaBody.creditsToFund > 0;
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
      ...requestParameters.createIdeaBody.idea,
      id: this.generateId(),
      authorUserId: this.loggedInUser,
      created: new Date(),
      statusId: group.defaultIdeaStatusId || this.conf.defaultIdeaStatusId,
      credits: requestParameters.createIdeaBody.creditsToFund || 0,
      creditGoal: 0,
      funderCount: isIdeaFunding ? 1 : 0,
      supporterCount: addVote ? 1 : 0,
      myCredits: requestParameters.createIdeaBody.creditsToFund,
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
    const idea = this.ideas[requestParameters.ideaId];
    if(!idea) {
      return this.throwLater(404, 'Idea does not exist anymore');
    }
    return this.returnLater(idea);
  }

  getIdeas(requestParameters: GetIdeasRequest): Promise<Ideas> {
    if(requestParameters.limit < 0 && requestParameters.limit > 50) {
      return this.throwLater(400, 'Invalid request: limit is out of bounds');
    }

    var result:Array<Idea> = [];
    for(var idea of Object.values(this.ideas)) {
      if(requestParameters.filterIdeaStatusIds
        && requestParameters.filterIdeaStatusIds.length > 0
        && requestParameters.filterIdeaStatusIds.indexOf(idea.groupId) < 0) {
        continue;
      }

      if(requestParameters.filterIdeaGroupIds
        && requestParameters.filterIdeaGroupIds.length > 0
        && requestParameters.filterIdeaGroupIds.indexOf(idea.statusId) < 0) {
        continue;
      }

      if(requestParameters.filterIdeaTagIds
        && requestParameters.filterIdeaTagIds.length > 0
        && (!idea.tagIds
        || requestParameters.filterIdeaTagIds.filter(tagId =>
            idea.tagIds && idea.tagIds.indexOf(tagId) >= 0
          ).length > 0)) {
        continue;
      }


      if(requestParameters.search
        && idea.title.indexOf(requestParameters.search) < 0
        && idea.description.indexOf(requestParameters.search) < 0) {
        continue;
      }

      result.push(idea);
    }

    if(requestParameters.sortBy === SortBy.Top) {
      result.sort((l, r) => 
        (r.credits || r.supporterCount || 0)
        - (l.credits || l.supporterCount || 0)
      );
    } else if(requestParameters.sortBy === SortBy.New) {
      result.sort((l, r) => 
        r.created.getTime() - l.created.getTime()
      );
    } else if(requestParameters.sortBy === SortBy.Trending) {
      result.sort((l, r) => 
        this.calcTrendingScore(r) - this.calcTrendingScore(l)
      );
    }

    var currentCursor = 0;
    if(requestParameters.cursor) {
      currentCursor = parseInt(requestParameters.cursor);
    }

    var nextCursor:string|undefined = undefined;
    if(result.length <= currentCursor + requestParameters.limit) {
      nextCursor = currentCursor + requestParameters.limit + '';
    }

    result.slice(currentCursor, Math.min(result.length, currentCursor + requestParameters.limit));

    return this.returnLater(IdeasFromJSON({
      ideas: result,
      cursor: nextCursor,
    }));
  }

  // ### UserApiInterface

  getUser(requestParameters: GetUserRequest): Promise<User> {
    const user = this.users[requestParameters.userId];
    if(!user) {
      return this.throwLater(404, 'User does not exist anymore');
    }
    return this.returnLater(user);
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
    await new Promise(resolve => setTimeout(resolve, this.LATENCY));
    return returnValue;
  }

  async throwLater(httpStatus:number, userFacingMessage?:string):Promise<any> {
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
