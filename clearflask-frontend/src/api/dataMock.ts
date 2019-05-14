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

  mockAll():Promise<any> {
    return this.mockLoggedIn()
    .then(this.mockItems.bind(this));
  }

  mockLoggedIn():Promise<any> {
    return ServerMock.get().userCreate({
      projectId: this.projectId,
      create: {
        name: 'John Doe',
        email: 'john.doe@example.com',
        password: 'password',
        iosPushToken: 'fake-ios-push-token',
        browserPushToken: 'fake-browser-push-token',
      }
    }).then(userMe => {
      ServerMock.get().transactionCreateAdmin({
        projectId: this.projectId,
        userId: userMe.userId,
        transaction: {
          amount: 400,
          summary: 'Mock amount given, spend it wisely',
        },
      });
    });
  }

  mockItems():Promise<any> {
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
      ...(Math.random() < 0.9 ? {
        expressionsValue: Math.random() * 100,
        expressions: ((category.support.express && category.support.express.limitEmojiSet)
          ? category.support.express.limitEmojiSet.map(e => e.display)
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
      .then(user => ServerMock.get().commentCreateAdmin({
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
        })
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
}

export default DataMock;
