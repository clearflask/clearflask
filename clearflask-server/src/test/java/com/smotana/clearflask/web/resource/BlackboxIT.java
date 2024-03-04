// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.web.resource;

import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableMap;
import com.smotana.clearflask.TestUtil;
import com.smotana.clearflask.api.model.*;
import com.smotana.clearflask.billing.Billing;
import com.smotana.clearflask.store.ProjectStore.SearchEngine;
import com.smotana.clearflask.util.IdUtil;
import com.smotana.clearflask.util.ModelUtil;
import lombok.extern.slf4j.Slf4j;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.junit.runners.Parameterized;

import java.io.InputStream;
import java.util.stream.Stream;

import static com.smotana.clearflask.testutil.HtmlUtil.textToSimpleHtml;
import static org.junit.Assert.assertEquals;

@Slf4j
@RunWith(Parameterized.class)
public class BlackboxIT extends AbstractBlackboxIT {

    @Parameterized.Parameter(0)
    public SearchEngine searchEngine;

    @Parameterized.Parameters(name = "{0}")
    public static Object[][] data() {
        return new Object[][]{
                {SearchEngine.READWRITE_ELASTICSEARCH},
                {SearchEngine.READWRITE_MYSQL},
        };
    }

    @Override
    protected void configure() {
        overrideSearchEngine = searchEngine;
        super.configure();
    }

    @Test(timeout = 300_000L)
    public void test() throws Exception {
        AccountAdmin accountAdmin = accountResource.accountSignupAdmin(new AccountSignupAdmin(
                "smotana",
                "unittest@clearflask.com",
                "password",
                "flat-yearly",
                null,
                null,
                null));
        String accountId = accountStore.getAccountByEmail(accountAdmin.getEmail()).get().getAccountId();
        NewProjectResult newProjectResult = projectResource.projectCreateAdmin(
                ModelUtil.createEmptyConfig("sermyproject").getConfig());
        String projectId = newProjectResult.getProjectId();
        addUserAndDoThings(projectId, newProjectResult.getConfig().getConfig());
        accountResource.accountUpdateAdmin(AccountUpdateAdmin.builder()
                .paymentToken(AccountUpdateAdminPaymentToken.builder()
                        .type(Billing.Gateway.EXTERNAL.getPluginName())
                        .token("token")
                        .build())
                .build());
        refreshStatus(accountId);
        addActiveUser(projectId, newProjectResult.getConfig().getConfig());
        kbClockSleep(30);
        TestUtil.retry(() -> assertEquals(SubscriptionStatus.ACTIVE, accountResource.accountBillingAdmin(true).getSubscriptionStatus()));
        addActiveUser(projectId, newProjectResult.getConfig().getConfig());
        refreshStatus(accountId);
        accountResource.accountUpdateAdmin(AccountUpdateAdmin.builder()
                .cancelEndOfTerm(true)
                .build());
        refreshStatus(accountId);
        accountResource.accountUpdateAdmin(AccountUpdateAdmin.builder()
                .resume(true)
                .build());
        refreshStatus(accountId);
        dumpDynamoTable();
        accountResource.accountDeleteAdmin();
        dumpDynamoTable();
    }

