package com.smotana.clearflask.web.resource;

import com.smotana.clearflask.api.model.AccountBilling;
import com.smotana.clearflask.api.model.SubscriptionStatus;
import lombok.extern.slf4j.Slf4j;
import org.junit.Ignore;
import org.junit.Test;

import static org.junit.Assert.assertEquals;

/**
 * Tests take a long time, ignore until a change happens.
 */
@Ignore
@Slf4j
public class BillingIT extends AbstractBlackboxIT {

    @Test(timeout = 300_000L)
    public void test_trial_reachLimit() throws Exception {
        AccountAndProject accountAndProject = getTrialAccount();
        accountAndProject = reachTrialLimit(accountAndProject);
        assertSubscriptionStatus(SubscriptionStatus.NOPAYMENTMETHOD);

        AccountBilling accountBilling = accountResource.accountBillingAdmin(false);
        log.info("Account billing #1:\n{}", accountBilling);
        assertEquals(2, accountBilling.getInvoices().getResults().size());

        String invoice1 = accountResource.invoiceHtmlGetAdmin(accountBilling.getInvoices().getResults().get(0).getInvoiceId()).getInvoiceHtml();
        log.info("Invoice #1:\n{}", invoice1);
        String invoice2 = accountResource.invoiceHtmlGetAdmin(accountBilling.getInvoices().getResults().get(1).getInvoiceId()).getInvoiceHtml();
        log.info("Invoice #2:\n{}", invoice1);

        // TODO assert usage is done correctly here
    }

    @Test(timeout = 300_000L)
    public void test_trial_deleteAccount() throws Exception {
        AccountAndProject accountAndProject = getTrialAccount();
        deleteAccount(accountAndProject);
    }

    @Test(timeout = 300_000L)
    public void test_trial_noPayment_deleteAccount() throws Exception {
        AccountAndProject accountAndProject = getTrialAccount();
        accountAndProject = endTrial(accountAndProject);
        deleteAccount(accountAndProject);
    }

    @Test(timeout = 300_000L)
    public void test_trial_upgradePlan_addPayment_active() throws Exception {
        AccountAndProject accountAndProject = getTrialAccount("growth-monthly");
        accountAndProject = changePlan(accountAndProject, "standard-monthly");
        accountAndProject = addPaymentMethod(accountAndProject);
        accountAndProject = endTrial(accountAndProject);
        assertSubscriptionStatus(SubscriptionStatus.ACTIVE);
    }

    @Test(timeout = 300_000L)
    public void test_trial_downgradePlan_noPayment_addPayment_active() throws Exception {
        AccountAndProject accountAndProject = getTrialAccount("standard-monthly");
        accountAndProject = changePlan(accountAndProject, "growth-monthly");
        accountAndProject = endTrial(accountAndProject);
        assertSubscriptionStatus(SubscriptionStatus.NOPAYMENTMETHOD);
        accountAndProject = addPaymentMethod(accountAndProject);
        assertSubscriptionStatus(SubscriptionStatus.ACTIVE);
    }

    @Test(timeout = 300_000L)
    public void test_trial_upgradeFlat() throws Exception {
        AccountAndProject accountAndProject = getTrialAccount("growth-monthly");
        accountAndProject = changePlanToFlat(accountAndProject, 2000L);
        accountAndProject = addPaymentMethod(accountAndProject);
        assertSubscriptionStatus(SubscriptionStatus.ACTIVE);
        accountResource.accountBillingAdmin(false);
    }

    @Test(timeout = 300_000L)
    public void test_active_deleteAccount() throws Exception {
        AccountAndProject accountAndProject = getActiveAccount();
        assertSubscriptionStatus(SubscriptionStatus.ACTIVE);
        deleteAccount(accountAndProject);
    }

    @Test(timeout = 300_000L)
    public void test_active_upgradeAccount() throws Exception {
        AccountAndProject accountAndProject = getActiveAccount("growth-monthly");
        accountAndProject = changePlan(accountAndProject, "standard-monthly");
        assertPlanid("standard-monthly");
        assertSubscriptionStatus(SubscriptionStatus.ACTIVE);
    }

    @Test(timeout = 300_000L)
    public void test_active_upgradeAccount_paymentFailed() throws Exception {
        AccountAndProject accountAndProject = getActiveAccount("growth-monthly");
        failFuturePayments();
        accountAndProject = changePlan(accountAndProject, "standard-monthly");
        assertPlanid("standard-monthly");
        assertSubscriptionStatus(SubscriptionStatus.ACTIVEPAYMENTRETRY);
    }

    @Test(timeout = 300_000L)
    public void test_active_downgradeAccount_waitForUpgrade() throws Exception {
        AccountAndProject accountAndProject = getActiveAccount("standard-monthly");
        accountAndProject = changePlan(accountAndProject, "growth-monthly");
        assertPlanid("standard-monthly");
        assertSubscriptionStatus(SubscriptionStatus.ACTIVE);

        kbClockSleep(31);
        assertPlanid("growth-monthly");
        assertSubscriptionStatus(SubscriptionStatus.ACTIVE);
    }

