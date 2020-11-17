package com.smotana.clearflask.web.resource;

import com.smotana.clearflask.TestUtil;
import com.smotana.clearflask.api.model.AccountAdmin;
import com.smotana.clearflask.api.model.AccountSignupAdmin;
import com.smotana.clearflask.api.model.AccountUpdateAdmin;
import com.smotana.clearflask.api.model.AccountUpdateAdminPaymentToken;
import com.smotana.clearflask.api.model.NewProjectResult;
import com.smotana.clearflask.api.model.SubscriptionStatus;
import com.smotana.clearflask.api.model.UserMeWithBalance;
import com.smotana.clearflask.billing.Billing;
import com.smotana.clearflask.billing.PlanStore;
import com.smotana.clearflask.util.ModelUtil;
import lombok.extern.slf4j.Slf4j;
import org.junit.Test;

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
        addActiveUser(projectId, newProjectResult.getConfig().getConfig());
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
        TestUtil.retry(() -> assertEquals(SubscriptionStatus.ACTIVE, accountResource.accountBillingAdmin().getSubscriptionStatus()));
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
}