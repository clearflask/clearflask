package com.smotana.clearflask.web.resource;

import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableMap;
import com.smotana.clearflask.TestUtil;
import com.smotana.clearflask.api.model.AccountAdmin;
import com.smotana.clearflask.api.model.AccountSignupAdmin;
import com.smotana.clearflask.api.model.AccountUpdateAdmin;
import com.smotana.clearflask.api.model.AccountUpdateAdminPaymentToken;
import com.smotana.clearflask.api.model.CommentCreate;
import com.smotana.clearflask.api.model.CommentVoteUpdate;
import com.smotana.clearflask.api.model.CommentVoteUpdateResponse;
import com.smotana.clearflask.api.model.CommentWithVote;
import com.smotana.clearflask.api.model.ConfigAdmin;
import com.smotana.clearflask.api.model.IdeaCreate;
import com.smotana.clearflask.api.model.IdeaVoteUpdate;
import com.smotana.clearflask.api.model.IdeaVoteUpdateExpressions;
import com.smotana.clearflask.api.model.IdeaVoteUpdateResponse;
import com.smotana.clearflask.api.model.IdeaWithVote;
import com.smotana.clearflask.api.model.NewProjectResult;
import com.smotana.clearflask.api.model.SubscriptionStatus;
import com.smotana.clearflask.api.model.TransactionCreateAdmin;
import com.smotana.clearflask.api.model.UserCreate;
import com.smotana.clearflask.api.model.UserMeWithBalance;
import com.smotana.clearflask.api.model.UserUpdateAdmin;
import com.smotana.clearflask.api.model.VoteOption;
import com.smotana.clearflask.billing.Billing;
import com.smotana.clearflask.billing.PlanStore;
import com.smotana.clearflask.util.IdUtil;
import com.smotana.clearflask.util.ModelUtil;
import lombok.extern.slf4j.Slf4j;
import org.junit.Test;

import static com.smotana.clearflask.testutil.DraftjsUtil.textToMockDraftjs;
import static org.junit.Assert.assertEquals;

@Slf4j
public class BlackboxIT extends AbstractBlackboxIT {

    @Test(timeout = 300_000L)
    public void test() throws Exception {
        AccountAdmin accountAdmin = accountResource.accountSignupAdmin(new AccountSignupAdmin(
                "smotana",
                "unittest@clearflask.com",
                "password",
                "growth-monthly"));
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
        for (int x = 0; x < PlanStore.STOP_TRIAL_AFTER_ACTIVE_USERS_REACHES; x++) {
            UserMeWithBalance userAdded = addActiveUser(projectId, newProjectResult.getConfig().getConfig());
            log.info("Added user {}", userAdded.getName());
        }
        // Need to wait until killBilling has processed usage recording
        TestUtil.retry(() -> assertEquals(SubscriptionStatus.ACTIVE, accountResource.accountBillingAdmin(true).getSubscriptionStatus()));
        refreshStatus(accountId);
        accountResource.accountUpdateAdmin(AccountUpdateAdmin.builder()
                .cancelEndOfTerm(true)
                .build());
        refreshStatus(accountId);
        accountResource.accountUpdateAdmin(AccountUpdateAdmin.builder()
                .resume(true)
                .build());
        refreshStatus(accountId);
        accountResource.accountUpdateAdmin(AccountUpdateAdmin.builder()
                .planid("standard-monthly")
                .build());
        dumpDynamoTable();
        accountResource.accountDeleteAdmin();
        dumpDynamoTable();
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
        IdeaWithVote idea1 = ideaResource.ideaCreate(projectId, IdeaCreate.builder()
                .authorUserId(user.getUserId())
                .title("Add dark mode " + IdUtil.randomId())
                .categoryId(configAdmin.getContent().getCategories().get(0).getCategoryId())
                .tagIds(ImmutableList.of())
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
                .content(textToMockDraftjs("I like this " + IdUtil.randomId()))
                .build());
        CommentVoteUpdateResponse comment1vote1 = voteResource.commentVoteUpdate(projectId, idea1.getIdeaId(), idea1comment1.getCommentId(), CommentVoteUpdate.builder()
                .vote(VoteOption.DOWNVOTE)
                .build());
        assertEquals(Long.valueOf(-1L), comment1vote1.getComment().getVoteValue());
        return user;
    }
}