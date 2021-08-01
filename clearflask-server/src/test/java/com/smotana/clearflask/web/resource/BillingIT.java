// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
package com.smotana.clearflask.web.resource;

import com.google.common.collect.ImmutableList;
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
    public void test_trial_ends() throws Exception {
        AccountAndProject accountAndProject = getTrialAccount();
        kbClockSleepAndRefresh(15, accountAndProject);
        assertSubscriptionStatus(SubscriptionStatus.NOPAYMENTMETHOD);

        AccountBilling accountBilling = accountResource.accountBillingAdmin(false);
        log.info("Account billing #1:\n{}", accountBilling);
        assertEquals(2, accountBilling.getInvoices().getResults().size());

        String invoice1 = accountResource.invoiceHtmlGetAdmin(accountBilling.getInvoices().getResults().get(0).getInvoiceId()).getInvoiceHtml();
        log.info("Invoice #1:\n{}", invoice1);
        String invoice2 = accountResource.invoiceHtmlGetAdmin(accountBilling.getInvoices().getResults().get(1).getInvoiceId()).getInvoiceHtml();
        log.info("Invoice #2:\n{}", invoice1);
    }

    @Test(timeout = 300_000L)
    public void test_trial_deleteAccount() throws Exception {
        AccountAndProject accountAndProject = getTrialAccount();
        deleteAccount(accountAndProject);
    }

    @Test(timeout = 300_000L)
    public void test_trial_noPayment_deleteAccount() throws Exception {
        AccountAndProject accountAndProject = getTrialAccount();
        kbClockSleepAndRefresh(14, accountAndProject);
        deleteAccount(accountAndProject);
    }

    @Test(timeout = 300_000L)
    public void test_trial_upgradePlan_addPayment_active() throws Exception {
        AccountAndProject accountAndProject = getTrialAccount("growth2-monthly");
        accountAndProject = changePlan(accountAndProject, "standard2-monthly");
        accountAndProject = addPaymentMethod(accountAndProject);
        kbClockSleepAndRefresh(14, accountAndProject);
        assertSubscriptionStatus(SubscriptionStatus.ACTIVE);
    }

    @Test(timeout = 300_000L)
    public void test_trial_downgradePlan_noPayment_addPayment_active() throws Exception {
        AccountAndProject accountAndProject = getTrialAccount("standard2-monthly");
        accountAndProject = changePlan(accountAndProject, "growth2-monthly");
        kbClockSleepAndRefresh(14, accountAndProject);
        assertSubscriptionStatus(SubscriptionStatus.NOPAYMENTMETHOD);
        accountAndProject = addPaymentMethod(accountAndProject);
        assertSubscriptionStatus(SubscriptionStatus.ACTIVE);
    }

    @Test(timeout = 300_000L)
    public void test_trial_upgradeFlat() throws Exception {
        AccountAndProject accountAndProject = getTrialAccount("growth2-monthly");
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
        AccountAndProject accountAndProject = getActiveAccount("growth2-monthly");
        accountAndProject = changePlan(accountAndProject, "standard2-monthly");
        assertPlanid("standard2-monthly");
        assertSubscriptionStatus(SubscriptionStatus.ACTIVE);
    }

    @Test(timeout = 300_000L)
    public void test_active_upgradeAccount_paymentFailed() throws Exception {
        AccountAndProject accountAndProject = getActiveAccount("growth2-monthly");
        failFuturePayments();
        accountAndProject = changePlan(accountAndProject, "standard2-monthly");
        assertPlanid("standard2-monthly");
        assertSubscriptionStatus(SubscriptionStatus.ACTIVEPAYMENTRETRY);
    }

    @Test(timeout = 300_000L)
    public void test_active_downgradeAccount_waitForUpgrade() throws Exception {
        AccountAndProject accountAndProject = getActiveAccount("standard2-monthly");
        accountAndProject = changePlan(accountAndProject, "growth2-monthly");
        assertPlanid("standard2-monthly");
        assertSubscriptionStatus(SubscriptionStatus.ACTIVE);

        kbClockSleepAndRefresh(31, accountAndProject);
        assertPlanid("growth2-monthly");
        assertSubscriptionStatus(SubscriptionStatus.ACTIVE);
    }

    @Test(timeout = 300_000L)
    public void test_active_paymentFailed_deleteAccount() throws Exception {
        AccountAndProject accountAndProject = getActiveAccount();
        failFuturePayments();
        kbClockSleepAndRefresh(31, accountAndProject);
        assertSubscriptionStatus(SubscriptionStatus.ACTIVEPAYMENTRETRY);
        deleteAccount(accountAndProject);
    }

    @Test(timeout = 300_000L)
    public void test_active_paymentFailed_paymentRetrySuccess_active() throws Exception {
        AccountAndProject accountAndProject = getActiveAccount();
        failFuturePayments();
        kbClockSleepAndRefresh(31, accountAndProject);
        assertSubscriptionStatus(SubscriptionStatus.ACTIVEPAYMENTRETRY);

        resetPaymentPlugin();
        kbClockSleepAndRefresh(5, accountAndProject);
        assertSubscriptionStatus(SubscriptionStatus.ACTIVE);
    }

    @Test(timeout = 300_000L)
    public void test_active_paymentFailed_blocked_deleteAccount() throws Exception {
        AccountAndProject accountAndProject = getActiveAccount();
        failFuturePayments();
        kbClockSleepAndRefresh(31, accountAndProject);
        assertSubscriptionStatus(SubscriptionStatus.ACTIVEPAYMENTRETRY);

        kbClockSleepAndRefresh(21, accountAndProject);
        assertSubscriptionStatus(SubscriptionStatus.BLOCKED);
        deleteAccount(accountAndProject);
    }

    @Test(timeout = 300_000L)
    public void test_active_paymentFailed_updatePayment_active() throws Exception {
        AccountAndProject accountAndProject = getActiveAccount();
        failFuturePayments();
        kbClockSleepAndRefresh(31, accountAndProject);
        assertSubscriptionStatus(SubscriptionStatus.ACTIVEPAYMENTRETRY);

        resetPaymentPlugin();
        accountAndProject = addPaymentMethod(accountAndProject);
        assertSubscriptionStatus(SubscriptionStatus.ACTIVE);
    }

    @Test(timeout = 300_000L)
    public void test_active_paymentFailed_updatePayment_paymentFailed_blocked_deleteAccount() throws Exception {
        AccountAndProject accountAndProject = getActiveAccount();
        failFuturePayments();
        kbClockSleepAndRefresh(31, accountAndProject);
        assertSubscriptionStatus(SubscriptionStatus.ACTIVEPAYMENTRETRY);

        accountAndProject = addPaymentMethod(accountAndProject);
        assertSubscriptionStatus(SubscriptionStatus.ACTIVEPAYMENTRETRY);

        kbClockSleepAndRefresh(21, accountAndProject);
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

        kbClockSleepAndRefresh(31, accountAndProject);
        assertSubscriptionStatus(SubscriptionStatus.CANCELLED);
        deleteAccount(accountAndProject);
    }

    @Test(timeout = 300_000L)
    public void test_active_noRenewal_cancelled_resume_active() throws Exception {
        AccountAndProject accountAndProject = getActiveAccount();
        accountAndProject = cancelAccount(accountAndProject);
        assertSubscriptionStatus(SubscriptionStatus.ACTIVENORENEWAL);

        kbClockSleepAndRefresh(31, accountAndProject);
        assertSubscriptionStatus(SubscriptionStatus.CANCELLED);

        accountAndProject = resumeAccount(accountAndProject);
        assertSubscriptionStatus(SubscriptionStatus.ACTIVE);
    }

    @Test(timeout = 300_000L)
    public void test_active_noRenewal_cancelled_updatePayment_paymentFails_updatePayment_active_deleteAccount() throws Exception {
        AccountAndProject accountAndProject = getActiveAccount();
        accountAndProject = cancelAccount(accountAndProject);
        assertSubscriptionStatus(SubscriptionStatus.ACTIVENORENEWAL);

        kbClockSleepAndRefresh(31, accountAndProject);
        assertSubscriptionStatus(SubscriptionStatus.CANCELLED);

        failFuturePayments();
        accountAndProject = resumeAccount(accountAndProject);
        assertSubscriptionStatus(SubscriptionStatus.ACTIVEPAYMENTRETRY);

        resetPaymentPlugin();
        accountAndProject = addPaymentMethod(accountAndProject);
        assertSubscriptionStatus(SubscriptionStatus.ACTIVE);
    }

    @Test(timeout = 300_000L)
    public void test_usage() throws Exception {
        AccountAndProject accountAndProject = getTrialAccount("growth2-monthly");
        accountAndProject = addPaymentMethod(accountAndProject);

        addTrackedUsers(accountAndProject, 101);
        kbClockSleepAndRefresh(14, accountAndProject);

        addTrackedUsers(accountAndProject, 100);
        kbClockSleepAndRefresh(31, accountAndProject);

        addTrackedUsers(accountAndProject, 100);
        kbClockSleepAndRefresh(15, accountAndProject);

        addTrackedUsers(accountAndProject, 100);
        accountAndProject = cancelAccount(accountAndProject);
        kbClockSleepAndRefresh(31, accountAndProject);

        kbClockSleepAndRefresh(31, accountAndProject);

        kbClockSleepAndRefresh(31, accountAndProject);
        assertInvoices(accountAndProject, ImmutableList.of(0.0, 10.0, 10.0, 40.0, -4.84, 80.0));
    }

    @Test(timeout = 300_000L)
    public void test_usage_noPayment() throws Exception {
        AccountAndProject accountAndProject = getTrialAccount("growth2-monthly");
        addTrackedUsers(accountAndProject, 101);

        kbClockSleepAndRefresh(14, accountAndProject);

        kbClockSleepAndRefresh(21, accountAndProject);

        addTrackedUsers(accountAndProject, 200);
        kbClockSleepAndRefresh(31, accountAndProject);

        addTrackedUsers(accountAndProject, 200);
        kbClockSleepAndRefresh(31, accountAndProject);

        assertInvoices(accountAndProject, ImmutableList.of(0.0, 10.0, 0.0, 60.0));
    }

    @Test(timeout = 300_000L)
    public void test_usage_downgrade() throws Exception {
        AccountAndProject accountAndProject = getTrialAccount("standard2-monthly");
        accountAndProject = addPaymentMethod(accountAndProject);
        addTrackedUsers(accountAndProject, 1001);

        kbClockSleepAndRefresh(14, accountAndProject);

        kbClockSleepAndRefresh(31, accountAndProject);

        kbClockSleepAndRefresh(15, accountAndProject);
        changePlan(accountAndProject, "growth2-monthly");
        addTrackedUsers(accountAndProject, 1000);

        kbClockSleepAndRefresh(16, accountAndProject);

        addTrackedUsers(accountAndProject, 1000);
        kbClockSleepAndRefresh(31, accountAndProject);

        addTrackedUsers(accountAndProject, 1000);
        kbClockSleepAndRefresh(31, accountAndProject);
        assertInvoices(accountAndProject, ImmutableList.of(0.0, 200.0, 200.0, 100.0, -72.58, 100.0, 50.0, 300.0, 50.0, 450.0, 50.0, 600.0));
    }

    @Test(timeout = 300_000L)
    public void test_usage_upgrade() throws Exception {
        AccountAndProject accountAndProject = getTrialAccount("growth2-monthly");
        accountAndProject = addPaymentMethod(accountAndProject);
        addTrackedUsers(accountAndProject, 1001);

        kbClockSleepAndRefresh(14, accountAndProject);

        kbClockSleepAndRefresh(31, accountAndProject);

        kbClockSleepAndRefresh(15, accountAndProject);
        changePlan(accountAndProject, "standard2-monthly");
        addTrackedUsers(accountAndProject, 1000);

        kbClockSleepAndRefresh(16, accountAndProject);

        addTrackedUsers(accountAndProject, 1000);
        kbClockSleepAndRefresh(31, accountAndProject);

        addTrackedUsers(accountAndProject, 1000);
        kbClockSleepAndRefresh(31, accountAndProject);
        assertInvoices(accountAndProject, ImmutableList.of(0.0, 10.0, 10.0, 200.0, 43.55, 200.0, 100.0, 800.0, 100.0, 1300.0, 100.0, 1800.0));
    }

    @Test(timeout = 300_000L)
    public void test_usage_upgradeFlat() throws Exception {
        AccountAndProject accountAndProject = getTrialAccount("growth2-monthly");
        accountAndProject = addPaymentMethod(accountAndProject);

        addTrackedUsers(accountAndProject, 101);
        kbClockSleepAndRefresh(31, accountAndProject);
        addTrackedUsers(accountAndProject, 200);
        changePlanToFlat(accountAndProject, 1500L);
        addTrackedUsers(accountAndProject, 300);
        kbClockSleepAndRefresh(31, accountAndProject);

        assertInvoices(accountAndProject, ImmutableList.of(0.0, 10.0, 1425.81, 60.0));
    }
}