    @Test(timeout = 300_000L)
    public void testVotingBloomFilters() throws Exception {
        AccountAndProject account = getTrialAccount();
        String projectId = account.getProject().getProjectId();

        UserMeWithBalance you = userResource.userCreate(projectId, UserCreate.builder()
                .name("you").build()).getUser();
        IdeaWithVote ideaYours = ideaResource.ideaCreate(projectId, IdeaCreate.builder()
                .authorUserId(you.getUserId())
                .title("Add dark mode again")
                .categoryId(account.getProject().getConfig().getConfig().getContent().getCategories().get(0).getCategoryId())
                .tagIds(ImmutableList.of())
                .build());
        CommentWithVote ideaYoursCommentYours = commentResource.commentCreate(
                projectId,
                ideaYours.getIdeaId(),
                CommentCreate.builder().content("ideaYoursCommentYours").build());

        UserMeWithBalance me = userResource.userCreate(projectId, UserCreate.builder()
                .name("me").build()).getUser();
        userResource.userUpdateAdmin(projectId, me.getUserId(), UserUpdateAdmin.builder()
                .transactionCreate(TransactionCreateAdmin.builder()
                        .amount(300L)
                        .build())
                .build());
        IdeaWithVote ideaMine = ideaResource.ideaCreate(projectId, IdeaCreate.builder()
                .authorUserId(me.getUserId())
                .title("Add dark mode")
                .categoryId(account.getProject().getConfig().getConfig().getContent().getCategories().get(0).getCategoryId())
                .tagIds(ImmutableList.of())
                .build());
        CommentWithVote ideaYoursCommentMine = commentResource.commentCreate(
                projectId,
                ideaYours.getIdeaId(),
                CommentCreate.builder().content("ideaYoursCommentMine").build());

        Stream.of(ideaMine, ideaYours).forEach(idea ->
                voteResource.ideaVoteUpdate(
                        projectId,
                        idea.getIdeaId(),
                        IdeaVoteUpdate.builder()
                                .fundDiff(17L)
                                .vote(VoteOption.UPVOTE)
                                .expressions(IdeaVoteUpdateExpressions.builder()
                                        .expression("❤")
                                        .action(IdeaVoteUpdateExpressions.ActionEnum.SET)
                                        .build())
                                .build()));
        Stream.of(ideaYoursCommentMine, ideaYoursCommentYours).forEach(comment ->
                voteResource.commentVoteUpdate(
                        projectId,
                        comment.getIdeaId(),
                        comment.getCommentId(),
                        CommentVoteUpdate.builder()
                                .vote(VoteOption.UPVOTE)
                                .build()));

        IdeaWithVote ideaMineWithVote = ideaResource.ideaGet(projectId, ideaMine.getIdeaId());
        IdeaWithVote ideaYoursWithVote = ideaResource.ideaGet(projectId, ideaYours.getIdeaId());
        IdeaVoteGetOwnResponse ideaVoteGetOwnResponse = voteResource.ideaVoteGetOwn(
                projectId,
                ImmutableList.of(ideaMine.getIdeaId(), ideaYours.getIdeaId()),
                ImmutableList.of(ideaMine.getIdeaId()));
        CommentVoteGetOwnResponse commentVoteGetOwnResponse = voteResource.commentVoteGetOwn(
                projectId,
                ImmutableList.of(ideaYoursCommentMine.getCommentId(), ideaYoursCommentYours.getCommentId()),
                ImmutableList.of(ideaYoursCommentMine.getCommentId()));

        log.debug("Idea mine vote: {}", ideaMineWithVote.getVote());
        log.debug("Idea yours vote: {}", ideaYoursWithVote.getVote());
        log.debug("Votes get own: {} {}", ideaVoteGetOwnResponse, commentVoteGetOwnResponse);

        assertEquals(
                IdeaVote.builder()
                        .expression(ImmutableList.of("❤"))
                        .fundAmount(17L)
                        .vote(VoteOption.UPVOTE)
                        .build(),
                ideaMineWithVote.getVote());
        assertEquals(
                IdeaVote.builder()
                        .expression(ImmutableList.of("❤"))
                        .fundAmount(17L)
                        .vote(VoteOption.UPVOTE)
                        .build(),
                ideaYoursWithVote.getVote());
        assertEquals(
                IdeaVoteGetOwnResponse.builder()
                        .expressionByIdeaId(ImmutableMap.of(
                                ideaMine.getIdeaId(), ImmutableList.of("❤"),
                                ideaYours.getIdeaId(), ImmutableList.of("❤")))
                        .fundAmountByIdeaId(ImmutableMap.of(
                                ideaMine.getIdeaId(), 17L,
                                ideaYours.getIdeaId(), 17L))
                        .votesByIdeaId(ImmutableMap.of(
                                ideaMine.getIdeaId(), VoteOption.UPVOTE,
                                ideaYours.getIdeaId(), VoteOption.UPVOTE))
                        .build(),
                ideaVoteGetOwnResponse);
        assertEquals(
                CommentVoteGetOwnResponse.builder()
                        .votesByCommentId(ImmutableMap.of(
                                ideaYoursCommentMine.getCommentId(), VoteOption.UPVOTE,
                                ideaYoursCommentYours.getCommentId(), VoteOption.UPVOTE))
                        .build(),
                commentVoteGetOwnResponse);
    }

