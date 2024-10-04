// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import { loremIpsum } from 'lorem-ipsum';
import { CreateTemplateOptions } from '../common/config/configTemplater';
import { ChangelogCategoryIdPrefix } from '../common/config/template/changelog';
import { saltHashPassword } from '../common/util/auth';
import { textToHtml } from '../common/util/richEditorUtil';
import { capitalize } from '../common/util/stringUtil';
import * as Admin from './admin';
import ServerMock, { DefaultMockUserPlanId, SuperAdminEmail } from './serverMock';

interface MockedComment {
  content?: string;
  author?: Admin.User | string;
  authorIsMod?: boolean;
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
      const postCategory = config.content.categories.find(c => c.name.match(/Post/))!;
      await this.mockItem(
        config.projectId, postCategory.categoryId, user1,
        'Payment Gateway integration',
        'We will need to synchronize our customers and payments via our payment gateway',
        undefined,
        opts.fundingAllowed ? 5000 : undefined, opts.fundingAllowed ? 6000 : undefined,
        opts.votingAllowed ? 12 : undefined,
        opts.expressionAllowed ? this.fakeExpressions(postCategory, 10) : undefined,
        (postCategory.workflow.statuses.find(s => s.name.match(/Funding/))
          || postCategory.workflow.statuses.find(s => s.name.match(/Planned/)))!.statusId,
      );
      await this.mockItem(
        config.projectId, postCategory.categoryId, user1,
        'ERP system integration',
        'I would like to synchronize my data with our ERP system automatically.',
        undefined,
        opts.fundingAllowed ? 3500 : undefined, opts.fundingAllowed ? 6000 : undefined,
        opts.votingAllowed ? 7 : undefined,
        opts.expressionAllowed ? this.fakeExpressions(postCategory, 5) : undefined,
        (postCategory.workflow.statuses.find(s => s.name.match(/Funding/))
          || postCategory.workflow.statuses.find(s => s.name.match(/In progress/)))!.statusId,
      );
      await this.mockItem(
        config.projectId, postCategory.categoryId, user1,
        'Email and notifications customization',
        '<div>Be able to change how notifications look like including:</div><div><br></div><ul><li>Text (Subject, body)</li><li>Logo (in email and web push notification)</li><li>"From" name and address (Email only)</li></ul><div><br></div><div>For events:</div><div><br></div><ul><li>On Status or Response changed</li><li>On comment reply</li><li>On credit changed</li><li>On forgot password</li><li>Email changed</li><li>Email verification</li></ul><div><br></div>',
        undefined,
        opts.fundingAllowed ? 4000 : undefined, opts.fundingAllowed ? 10000 : undefined,
        opts.votingAllowed ? 14 : undefined,
        opts.expressionAllowed ? this.fakeExpressions(postCategory, 18) : undefined,
        (postCategory.workflow.statuses.find(s => s.name.match(/Funding/))
          || postCategory.workflow.statuses.find(s => s.name.match(/Completed/)))!.statusId,
      );
      await this.mockItem(
        config.projectId, postCategory.categoryId, user2,
        'Customize order of options',
        'I want to be able to re-order the options we have in the main settings page.',
        undefined,
        opts.fundingAllowed ? 1200 : undefined, opts.fundingAllowed ? 1000 : undefined,
        opts.votingAllowed ? 7 : undefined,
        opts.expressionAllowed ? this.fakeExpressions(postCategory, 5) : undefined,
        postCategory.workflow.statuses.find(s => s.name.match(/Planned/))!.statusId,
      );
      await this.mockItem(
        config.projectId, postCategory.categoryId, user2,
        'App Store integration',
        '<div>Synchronize customer purchases from App stores including:</div><div><br></div><ul><li>Apple App Store</li><li>Google Play Store</li></ul><div><br></div>',
        undefined,
        opts.fundingAllowed ? 1400 : undefined, opts.fundingAllowed ? 1000 : undefined,
        opts.votingAllowed ? 7 : undefined,
        opts.expressionAllowed ? this.fakeExpressions(postCategory, 6) : undefined,
        postCategory.workflow.statuses.find(s => s.name.match(/Planned/))!.statusId,
      );
      await this.mockItem(
        config.projectId, postCategory.categoryId, user3,
        'Dark mode',
        'The app burns my eyes at night and it would be great if you can make a dark mode option.',
        undefined,
        opts.fundingAllowed ? 1000 : undefined, undefined,
        opts.votingAllowed ? 4 : undefined,
        opts.expressionAllowed ? this.fakeExpressions(postCategory, 4) : undefined,
        postCategory.workflow.statuses.find(s => s.name.match(/Under review/))!.statusId,
      );
      await this.mockItem(
        config.projectId, postCategory.categoryId, user3,
        'Link posts together (Different from Merge)',
        'Linking allows a post to link to other posts.',
        undefined,
        opts.fundingAllowed ? 0 : undefined, undefined,
        opts.votingAllowed ? 2 : undefined,
        opts.expressionAllowed ? this.fakeExpressions(postCategory, 2) : undefined,
        postCategory.workflow.statuses.find(s => s.name.match(/Under review/))!.statusId,
      );
      await this.mockItem(
        config.projectId, postCategory.categoryId, user4,
        'Buttons too small',
        'In the settings page, all the buttons are too small, I always click the wrong option.',
        'Fixed in the next update',
        opts.fundingAllowed ? 4000 : undefined, opts.fundingAllowed ? 4000 : undefined,
        opts.votingAllowed ? 2 : undefined,
        opts.expressionAllowed ? this.fakeExpressions(postCategory, 2) : undefined,
        postCategory.workflow.statuses.find(s => s.name.match(/In progress/))!.statusId,
      );
      await this.mockItem(
        config.projectId, postCategory.categoryId, user4,
        'Approve all posts',
        'Whenever a user posts or comments, have a moderator approve it before making it public',
        undefined,
        opts.fundingAllowed ? 6000 : undefined, opts.fundingAllowed ? 6000 : undefined,
        opts.votingAllowed ? 22 : undefined,
        opts.expressionAllowed ? this.fakeExpressions(postCategory, 15) : undefined,
        postCategory.workflow.statuses.find(s => s.name.match(/In progress/))!.statusId,
      );
      await this.mockItem(
        config.projectId, postCategory.categoryId, user1,
        'Finance page typo',
        'You accidentally spelt the word your as you\'re on the finance page under my finances tab',
        undefined,
        opts.fundingAllowed ? 12300 : undefined, opts.fundingAllowed ? 10000 : undefined,
        opts.votingAllowed ? 1 : undefined,
        undefined,
        postCategory.workflow.statuses.find(s => s.name.match(/Completed/))!.statusId,
      );
      await this.mockItem(
        config.projectId, postCategory.categoryId, user1,
        'Upload images to comments',
        'I want to upload screenshots of issues in comments please.',
        undefined,
        opts.fundingAllowed ? 8300 : undefined, opts.fundingAllowed ? 70000 : undefined,
        opts.votingAllowed ? 2 : undefined,
        undefined,
        postCategory.workflow.statuses.find(s => s.name.match(/Completed/))!.statusId,
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
        'We have long awaited to partner with a local bakery for all of our baked goods.'
        + ' We are now announcing a long term partnership to bring baked goods for all of our customers.'
        + ' To sign up for the early access, visit our page to start receiving our beta bread.',
        undefined, undefined, undefined, undefined,
        this.fakeExpressions(changelogCategory, 1),
        undefined, undefined,
      );
      await this.mockItem(
        config.projectId, changelogCategory.categoryId, user2,
        'Introducing email integration',
        'Now you can email your customers directly to keep them updated on your delivery status.'
        + ' Visit your settings page to enable email notifications.'
        + ' Email notifications have shown to increase retention lift by 12% on average.',
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
        'If you wish to change your email, go to the settings, preferences, change email.'
        + ' After submitting, you will receive a confirmation email to ensure you own that email address.'
        + ' Once confirmed, your email has been successfully changed.',
        undefined, undefined, undefined, undefined,
        this.fakeExpressions(helpCategory, 2),
        undefined,
        [helpCategory.tagging.tags.find(s => s.name.match(/Account/))!.tagId],
      );
      await this.mockItem(
        config.projectId, helpCategory.categoryId, user1,
        'Changing your shipping address',
        'If you wish to change your shipping address, go to the settings, preferences, change address.'
        + ' After submitting, you will receive a confirmation that your shipping address has been saved.',
        undefined, undefined, undefined, undefined,
        this.fakeExpressions(helpCategory, 2),
        undefined,
        [helpCategory.tagging.tags.find(s => s.name.match(/Account Setup/))!.tagId],
      );
      await this.mockItem(
        config.projectId, helpCategory.categoryId, user1,
        'Forgot password',
        'If you\'ve forgotten your password to your account, use the Forgot Password link on the sign-in page.'
        + ' If you are unsuccessful, please send us an email at support@example.com so we can help you recover your password.'
        + ' You will be required to prove the ownership of the account by answering questions.',
        undefined, undefined, undefined, undefined,
        this.fakeExpressions(helpCategory, 1),
        undefined,
        [helpCategory.tagging.tags.find(s => s.name.match(/Account Setup/))!.tagId],
      );
      await this.mockItem(
        config.projectId, helpCategory.categoryId, user2,
        'Product has not arrived yet',
        'If you are waiting for your product and it has been less than three weeks,'
        + ' please give it a little bit more time as our shipping provider may be backlogged especially during holidays.'
        + ' If it has been more than three weeks, contact us at support@example.com for us to check your status.',
        undefined, undefined, undefined, undefined,
        this.fakeExpressions(helpCategory, 3),
        undefined,
        [helpCategory.tagging.tags.find(s => s.name.match(/Ordering and Shipping/))!.tagId],
      );
      await this.mockItem(
        config.projectId, helpCategory.categoryId, user2,
        'My credit card was denied',
        'Due to fraud prevention, we have many checks to ensure all transactions are legitimate.'
        + ' If your credit card was denied, ensure the billing address and personal information is correct.'
        + ' if you still cannot get your transaction processed, try another credit card.',
        undefined, undefined, undefined, undefined,
        this.fakeExpressions(helpCategory, 3),
        undefined,
        [helpCategory.tagging.tags.find(s => s.name.match(/Ordering and Shipping/))!.tagId],
      );
      await this.mockItem(
        config.projectId, helpCategory.categoryId, user2,
        'Product has arrived broken',
        'If your product has arrived broken, contact us at support@example.com to get the issue resolved.'
        + ' Please take pictures of your received product and attach it to the email.',
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
    const user = await this.mockUser('Matus Faro');
    return await andThen(config, user);
  }

