import { loremIpsum } from "lorem-ipsum";
import * as Admin from "./admin";
import ServerMock from "./serverMock";

interface MockedComment {
  content?: string;
  author?: Admin.User | string;
  created?: Date;
  edited?: Date;
  children?: MockedComment[];
  voteValue?: number;
}

class DataMock {
  projectId: string;

  constructor(projectId: string) {
    this.projectId = projectId;
  }

  static get(projectId: string): DataMock {
    return new DataMock(projectId);
  }

  async demoPage<T>(andThen: (config: Admin.ConfigAdmin, user: Admin.UserAdmin) => Promise<T>): Promise<T> {
    await this.mockLoggedIn(80);
    const config = await this.getConfig();
    const user = await this.mockUser('John Doe');
    return await andThen(config, user);
  }

  demoBoard(ideas: Array<{
    status: string,
    title?: string,
    description?: string,
    extra?: Partial<Admin.Idea>
  }>) {
    return this.demoPage((config, user) => Promise.all(ideas.map(idea => ServerMock.get().ideaCreateAdmin({
      projectId: this.projectId,
      ideaCreateAdmin: {
        authorUserId: user.userId,
        title: idea.title || loremIpsum({ units: 'words', count: Math.round(Math.random() * 10 + 3) }),
        description: idea.description,
        categoryId: 'demoCategoryId', // From configTemplater.demoCategory
        tagIds: [],
        statusId: idea.status,
        // Fake data
        ...{ ...idea.extra },
      },
    }))));
  }

  demoExplorer() {
    return this.demoPage((config, user) => Promise.all([
      ServerMock.get().ideaCreateAdmin({
        projectId: this.projectId,
        ideaCreateAdmin: {
          authorUserId: user.userId,
          title: 'Crash on save',
          categoryId: 'demoCategoryId', // From configTemplater.demoCategory
          tagIds: [],
        },
      }),
      ServerMock.get().ideaCreateAdmin({
        projectId: this.projectId,
        ideaCreateAdmin: {
          authorUserId: user.userId,
          title: 'Progress saving fails',
          categoryId: 'demoCategoryId', // From configTemplater.demoCategory
          tagIds: [],
        },
      }),
      ServerMock.get().ideaCreateAdmin({
        projectId: this.projectId,
        ideaCreateAdmin: {
          authorUserId: user.userId,
          title: 'Impossible to save',
          categoryId: 'demoCategoryId', // From configTemplater.demoCategory
          tagIds: [],
        },
      }),
      ServerMock.get().ideaCreateAdmin({
        projectId: this.projectId,
        ideaCreateAdmin: {
          authorUserId: user.userId,
          title: 'App crashes during save',
          categoryId: 'demoCategoryId', // From configTemplater.demoCategory
          tagIds: [],
        },
      }),
    ]));
  }

  demoPrioritization() {
    return this.demoPage((config, user) => ServerMock.get().ideaCreateAdmin({
      projectId: this.projectId,
      ideaCreateAdmin: {
        authorUserId: user.userId,
        title: 'Add Dark Mode',
        description: 'To reduce eye-strain, please add a dark mode option',
        categoryId: 'demoCategoryId', // From configTemplater.demoCategory
        tagIds: [],
        ...{ // Fake data
          funded: 12,
          fundersCount: 5,
          fundGoal: 60,
          voteValue: 3,
          expressionsValue: 7,
          expressions: {
            '👍': 4,
            '❤️': 1,
          },
        },
      },
    }).then(() =>
      ServerMock.get().ideaCreateAdmin({
        projectId: this.projectId,
        ideaCreateAdmin: {
          authorUserId: user.userId,
          title: 'Support Jira Integration',
          description: 'I would like to be able to synchronize user ideas with my Jira board',
          categoryId: config.content.categories[0].categoryId,
          tagIds: [],
          ...{ // Fake data
            funded: 80,
            fundersCount: 5,
            fundGoal: 200,
            voteValue: 42,
            expressionsValue: 56,
            expressions: {
              '👍': 34,
              '❤️': 5,
            },
          },
        },
      }).then(idea => ServerMock.get().ideaVoteUpdate({
        projectId: this.projectId,
        ideaId: idea.ideaId,
        ideaVoteUpdate: {
          fundDiff: 40,
        },
      }))));
  }

  mockAll(): Promise<any> {
    return this.mockAccountCreate()
      .then(() => this.mockLoggedIn())
      .then(userMe =>
        this.mockItems(userMe)
          .then(() => this.mockNotification(userMe)));
  }

  mockNotification(userMe: Admin.User): Promise<any> {
    ServerMock.get().addNotification(
      this.projectId,
      userMe,
      'Welcome to your first notification',
    );
    return Promise.resolve();
  }

  mockAccountCreate(): Promise<Admin.AccountAdmin> {
    return ServerMock.get().accountSignupAdmin({
      accountSignupAdmin: {
        name: 'John Doe',
        email: 'a@a.a',
        password: 'pass',
      }
    });
  }