    private UserMeWithBalance addUserAndDoThings(String projectId, ConfigAdmin configAdmin) {
        long newUserNumber = userNumber++;
        UserMeWithBalance user = userResource.userCreate(projectId, UserCreate.builder()
                        .name("john-" + newUserNumber)
                        .email("john-" + newUserNumber + "@example.com")
                        .build())
                .getUser();
        userResource.userUpdateAdmin(projectId, user.getUserId(), UserUpdateAdmin.builder()
                .transactionCreate(TransactionCreateAdmin.builder()
                        .amount(300L)
                        .build())
                .build());
        InputStream examplePngIn = Thread.currentThread().getContextClassLoader().getResourceAsStream("example.png");
        String imageUrl = contentResource.contentUpload(projectId, examplePngIn).getUrl();
        IdeaWithVote idea1 = ideaResource.ideaCreate(projectId, IdeaCreate.builder()
                .authorUserId(user.getUserId())
                .title("Add dark mode " + IdUtil.randomId())
                .description("<b>Hello</b> <img src=\"" + imageUrl + "\">")
                .categoryId(configAdmin.getContent().getCategories().get(0).getCategoryId())
                .tagIds(ImmutableList.of())
                .build());
        ideaResource.ideaUpdateAdmin(projectId, idea1.getIdeaId(), IdeaUpdateAdmin.builder()
                .tagIds(ImmutableList.of("non-existent-tagid-but-its-ok-here"))
                .build());
        IdeaVoteUpdateResponse idea1vote1 = voteResource.ideaVoteUpdate(projectId, idea1.getIdeaId(), IdeaVoteUpdate.builder()
                .vote(VoteOption.DOWNVOTE)
                .build());
        assertEquals(Long.valueOf(-1), idea1vote1.getIdea().getVoteValue());
        IdeaVoteUpdateResponse idea1vote2 = voteResource.ideaVoteUpdate(projectId, idea1.getIdeaId(), IdeaVoteUpdate.builder()
                .expressions(IdeaVoteUpdateExpressions.builder()
                        .action(IdeaVoteUpdateExpressions.ActionEnum.SET)
                        .expression("\uD83D\uDE00")
                        .build())
                .build());
        assertEquals(ImmutableMap.of("\uD83D\uDE00", 1L), idea1vote2.getIdea().getExpressions());
        IdeaVoteUpdateResponse idea1vote3 = voteResource.ideaVoteUpdate(projectId, idea1.getIdeaId(), IdeaVoteUpdate.builder()
                .fundDiff(100L)
                .build());
        assertEquals(Long.valueOf(100L), idea1vote3.getIdea().getFunded());
        assertEquals(Long.valueOf(1L), idea1vote3.getIdea().getFundersCount());
        CommentWithVote idea1comment1 = commentResource.commentCreate(projectId, idea1.getIdeaId(), CommentCreate.builder()
                .content(textToSimpleHtml("I like this " + IdUtil.randomId()))
                .build());
        CommentVoteUpdateResponse comment1vote1 = voteResource.commentVoteUpdate(projectId, idea1.getIdeaId(), idea1comment1.getCommentId(), CommentVoteUpdate.builder()
                .vote(VoteOption.DOWNVOTE)
                .build());
        assertEquals(Long.valueOf(-1L), comment1vote1.getComment().getVoteValue());
        return user;
    }
}