    @Test(timeout = 300_000L)
    public void test_active_paymentFailed_deleteAccount() throws Exception {
        AccountAndProject accountAndProject = getActiveAccount();
        failFuturePayments();
        kbClockSleep(31);
        assertSubscriptionStatus(SubscriptionStatus.ACTIVEPAYMENTRETRY);
        deleteAccount(accountAndProject);
    }

    @Test(timeout = 300_000L)
    public void test_active_paymentFailed_paymentRetrySuccess_active() throws Exception {
        AccountAndProject accountAndProject = getActiveAccount();
        failFuturePayments();
        kbClockSleep(31);
        assertSubscriptionStatus(SubscriptionStatus.ACTIVEPAYMENTRETRY);

        resetPaymentPlugin();
        kbClockSleep(5);
        assertSubscriptionStatus(SubscriptionStatus.ACTIVE);
    }

    @Test(timeout = 300_000L)
    public void test_active_paymentFailed_blocked_deleteAccount() throws Exception {
        AccountAndProject accountAndProject = getActiveAccount();
        failFuturePayments();
        kbClockSleep(31);
        assertSubscriptionStatus(SubscriptionStatus.ACTIVEPAYMENTRETRY);

        kbClockSleep(21);
        assertSubscriptionStatus(SubscriptionStatus.BLOCKED);
        deleteAccount(accountAndProject);
    }

    @Test(timeout = 300_000L)
    public void test_active_paymentFailed_updatePayment_active() throws Exception {
        AccountAndProject accountAndProject = getActiveAccount();
        failFuturePayments();
        kbClockSleep(31);
        assertSubscriptionStatus(SubscriptionStatus.ACTIVEPAYMENTRETRY);

        resetPaymentPlugin();
        accountAndProject = addPaymentMethod(accountAndProject);
        assertSubscriptionStatus(SubscriptionStatus.ACTIVE);
    }

    @Test(timeout = 300_000L)
    public void test_active_paymentFailed_updatePayment_paymentFailed_blocked_deleteAccount() throws Exception {
        AccountAndProject accountAndProject = getActiveAccount();
        failFuturePayments();
        kbClockSleep(31);
        assertSubscriptionStatus(SubscriptionStatus.ACTIVEPAYMENTRETRY);

        accountAndProject = addPaymentMethod(accountAndProject);
        assertSubscriptionStatus(SubscriptionStatus.ACTIVEPAYMENTRETRY);

        kbClockSleep(21);
        assertSubscriptionStatus(SubscriptionStatus.BLOCKED);
        deleteAccount(accountAndProject);
    }

    @Test(timeout = 300_000L)
    public void test_active_noRenewal_resume_active() throws Exception {
        AccountAndProject accountAndProject = getActiveAccount();
        accountAndProject = cancelAccount(accountAndProject);
        assertSubscriptionStatus(SubscriptionStatus.ACTIVENORENEWAL);

        accountAndProject = resumeAccount(accountAndProject);
        assertSubscriptionStatus(SubscriptionStatus.ACTIVE);
    }

    @Test(timeout = 300_000L)
    public void test_active_noRenewal_updatePayment_active() throws Exception {
        AccountAndProject accountAndProject = getActiveAccount();
        accountAndProject = cancelAccount(accountAndProject);
        assertSubscriptionStatus(SubscriptionStatus.ACTIVENORENEWAL);

        accountAndProject = addPaymentMethod(accountAndProject);
        assertSubscriptionStatus(SubscriptionStatus.ACTIVE);
    }

    @Test(timeout = 300_000L)
    public void test_active_noRenewal_cancelled_deleteAccount() throws Exception {
        AccountAndProject accountAndProject = getActiveAccount();
        accountAndProject = cancelAccount(accountAndProject);
        assertSubscriptionStatus(SubscriptionStatus.ACTIVENORENEWAL);

        kbClockSleep(31);
        assertSubscriptionStatus(SubscriptionStatus.CANCELLED);
        deleteAccount(accountAndProject);
    }

    @Test(timeout = 300_000L)
    public void test_active_noRenewal_cancelled_resume_active() throws Exception {
        AccountAndProject accountAndProject = getActiveAccount();
        accountAndProject = cancelAccount(accountAndProject);
        assertSubscriptionStatus(SubscriptionStatus.ACTIVENORENEWAL);

        kbClockSleep(31);
        assertSubscriptionStatus(SubscriptionStatus.CANCELLED);

        accountAndProject = resumeAccount(accountAndProject);
        assertSubscriptionStatus(SubscriptionStatus.ACTIVE);
    }

    @Test(timeout = 300_000L)
    public void test_active_noRenewal_cancelled_updatePayment_paymentFails_updatePayment_active_deleteAccount() throws Exception {
        AccountAndProject accountAndProject = getActiveAccount();
        accountAndProject = cancelAccount(accountAndProject);
        assertSubscriptionStatus(SubscriptionStatus.ACTIVENORENEWAL);

        kbClockSleep(31);
        assertSubscriptionStatus(SubscriptionStatus.CANCELLED);

        failFuturePayments();
        accountAndProject = resumeAccount(accountAndProject);
        assertSubscriptionStatus(SubscriptionStatus.ACTIVEPAYMENTRETRY);

        resetPaymentPlugin();
        accountAndProject = addPaymentMethod(accountAndProject);
        assertSubscriptionStatus(SubscriptionStatus.ACTIVE);
    }
}