  mockLoggedIn(bankBalance: number = 10000): Promise<Admin.UserMeWithBalance> {
    return ServerMock.get().userCreate({
      projectId: this.projectId,
      userCreate: {
        name: 'John Doe',
        email: 'john.doe@example.com',
        password: 'password',
        iosPushToken: 'fake-ios-push-token',
        // browserPushToken: 'fake-browser-push-token',
      }
    }).then(userMe => {
      ServerMock.get().userUpdateAdmin({
        projectId: this.projectId,
        userId: userMe.userId,
        userUpdateAdmin: {
          transactionCreate: {
            amount: bankBalance,
            summary: 'Mock amount given, spend it wisely',
          }
        },
      });
      return userMe;
    });
  }

  mockItems(userMe?: Admin.UserMeWithBalance, ideaPerTypeCount: number = 4): Promise<any> {
    return ServerMock.get().configGetAdmin({ projectId: this.projectId })
      .then((versionedConfig: Admin.VersionedConfigAdmin) => {
        const promises: Promise<any>[] = [];
        versionedConfig.config.content.categories.forEach((category: Admin.Category) => {
          [undefined, ...category.workflow.statuses].forEach((status: Admin.IdeaStatus | undefined) => {
            var n = ideaPerTypeCount;
            while (n-- > 0) {
              promises.push((userMe && n === 1 ? Promise.resolve(userMe) : this.mockUser())
                .then((user: Admin.User) =>
                  this.mockIdea(category, status, user)
                )
              );
            }
          });
        });
        return Promise.all(promises);
      });
  }

  mockUser(name?: string): Promise<Admin.UserAdmin> {
    return ServerMock.get().userCreateAdmin({
      projectId: this.projectId,
      userCreateAdmin: {
        name: name || loremIpsum({
          units: 'words',
          count: 2,
        }),
        email: 'example@example.com',
        ...{ created: this.mockDate() },
      },
    });
  }

  async mockIdea(category: Admin.Category, status: Admin.IdeaStatus | undefined = undefined, user: Admin.User | undefined = undefined, extra: Partial<Admin.Idea> = {}, suppressComments: boolean = false): Promise<Admin.Idea> {
    if (user === undefined) {
      user = await this.mockUser();
    }
    const item = await ServerMock.get().ideaCreateAdmin({
      projectId: this.projectId,
      ideaCreateAdmin: {
        ...this.fakeMockIdeaData(category),
        authorUserId: user.userId,
        title: loremIpsum({
          units: 'words',
          count: Math.round(Math.random() * 5 + 3),
        }),
        description: loremIpsum({
          units: 'paragraphs',
          count: Math.round(Math.random() * 3 + 1),
        }),
        response: Math.random() < 0.3 ? undefined : loremIpsum({
          units: 'words',
          count: Math.round(Math.random() * 10 + 3),
        }),
        categoryId: category.categoryId,
        tagIds: Math.random() < 0.3 ? [] : category.tagging.tags
          .filter(t => Math.random() < 0.3)
          .map(t => t.tagId),
        statusId: status ? status.statusId : undefined,
        ...{ created: this.mockDate() },
        ...extra,
      },
    });
    !suppressComments && category.support.comment && this.mockComments([user], item);
    return item;
  }

  fakeMockIdeaData(category: Admin.Category): Partial<Admin.Idea> {
    return {
      ...(Math.random() < 0.5 ? {
        funded: Math.round(Math.random() * 50000),
        fundersCount: Math.round(Math.random() * 100),
      } : {}),
      ...(Math.random() < 0.5 ? {
        fundGoal: Math.round(Math.random() * 10) * 5000,
      } : {}),
      ...(Math.random() < 0.9 ? {
        voteValue: Math.round(Math.random() * 1000) - 300,
      } : {}),
      ...(Math.random() < 0.9 ? {
        expressionsValue: Math.random() * 10,
        expressions: this.fakeExpressions(category),
      } : {}),
    };
  }

  fakeExpressions(category: Admin.Category, count: number = 40): { [key: string]: number; } {
    const expressions: { [key: string]: number; } = {};
    const availableEmojis = (category.support.express && category.support.express.limitEmojiSet)
      ? category.support.express.limitEmojiSet.map(e => e.display)
      : ['😀', '😁', '🤣', '😉', '😍', '😝', '😕', '😱', '💩', '🙀', '❤', '👍'];
    while (count > 0) {
      const emoji = availableEmojis[Math.floor(Math.random() * availableEmojis.length)];
      const amount = Math.max(1, Math.floor(count * 0.6), Math.floor(Math.random() * count));
      count -= amount;
      expressions[emoji] = (expressions[emoji] || 0) + amount;
    }
    return expressions;
  }