  demoBoard(ideas: Array<{
    status: string,
    title?: string,
    titleWords?: number,
    description?: string,
    descriptionWords?: number,
    extra?: Partial<Admin.Idea>
  }>) {
    return this.demoPage((config, user) => Promise.all(ideas.map(idea => ServerMock.get().ideaCreateAdmin({
      projectId: this.projectId,
      ideaCreateAdmin: {
        authorUserId: user.userId,
        title: idea.title || capitalize(loremIpsum({
          units: 'words',
          count: idea.titleWords || Math.round(Math.random() * 10 + 3),
        })),
        description: idea.description ? textToHtml(idea.description) : (idea.descriptionWords ? textToHtml(capitalize(loremIpsum({
          units: 'words',
          count: idea.descriptionWords,
        }))) : undefined),
        categoryId: 'demoCategoryId', // From configTemplater.demoCategory
        tagIds: [],
        statusId: idea.status,
        // Fake data
        ...{ ...idea.extra },
      },
    }))));
  }

  demoFeedbackType() {
    return this.demoPage((config, user) => Promise.all([
      ServerMock.get().ideaCreateAdmin({
        projectId: this.projectId,
        ideaCreateAdmin: {
          authorUserId: user.userId,
          title: 'Allow changing the font size',
          description: textToHtml('The default font size is not ideal for every user. I prefer larger text for better reading.'),
          categoryId: config.content.categories[0].categoryId,
          tagIds: [],
        },
      }),
      ServerMock.get().ideaCreateAdmin({
        projectId: this.projectId,
        ideaCreateAdmin: {
          authorUserId: user.userId,
          title: 'View daily update summary',
          description: 'I would like to see what changed since the previous day on the home page in an easy format without having to dig it up using the search functionality.',
          categoryId: config.content.categories[0].categoryId,
          tagIds: [],
        },
      }),
      ServerMock.get().ideaCreateAdmin({
        projectId: this.projectId,
        ideaCreateAdmin: {
          authorUserId: user.userId,
          title: 'Dark theme option',
          description: textToHtml('Many apps are transitioning to dark theme, can you please add this option?'),
          categoryId: config.content.categories[0].categoryId,
          tagIds: [],
        },
      }),
      ServerMock.get().ideaCreateAdmin({
        projectId: this.projectId,
        ideaCreateAdmin: {
          authorUserId: user.userId,
          title: 'Custom theme upload',
          description: textToHtml('Branding my page with a custom made theme would increase personalization.'),
          categoryId: config.content.categories[0].categoryId,
          tagIds: [],
        },
      }),
    ]));
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

  demoPrioritization(numIdeas: 1 | 2 | 3 = 3) {
    return this.demoPage(async (config, user) => {
      await ServerMock.get().ideaCreateAdmin({
        projectId: this.projectId,
        ideaCreateAdmin: {
          authorUserId: user.userId,
          title: 'Add Dark Mode',
          description: textToHtml('To reduce eye-strain, please add a low-light option. '),
          categoryId: 'demoCategoryId', // From configTemplater.demoCategory
          tagIds: [],
          ...{ // Fake data
            ideaId: 'add-dark-mode',
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
      });
      if (numIdeas >= 2) {
        const idea2 = await ServerMock.get().ideaCreateAdmin({
          projectId: this.projectId,
          ideaCreateAdmin: {
            authorUserId: user.userId,
            title: 'Support Jira Integration',
            description: textToHtml('I would like to be able to synchronize user ideas with my Jira board'),
            categoryId: config.content.categories[0].categoryId,
            tagIds: [],
            ...{ // Fake data
              ideaId: 'support-jira-integration',
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
        });
        await ServerMock.get().ideaVoteUpdate({
          projectId: this.projectId,
          ideaId: idea2.ideaId,
          ideaVoteUpdate: {
            fundDiff: 40,
          },
        });
      }
      if (numIdeas >= 3) {
        const idea3 = await ServerMock.get().ideaCreateAdmin({
          projectId: this.projectId,
          ideaCreateAdmin: {
            authorUserId: user.userId,
            title: 'Customize order of options',
            description: textToHtml('I want to be able to re-order the options we have in the main settings page.'),
            categoryId: config.content.categories[0].categoryId,
            tagIds: [],
            ...{ // Fake data
              funded: 20,
              fundersCount: 5,
              fundGoal: 20,
              voteValue: 12,
              expressionsValue: 4,
              expressions: {
                '👍': 4,
              },
            },
          },
        });
        await ServerMock.get().ideaVoteUpdate({
          projectId: this.projectId,
          ideaId: idea3.ideaId,
          ideaVoteUpdate: {
            fundDiff: 20,
          },
        });
      }
    });
  }

  mockNotification(userMe: Admin.User, text?: string): Promise<any> {
    ServerMock.get().addNotification(
      this.projectId,
      userMe,
      text || 'Welcome to your first notification',
    );
    return Promise.resolve();
  }

  static async getOrMockAccountCreate(): Promise<Admin.AccountAdmin> {
    const account = ServerMock.get().account;
    if (account) return account;
    return ServerMock.get().accountSignupAdmin({
      accountSignupAdmin: {
        name: 'Matus Faro',
        email: SuperAdminEmail,
        password: saltHashPassword('pass'),
        basePlanId: DefaultMockUserPlanId,
      },
    });
  }

  async mockLoggedIn(bankBalance: number = 10000, isMod: boolean = false): Promise<Admin.UserMeWithBalance> {
    const email = 'john.doe@example.com';
    const password = 'password';
    var me = await ServerMock.get().userCreateAdmin({
      projectId: this.projectId,
      userCreateAdmin: {
        name: 'John Doe',
        email,
        password,
        browserPushToken: 'fake-browser-push-token',
        emailVerification: '123456',
        isMod,
        ...{
          userId: 'me',
        },
      },
    });
    await ServerMock.get().userLogin({
      projectId: this.projectId,
      userLogin: { email, password },
    });
    await ServerMock.get().userUpdateAdmin({
      projectId: this.projectId,
      userId: me.userId,
      userUpdateAdmin: {
        transactionCreate: {
          amount: bankBalance,
          summary: 'Mock amount given, spend it wisely',
        },
      },
    });
    return me;
  }

  mockItem(
    projectId: string,
    categoryId: string,
    user: Admin.UserAdmin,
    title: string,
    description: string,
    response?: string,
    funded?: number,
    fundGoal?: number,
    voteValue?: number,
    expressions?: { [key: string]: number; },
    statusId?: string,
    tagIds?: string[],
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
        description: textToHtml(description),
        response: response === undefined ? undefined : textToHtml(response),
        categoryId: categoryId,
        tagIds: tagIds || [],
        statusId: statusId,
      },
    });
  }

  mockItems(userMe?: Admin.UserMeWithBalance, ideaPerTypeCount: number = 3): Promise<any> {
    return this.getConfig()
      .then(config => {
        const promises: Promise<any>[] = [];
        config.content.categories.forEach((category: Admin.Category) => {
          if (userMe && category.categoryId.startsWith(ChangelogCategoryIdPrefix)) {
            promises.push(Promise.resolve(userMe)
              .then((user: Admin.User) =>
                this.mockDraft(category, user),
              ),
            );
          }
          [undefined, ...category.workflow.statuses].forEach((status: Admin.IdeaStatus | undefined) => {
            var n = ideaPerTypeCount;
            while (n-- > 0) {
              promises.push((userMe && n === 1 ? Promise.resolve(userMe) : this.mockUser())
                .then((user: Admin.User) =>
                  this.mockIdea(category, status, user),
                ),
              );
            }
          });
        });
        return Promise.all(promises);
      });
  }

  mockUser(name?: string, isMod?: boolean): Promise<Admin.UserAdmin> {
    return ServerMock.get().userCreateAdmin({
      projectId: this.projectId,
      userCreateAdmin: {
        name: name || capitalize(loremIpsum({
          units: 'words',
          count: 2,
        })),
        email: `${name}-${Math.ceil(Math.random() * 10000)}@example.com`,
        ...{
          created: this.mockDate(),
          isMod,
        },
      },
    });
  }

  async mockIdea(category: Admin.Category, status: Admin.IdeaStatus | undefined = undefined, user: Admin.User | undefined = undefined, extra: Partial<Admin.Idea> = {}, suppressComments: boolean = false): Promise<Admin.Idea> {
    if (user === undefined) {
      user = await this.mockUser();
    }
    var responseUser;
    if (Math.random() < 0.3) {
      responseUser = await this.mockUser();
    }
    const item = await ServerMock.get().ideaCreateAdmin({
      projectId: this.projectId,
      ideaCreateAdmin: {
        ...this.fakeMockIdeaData(category),
        authorUserId: user.userId,
        title: capitalize(loremIpsum({
          units: 'words',
          count: Math.round(Math.random() * 5 + 3),
        })),
        description: textToHtml(capitalize(loremIpsum({
          units: 'sentences',
          count: Math.round(Math.random() * 6 + 1),
        }))),
        ...(!responseUser ? {} : {
          response: textToHtml(capitalize(loremIpsum({
            units: 'words',
            count: Math.round(Math.random() * 10 + 3),
          }))),
          responseAuthorUserId: responseUser.userId,
          responseAuthorName: responseUser.name,
          responseEdited: this.mockDate(),
        }),
        categoryId: category.categoryId,
        tagIds: Math.random() < 0.3 ? [] : category.tagging.tags
          .filter(t => Math.random() < 0.3)
          .map(t => t.tagId),
        statusId: status ? status.statusId : undefined,
        ...{ created: this.mockDate() },
        ...extra,
        // ...{ linkedGitHubUrl: 'https://github.com/clearflask/clearflask/issues/1' },
      },
    });
    !suppressComments && category.support.comment && this.mockComments([user], item);
    return item;
  }

  async mockDraft(category: Admin.Category, userMe: Admin.User, extra: Partial<Admin.IdeaDraftAdmin> = {}): Promise<Admin.IdeaDraftAdmin> {
    const draft = await ServerMock.get().ideaDraftCreateAdmin({
      projectId: this.projectId,
      ideaCreateAdmin: {
        authorUserId: userMe.userId,
        title: capitalize(loremIpsum({
          units: 'words',
          count: Math.round(Math.random() * 5 + 3),
        })),
        description: textToHtml(capitalize(loremIpsum({
          units: 'sentences',
          count: Math.round(Math.random() * 6 + 1),
        }))),
        categoryId: category.categoryId,
        tagIds: [],
        ...extra,
      },
    });
    return draft;
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

  async mockFakeIdeaWithComments(ideaId: string = 'captcha-to-reduce-spam', overrides: (config: Admin.ConfigAdmin) => Partial<Admin.Idea> = c => ({})): Promise<Admin.IdeaWithVote> {
    const idea = await this.demoPage((config, user) => ServerMock.get().ideaCreateAdmin({
      projectId: this.projectId,
      ideaCreateAdmin: {
        authorUserId: user.userId,
        title: 'Add Dark Mode',
        description: textToHtml('To reduce eye-strain, please add a low-light option. '),
        response: textToHtml('Added to our backlog, thanks!'),
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
        ...overrides(config),
      },
    }));

    await this.mockDetailedComments([
      {
        content: 'Also, it would be great if the black color can be a pure black in order to save mobile battery life.',
        author: 'John',
        voteValue: 43,
        children: [
          {
            content: 'That\'s a great idea, we will work on that right away',
            author: 'Charlotte',
            authorIsMod: true,
            voteValue: 22,
            children: [
              {
                content: 'Thank you for the quick response', author: 'John', voteValue: 2, created: new Date(),
              },
            ],
          },
          {
            content: 'Even better, you can choose the shade of the color', author: 'Daisy', voteValue: 12, children: [
              {
                content: 'I don\'t think they have time to do that', author: 'John', voteValue: -5,
              },
            ],
          },
        ],
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
          users[comment.author] = await this.mockUser(comment.author, comment.authorIsMod);
        }
        user = users[comment.author];
      } else {
        user = comment.author;
      }
      const createdComment = await ServerMock.get().commentCreate({
        projectId: this.projectId,
        ideaId: item.ideaId,
        commentCreate: {
          content: comment.content ? textToHtml(comment.content) : '',
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
          content: textToHtml(this.mockMention(userMentionPool) + capitalize(loremIpsum({
            units: 'sentences',
            count: Math.round(Math.random() * 3 + 1),
          }))),
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
              content: textToHtml(this.mockMention(userMentionPool) + capitalize(loremIpsum({
                units: 'sentences',
                count: Math.round(Math.random() * 3 + 1),
              }))),
            },
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
