import * as Admin from "./admin";
import ServerMock from "./serverMock";
import { emojiIndex } from 'emoji-mart'
import { loremIpsum } from "lorem-ipsum";

class DataMock {
  projectId:string;

  constructor(projectId:string) {
    this.projectId = projectId;
  }

  static get(projectId:string):DataMock {
    return new DataMock(projectId);
  }

  mockItems():Promise<any> {
    ServerMock.get().setLatency(false);
    return ServerMock.get().configGetAdmin({projectId: this.projectId})
      .then((versionedConfig:Admin.VersionedConfigAdmin) => {
        const promises:Promise<any>[] = [];
        versionedConfig.config.content.categories.forEach((category:Admin.Category) => {
          [undefined, ...category.workflow.statuses].forEach((status:Admin.IdeaStatus|undefined) => {
            var n = 4;
            while (n-- > 0) {
              promises.push(this.mockUser(versionedConfig)
                .then((user:Admin.UserAdmin) => 
                  this.mockIdea(versionedConfig, category, status, user)
                    .then(() => ServerMock.get().setLatency(true))
                )
              );
            }
          });
        });
        return Promise.all(promises);
      });
  }

  mockUser(versionedConfig:Admin.VersionedConfigAdmin):Promise<Admin.UserAdmin> {
    return ServerMock.get().userCreateAdmin({
      projectId: versionedConfig.config.projectId,
      create: {
        name: loremIpsum({
          units: 'words',
          count: 2,
        }),
        email: 'example@example.com',
      },
    });
  }

  mockIdea(versionedConfig:Admin.VersionedConfigAdmin, category:Admin.Category, status:Admin.IdeaStatus|undefined, user:Admin.UserAdmin):Promise<any> {
    return ServerMock.get().ideaCreateAdmin({
      projectId: this.projectId,
      create: {
        ...this.fakeMockIdeaData(category),
        authorUserId: user.userId,
        title: loremIpsum({
          units: 'words',
          count: Math.round(Math.random() * 10 + 3),
        }),
        description: loremIpsum({
          units: 'paragraphs',
          count: Math.round(Math.random() * 3 + 1),
        }),
        categoryId: category.categoryId,
        tagIds: Math.random() < 0.3 ? [] : category.tagging.tags
          .filter(t => Math.random() < 0.3)
          .map(t => t.tagId),
        statusId: status ? status.statusId : undefined,
        created: new Date(Math.random() * new Date().getTime()),
      },
    })
    .then((item:Admin.IdeaAdmin) => this.mockCommentsAndExpression(versionedConfig, category, item))
  }

  fakeMockIdeaData(category:Admin.Category):Partial<Admin.IdeaAdmin> {
    return {
      ...(Math.random() < 0.5 ? {
        funded: Math.round(Math.random() * 500),
        fundersCount: Math.round(Math.random() * 100),
      } : {}),
      ...(Math.random() < 0.5 ? {
        fundGoal: Math.round(Math.random() * 10) * 50,
      } : {}),
      ...(Math.random() < 0.9 ? {
        votersCount: Math.round(Math.random() * 30),
        voteValue: Math.round(Math.random() * 1000) - 300,
      } : {}),
      ...(Math.random() < 0.09 ? {
        expressionsValue: Math.random() * 100,
        expressions: ((category.support.express && category.support.express.limitEmojis)
          ? category.support.express.limitEmojis.map(e => e.display)
          : ['😀', '😁', '🤣', '😉', '😍', '😝', '😕', '😱', '💩', '🙀', '❤', '👍'])
          .map(emojiDisplay => {return {
            display: emojiDisplay,
            count: Math.round(Math.random() * 100),
          }}),
      } : {}),
    };
  }

  mockCommentsAndExpression(versionedConfig:Admin.VersionedConfigAdmin, category:Admin.Category, item:Admin.IdeaAdmin, level:number = 2, numComments:number = 1, parentComment:Admin.Comment|undefined = undefined):Promise<any> {
    return this.mockUser(versionedConfig)
      .then(user => this.mockExpression(versionedConfig, category, item, user)
        .then(() => ServerMock.get().commentCreateAdmin({
          projectId: this.projectId,
          ideaId: item.ideaId,
          comment: {
            authorUserId: user.userId,
            content: loremIpsum({
              units: 'sentences',
              count: Math.round(Math.random() * 3 + 1),
            }),
            parentCommentId: parentComment ? parentComment.commentId : undefined,
            created: new Date(Math.random() * new Date().getTime()),
          },
        }))
        .then(comment => {
          if(Math.random() < 0.1) {
            return ServerMock.get().commentDelete({
              projectId: this.projectId,
              ideaId: item.ideaId,
              commentId: comment.commentId,
            })
            .then(() => comment);
          }
          if(Math.random() < 0.2) {
            return ServerMock.get().commentUpdate({
              projectId: this.projectId,
              ideaId: item.ideaId,
              commentId: comment.commentId,
              update: { content: loremIpsum({
                units: 'sentences',
                count: Math.round(Math.random() * 3 + 1),
              })}
            });
          }
          return comment;
        }))
      .then(comment => {
        if(level <= 0 ) return Promise.resolve();
        var remainingComments = numComments * Math.random();
        var promise:Promise<any> = Promise.resolve();
        while(remainingComments-- > 0){
          promise = promise.then(() => this.mockCommentsAndExpression(versionedConfig, category, item, level - 1, numComments, comment));
        }
        return promise;
      });
  }

  mockExpression(versionedConfig:Admin.VersionedConfigAdmin, category:Admin.Category, item:Admin.IdeaAdmin, user:Admin.UserAdmin):Promise<any> {
    return ServerMock.get().voteUpdateAdmin({
      projectId: this.projectId,
      update: {
        ideaId: item.ideaId,
        voterUserId: user.userId,
        fundAmount: (category.support.fund && Math.random() < 0.2)
          ? ((versionedConfig.config.credits.increment
              ? Math.ceil(Math.random() * 1000 / versionedConfig.config.credits.increment) * versionedConfig.config.credits.increment
              : Math.random() * 1000))
          : undefined,
        vote: category.support.vote && Math.random() < 0.5
          ? (category.support.vote.enableDownvotes && Math.random() < 0.5
            ? Admin.VoteUpdateVoteEnum.Upvote : Admin.VoteUpdateVoteEnum.Downvote)
          : undefined,
        expressions: { add: [
          category.support.express
            ? (category.support.express.limitEmojis
              ? category.support.express.limitEmojis[Math.floor(Math.random() * category.support.express.limitEmojis.length)].display
              : Object.values(emojiIndex.emojis)[Math.floor(Math.random() * Object.values(emojiIndex.emojis).length)]['native'])
            : undefined
        ]},
      }
    });
  }
}

export default DataMock;