  async mockFakeIdeaWithComments(ideaId: string = 'captcha-to-reduce-spam'): Promise<Admin.IdeaWithVote> {
    const idea = await this.demoPage((config, user) => ServerMock.get().ideaCreateAdmin({
      projectId: this.projectId,
      ideaCreateAdmin: {
        authorUserId: user.userId,
        title: 'Add Dark Mode',
        description: 'To reduce eye-strain, please add a dark mode option',
        response: 'Added to our backlog, thanks!',
        categoryId: config.content.categories[0].categoryId,
        statusId: config.content.categories[0].workflow.statuses[3].statusId,
        tagIds: [],
        ...{ // Fake data
          ideaId,
          funded: 12,
          fundersCount: 5,
          fundGoal: 60,
          voteValue: 89,
          expressionsValue: 7,
          expressions: {
            '👍': 4,
            '❤️': 1,
          },
        },
      },
    }));

    await this.mockDetailedComments([
      {
        content: 'Also, it would be great if the black color can be a pure black in order to save mobile battery life.', author: 'John', voteValue: 43, children: [
          {
            content: 'A pure black color does not look good in all cases', author: 'Charlotte', voteValue: 22, children: [
              {
                content: 'I disagree, a pure black looks nice if done right', author: 'John', voteValue: 1, created: new Date(),
              },
            ]
          },
          {
            content: 'It would be great if you could choose between various themes', author: 'Daisy', voteValue: 12, children: [
              {
                content: 'They wont have time do all of that', author: 'John', voteValue: -3, children: [
                  { content: 'Lets see what they say', author: 'John', voteValue: 3 }
                ]
              }
            ]
          },
        ]
      },
    ], idea);

    return idea;
  }


  async mockDetailedComments(comments: MockedComment[], item: Admin.Idea, parentCommentId: string | undefined = undefined): Promise<any> {
    const users: { [name: string]: Admin.User } = {};
    for (const comment of comments) {
      var user: Admin.User | undefined;
      if (typeof comment.author === 'string') {
        if (!users[comment.author]) {
          users[comment.author] = await this.mockUser(comment.author);
        }
        user = users[comment.author];
      } else {
        user = comment.author;
      }
      const createdComment = await ServerMock.get().commentCreate({
        projectId: this.projectId,
        ideaId: item.ideaId,
        commentCreate: {
          content: comment.content as string,
          parentCommentId,
          ...{
            author: user,
            created: comment.created || this.mockDate(),
            edited: comment.edited,
            voteValue: comment.voteValue || 1,
          },
        },
      });
      if (comment.children && comment.children.length > 0) {
        await this.mockDetailedComments(comment.children, item, createdComment.commentId);
      }
    }
  }

  mockComments(userMentionPool: Admin.User[], item: Admin.Idea, numComments: number = 1, level: number = 2, parentComment: Admin.Comment | undefined = undefined): Promise<any> {
    return this.mockUser()
      .then(user => {
        userMentionPool.push(user);
        return user;
      })
      .then(user => ServerMock.get().commentCreate({
        projectId: this.projectId,
        ideaId: item.ideaId,
        commentCreate: {
          content: this.mockMention(userMentionPool) + loremIpsum({
            units: 'sentences',
            count: Math.round(Math.random() * 3 + 1),
          }),
          parentCommentId: parentComment ? parentComment.commentId : undefined,
          ...{
            author: user,
            created: this.mockDate(),
            voteValue: Math.round(Math.random() * 120 - 40),
          },
        },
      }))
      .then(comment => {
        if (Math.random() < 0.1) {
          return ServerMock.get().commentDelete({
            projectId: this.projectId,
            ideaId: item.ideaId,
            commentId: comment.commentId,
          })
            .then(() => comment);
        }
        if (Math.random() < 0.2) {
          return ServerMock.get().commentUpdate({
            projectId: this.projectId,
            ideaId: item.ideaId,
            commentId: comment.commentId,
            commentUpdate: {
              content: this.mockMention(userMentionPool) + loremIpsum({
                units: 'sentences',
                count: Math.round(Math.random() * 3 + 1),
              })
            }
          });
        }
        return comment;
      })
      .then(comment => {
        if (level <= 0) return Promise.resolve();
        var remainingComments = numComments * Math.random();
        var promise: Promise<any> = Promise.resolve();
        while (remainingComments-- > 0) {
          promise = promise.then(() => this.mockComments(userMentionPool, item, numComments, level - 1, comment));
        }
        return promise;
      });
  }

  mockMention(userPool: Admin.User[]): string {
    return Math.random() < 0 // TODO Mentions disabled for now
      ? '@' + userPool[Math.floor(Math.random() * userPool.length)].name + ' '
      : '';
  }

  async getConfig(): Promise<Admin.ConfigAdmin> {
    const versionedConfig = await ServerMock.get().configGetAdmin({ projectId: this.projectId });
    return versionedConfig.config;
  }

  lastMockDate?: Date;
  mockDate(): Date {
    if (this.lastMockDate === undefined) {
      this.lastMockDate = new Date();
      this.lastMockDate.setDate(this.lastMockDate.getDate() - 10);
    } else {
      this.lastMockDate.setTime(this.lastMockDate.getTime() + ((Math.random() + 1) * 60 * 60 * 1000));
    }
    return new Date(this.lastMockDate);
  }
}

export default DataMock;
