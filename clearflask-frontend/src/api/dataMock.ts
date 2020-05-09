import { loremIpsum } from "lorem-ipsum";
import { CreateTemplateOptions } from "../common/config/configTemplater";
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

  async templateMock(opts: CreateTemplateOptions) {
    const config = await this.getConfig();
    const user1 = await this.mockUser('Emily');
    const user2 = await this.mockUser('Jacob');
    const user3 = await this.mockUser('Sophie');
    const user4 = await this.mockUser('Harry');
    if (opts.templateFeedback) {
      const ideaCategory = config.content.categories.find(c => c.name.match(/Idea/))!;
      const bugCategory = config.content.categories.find(c => c.name.match(/Bug/))!;
      await this.mockItem(
        config.projectId, ideaCategory.categoryId, user1,
        'ERP system integration',
        'I would like to synchronize my data with our ERP system automatically.',
        undefined,
        opts.fundingAllowed ? 3500 : undefined, opts.fundingAllowed ? 6000 : undefined,
        opts.votingAllowed ? 7 : undefined,
        opts.expressionAllowed ? this.fakeExpressions(ideaCategory, 5) : undefined,
        (ideaCategory.workflow.statuses.find(s => s.name.match(/Funding/))
          || ideaCategory.workflow.statuses.find(s => s.name.match(/Planned/)))!.statusId,
        undefined
      );
      await this.mockItem(
        config.projectId, ideaCategory.categoryId, user2,
        'Customize order of options',
        'I want to be able to re-order the options we have in the main settings page.',
        undefined,
        opts.fundingAllowed ? 1200 : undefined, opts.fundingAllowed ? 1000 : undefined,
        opts.votingAllowed ? 7 : undefined,
        opts.expressionAllowed ? this.fakeExpressions(ideaCategory, 5) : undefined,
        ideaCategory.workflow.statuses.find(s => s.name.match(/Planned/))!.statusId,
        undefined
      );
      await this.mockItem(
        config.projectId, ideaCategory.categoryId, user3,
        'Dark mode',
        'The app burns my eyes at night and it would be great if you can make a dark mode option.',
        undefined, undefined, undefined,
        opts.votingAllowed ? 4 : undefined,
        opts.expressionAllowed ? this.fakeExpressions(ideaCategory, 4) : undefined,
        ideaCategory.workflow.statuses.find(s => s.name.match(/Under review/))!.statusId,
        undefined
      );
      await this.mockItem(
        config.projectId, bugCategory.categoryId, user4,
        'Buttons too small',
        'In the settings page, all the buttons are too small, I always click the wrong option.',
        'Fixed in the next update',
        undefined, undefined,
        opts.votingAllowed ? 2 : undefined,
        opts.expressionAllowed ? this.fakeExpressions(ideaCategory, 2) : undefined,
        bugCategory.workflow.statuses.find(s => s.name.match(/In progress/))!.statusId,
        [bugCategory.tagging.tags.find(s => s.name.match(/Linux/))!.tagId],
      );
      await this.mockItem(
        config.projectId, bugCategory.categoryId, user1,
        'Finance page typo',
        "You accidentally spelt the word your as you're on the finance page under my finances tab",
        undefined, undefined, undefined,
        opts.votingAllowed ? 1 : undefined,
        undefined,
        bugCategory.workflow.statuses.find(s => s.name.match(/Fixed/))!.statusId,
        [bugCategory.tagging.tags.find(s => s.name.match(/Windows/))!.tagId],
      );
    }
    // if (opts.templateBlog) {
    //   const articleCategory = config.content.categories.find(c => c.name.match(/Article/))!;
    //   await this.mockItem(
    //     config.projectId, articleCategory.categoryId, user1,
    //     'How we scaled up our system in one week',
    //     "Shortly after launch, we had an unexpected number of users signing up for our platform."
    //     + " The increase in traffic was overwhelming our servers, particularly our database."
    //     + " We solved this by adding caching layers for our most requested API calls. The end.",
    //     undefined, undefined, undefined, undefined,
    //     this.fakeExpressions(articleCategory, 4),
    //     undefined, undefined,
    //   );
    //   await this.mockItem(
    //     config.projectId, articleCategory.categoryId, user3,
    //     'Cutting server costs',
    //     "After our publicity on our launch, the number of users has dropped off significantly."
    //     + " We noticed that the resource cost per user was quite high."
    //     + " This also applied to inactive users that have either abandoned our platform or are simply using it less frequently."
    //     + " We have started offloading this data into a long term storage to save costs. The end.",
    //     undefined, undefined, undefined, undefined,
    //     this.fakeExpressions(articleCategory, 2),
    //     undefined, undefined,
    //   );
    // }
    if (opts.templateChangelog) {
      const changelogCategory = config.content.categories.find(c => c.name.match(/Changelog/))!;
      await this.mockItem(
        config.projectId, changelogCategory.categoryId, user1,
        'Partnership with local bakery',
        "We have long awaited to partner with a local bakery for all of our baked goods."
        + " We are now announcing a long term partnership to bring baked goods for all of our customers."
        + " To sign up for the early access, visit our page to start receiving our beta bread.",
        undefined, undefined, undefined, undefined,
        this.fakeExpressions(changelogCategory, 1),
        undefined, undefined,
      );
      await this.mockItem(
        config.projectId, changelogCategory.categoryId, user2,
        'Introducing email integration',
        "Now you can email your customers directly to keep them updated on your delivery status."
        + " Visit your settings page to enable email notifications."
        + " Email notifications have shown to increase retention lift by 12% on average.",
        undefined, undefined, undefined, undefined,
        this.fakeExpressions(changelogCategory, 3),
        undefined, undefined,
      );
    }
    if (opts.templateKnowledgeBase) {
      const helpCategory = config.content.categories.find(c => c.name.match(/Help/))!;
      await this.mockItem(
        config.projectId, helpCategory.categoryId, user1,
        'Changing your email',
        "If you wish to change your email, go to the settings, preferences, change email."
        + " After submitting, you will receive a confirmation email to ensure you own that email address."
        + " Once confirmed, your email has been successfully changed.",
        undefined, undefined, undefined, undefined,
        this.fakeExpressions(helpCategory, 2),
        undefined,
        [helpCategory.tagging.tags.find(s => s.name.match(/Account/))!.tagId],
      );
      await this.mockItem(
        config.projectId, helpCategory.categoryId, user1,
        'Changing your shipping address',
        "If you wish to change your shipping address, go to the settings, preferences, change address."
        + " After submitting, you will receive a confirmation that your shipping address has been saved.",
        undefined, undefined, undefined, undefined,
        this.fakeExpressions(helpCategory, 2),
        undefined,
        [helpCategory.tagging.tags.find(s => s.name.match(/Account Setup/))!.tagId],
      );
      await this.mockItem(
        config.projectId, helpCategory.categoryId, user1,
        'Forgot password',
        "If you've forgotten your password to your account, use the Forgot Password link on the sign-in page."
        + " If you are unsuccessful, please send us an email at support@example.com so we can help you recover your password."
        + " You will be required to prove the ownership of the account by answering questions.",
        undefined, undefined, undefined, undefined,
        this.fakeExpressions(helpCategory, 1),
        undefined,
        [helpCategory.tagging.tags.find(s => s.name.match(/Account Setup/))!.tagId],
      );
      await this.mockItem(
        config.projectId, helpCategory.categoryId, user2,
        'Product has not arrived yet',
        "If you are waiting for your product and it has been less than three weeks,"
        + " please give it a little bit more time as our shipping provider may be backlogged especially during holidays."
        + " If it has been more than three weeks, contact us at support@example.com for us to check your status.",
        undefined, undefined, undefined, undefined,
        this.fakeExpressions(helpCategory, 3),
        undefined,
        [helpCategory.tagging.tags.find(s => s.name.match(/Ordering and Shipping/))!.tagId],
      );
      await this.mockItem(
        config.projectId, helpCategory.categoryId, user2,
        'My credit card was denied',
        "Due to fraud prevention, we have many checks to ensure all transactions are legitimate."
        + " If your credit card was denied, ensure the billing address and personal information is correct."
        + " if you still cannot get your transaction processed, try another credit card.",
        undefined, undefined, undefined, undefined,
        this.fakeExpressions(helpCategory, 3),
        undefined,
        [helpCategory.tagging.tags.find(s => s.name.match(/Ordering and Shipping/))!.tagId],
      );
      await this.mockItem(
        config.projectId, helpCategory.categoryId, user2,
        'Product has arrived broken',
        "If your product has arrived broken, contact us at support@example.com to get the issue resolved."
        + " Please take pictures of your received product and attach it to the email.",
        undefined, undefined, undefined, undefined,
        this.fakeExpressions(helpCategory, 3),
        undefined,
        [helpCategory.tagging.tags.find(s => s.name.match(/Ordering and Shipping/))!.tagId],
      );
    }
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
          categoryId: config.content.categories[0].categoryId,
          tagIds: [],
        },
      }),
      ServerMock.get().ideaCreateAdmin({
        projectId: this.projectId,
        ideaCreateAdmin: {
          authorUserId: user.userId,
          title: 'Saving fails',
          categoryId: config.content.categories[0].categoryId,
          tagIds: [],
        },
      }),
      ServerMock.get().ideaCreateAdmin({
        projectId: this.projectId,
        ideaCreateAdmin: {
          authorUserId: user.userId,
          title: 'App crashes',
          categoryId: config.content.categories[0].categoryId,
          tagIds: [],
        },
      }),
      ServerMock.get().ideaCreateAdmin({
        projectId: this.projectId,
        ideaCreateAdmin: {
          authorUserId: user.userId,
          title: 'Save not possible',
          categoryId: config.content.categories[0].categoryId,
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

  mockItem(
    projectId: string,
    categoryId: string,
    user: Admin.UserAdmin,
    title: string,
    description: string,
    response: string | undefined,
    funded: number | undefined,
    fundGoal: number | undefined,
    voteValue: number | undefined,
    expressions: { [key: string]: number; } | undefined,
    statusId: string | undefined,
    tagIds: string[] | undefined,
  ): Promise<Admin.Idea> {
    return ServerMock.get().ideaCreateAdmin({
      projectId: projectId,
      ideaCreateAdmin: {
        fundGoal: fundGoal,
        ...{ funded: funded || 0 },
        ...{ fundersCount: funded ? Math.round(Math.random() * 5) + 1 : 0 },
        ...{ voteValue: voteValue || 0 },
        ...{ expressions: expressions },
        authorUserId: user.userId,
        title: title,
        description: description,
        response: response,
        categoryId: categoryId,
        tagIds: tagIds || [],
        statusId: statusId,
      },
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
        statusId: config.content.categories[0].workflow.entryStatus,
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
