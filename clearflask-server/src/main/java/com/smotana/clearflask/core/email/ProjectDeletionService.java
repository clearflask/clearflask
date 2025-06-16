package com.smotana.clearflask.core.email;

import com.google.common.collect.ImmutableList;
import com.google.common.util.concurrent.ListeningScheduledExecutorService;
import com.google.common.util.concurrent.MoreExecutors;
import com.google.common.util.concurrent.ThreadFactoryBuilder;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.google.inject.multibindings.Multibinder;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.smotana.clearflask.api.model.AccountSearchSuperAdmin;
import com.smotana.clearflask.api.model.SubscriptionStatus;
import com.smotana.clearflask.billing.Billing;
import com.smotana.clearflask.core.ManagedService;
import com.smotana.clearflask.core.push.NotificationService;
import com.smotana.clearflask.store.AccountStore;
import com.smotana.clearflask.store.AccountStore.Account;
import com.smotana.clearflask.store.AccountStore.SearchAccountsResponse;
import com.smotana.clearflask.util.Extern;
import com.smotana.clearflask.web.Application;
import com.smotana.clearflask.web.resource.ProjectResource;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;

import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.temporal.ChronoUnit;
import java.util.Optional;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static com.smotana.clearflask.billing.KillBillSync.CANCEL_AFTER_DURATION_IN_DAYS;

@Slf4j
@Singleton
public class ProjectDeletionService extends ManagedService {

    public interface Config {

        @DefaultValue("true")
        boolean enabled();

        @DefaultValue("false")
        boolean emailReminderEnabled();

        @DefaultValue("false")
        boolean deletionEnabled();

        /**
         * Will try to send emails on Monday at this time
         */
        @DefaultValue("9")
        int sendAtTime();

        /**
         * Will add jitter to the sendAtTime
         */
        @DefaultValue("300")
        int jitterSeconds();

        @DefaultValue("30")
        int reminderDaysBeforeDeletion();
    }

    @Inject
    private Config config;
    @Inject
    private Application.Config configApp;
    @Inject
    private AccountStore accountStore;
    @Inject
    private NotificationService notificationService;
    @Inject
    private Billing billing;
    @Inject
    private ProjectResource projectResource;

    private ListeningScheduledExecutorService executor;

    @Override
    protected void serviceStart() throws Exception {
        executor = MoreExecutors.listeningDecorator(Executors.newSingleThreadScheduledExecutor(new ThreadFactoryBuilder()
                .setNameFormat("ProjectDeletionReminderService-worker-%d").build()));
        Duration nextRuntime = WeeklyDigestService.getNextRuntime(now(), config.sendAtTime(), config.jitterSeconds());
        log.info("ProjectDeletionReminderService next runtime {}", nextRuntime);
        executor.scheduleAtFixedRate(this::processAll, nextRuntime, Duration.ofDays(1));
    }

    @Override
    protected void serviceStop() throws Exception {
        executor.shutdownNow();
        executor.awaitTermination(30, TimeUnit.SECONDS);
    }

    @Extern
    public void processAll() {
        synchronized (this) {
            if (!config.enabled()) {
                return;
            }
            log.info("Starting project deletion task");

            ImmutableList.of(
                    AccountSearchSuperAdmin.builder()
                            // Accounts after trial end become ACTIVE, but they are really NOPAYMENTMETHOD
                            // When you check them, billing reconcilliation will mark them as NOPAYMENTMETHOD
                            // so we need to include them here.
                            .filterStatus(ImmutableList.of(SubscriptionStatus.ACTIVE))
                            .filterCreatedStart(Instant.now().minus(30, ChronoUnit.DAYS))
                            .filterCreatedEnd(Instant.now().minus(5, ChronoUnit.DAYS))
                            .build(),
                    AccountSearchSuperAdmin.builder()
                            .filterStatus(ImmutableList.of(
                                    SubscriptionStatus.NOPAYMENTMETHOD,
                                    SubscriptionStatus.BLOCKED))
                            .build()
            ).forEach(accountSearchSuperAdmin -> {
                // Iterate all accounts
                Optional<String> cursorOpt = Optional.empty();

                do {
                    SearchAccountsResponse searchAccountsResponse = accountStore.searchAccounts(
                            accountSearchSuperAdmin,
                            true,
                            cursorOpt,
                            Optional.empty());
                    cursorOpt = searchAccountsResponse.getCursorOpt();
                    for (Account account : searchAccountsResponse.getAccounts()) {
                        // Process each account individually
                        try {
                            processAccount(account);
                        } catch (Exception ex) {
                            log.warn("Project deletion: Failed to process account {} {}",
                                    account.getEmail(), account.getAccountId(), ex);
                        }
                    }
                } while (cursorOpt.isPresent());
            });
        }
    }

    @SneakyThrows
    private void processAccount(Account account) {
        if (account.getProjectIds().isEmpty()) {
            // TODO switch to debug
            log.info("Project deletion: Account {} has no projects, skipping", account.getEmail());
            return;
        }

        // Check if account is ACTIVE, but really should be NOPAYMENTMETHOD
        Instant now = Instant.now();
        SubscriptionStatus status = account.getStatus();
        if (SubscriptionStatus.ACTIVE.equals(status)) {
            status = billing.updateAndGetEntitlementStatus(
                    status,
                    billing.getAccount(account.getAccountId()),
                    billing.getSubscription(account.getAccountId()),
                    "project deletion check");
        }

        Instant deletionEligibility;
        switch (status) {
            case ACTIVE:
                // TODO switch to debug
                log.info("Project deletion: Account {} still active status, skipping", account.getEmail());
                return;
            case NOPAYMENTMETHOD:
                // Although this is decided by the KillBilling overdue system, we just assume deletion can occur
                // after number of days after NOPAYMENTMETHOD status.
                deletionEligibility = now.plus(CANCEL_AFTER_DURATION_IN_DAYS, ChronoUnit.DAYS);
                break;
            case BLOCKED:
                deletionEligibility = now;
                break;
            default:
                log.warn("Project deletion: unexpected status {}", status);
                return;
        }

        // If account is not eligible for email reminder yet, skip
        if (deletionEligibility.isAfter(now.plus(config.reminderDaysBeforeDeletion(), ChronoUnit.DAYS))) {
            // TODO switch to debug
            log.info("Project deletion: account is not eligible for deletion nor deletion reminder yet; account {} status {} created {} deletionEligibility {}",
                    account.getEmail(), status, account.getCreated(), deletionEligibility);
            return;
        }

        // Send email reminder if reminder was never sent or was sent a long time ago (2 x reminderDaysBeforeDeletion)
        if (account.getProjectDeletionReminderSent() == null
                || account.getProjectDeletionReminderSent().isBefore(deletionEligibility
                .minus(config.reminderDaysBeforeDeletion() + config.reminderDaysBeforeDeletion(), ChronoUnit.DAYS))) {

            if (!config.emailReminderEnabled()) {
                log.warn("ACTION REQUIRED: Account eligible for receiving reminder of imminent project deletion, disabled by config, verify logic and re-enable; account {} status {} created {} deletionEligibility {}",
                        account.getEmail(), status, account.getCreated(), deletionEligibility);
                return;
            }

            log.info("Project deletion: Sending reminder of imminent project deletion for account {} status {} created {} deletionEligibility {} previous reminder sent {}",
                    account.getEmail(), status, account.getCreated(), deletionEligibility, Optional.ofNullable(account.getProjectDeletionReminderSent()));
            notificationService.onProjectDeletionImminent(account);
            accountStore.setProjectDeletionReminderSent(account.getAccountId());
            return;
        }

        // Now make sure after a reminder is sent, we wait at least reminderDaysBeforeDeletion
        if (account.getProjectDeletionReminderSent().isAfter(now.minus(config.reminderDaysBeforeDeletion(), ChronoUnit.DAYS))) {
            // TODO switch to debug
            log.info("Project deletion: Account {} sent deletion reminder, but need to wait for some time after reminder; status {} created {} deletionEligibility {} reminderSent {}",
                    account.getEmail(), status, account.getCreated(), deletionEligibility, account.getProjectDeletionReminderSent());
            return;
        }

        // At this point, email reminder was sent and user knows deletion is imminent
        // check if deletion is eligible now
        if (deletionEligibility.isAfter(now)) {
            // TODO switch to debug
            log.info("Project deletion: Account already sent deletion reminder, but not yet eligible for deletion, waiting; account {} status {} created {} deletionEligibility {}",
                    account.getEmail(), status, account.getCreated(), deletionEligibility);
            return;
        }

        // One last check, deletion can only occur after account is blocked
        if (status != SubscriptionStatus.BLOCKED) {
            // TODO switch to debug
            log.info("Project deletion: Account {} already sent deletion reminder, but not yet in blocked status, found {} status",
                    account.getEmail(), status);
            return;
        }

        // Delete all projects to free up resources
        log.info("Project deletion: Account {} eligible for deletion", account.getEmail());
        account.getProjectIds().forEach(projectId -> {
            if (config.deletionEnabled()) {
                log.info("Project deletion: Account {} eligible for project deletion, deleting project {}",
                        account.getEmail(), projectId);
                projectResource.projectDeleteAdmin(account, projectId);
            } else {
                log.warn("ACTION REQUIRED: Account {} eligible for project deletion, deletion disabled by config, not deleting project {}",
                        account.getEmail(), projectId);
            }
        });
    }

    private ZonedDateTime now() {
        return ZonedDateTime.now(ZoneId.of(configApp.zoneId()));
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(ProjectDeletionService.class).asEagerSingleton();
                Multibinder.newSetBinder(binder(), ManagedService.class).addBinding().to(ProjectDeletionService.class).asEagerSingleton();
                install(ConfigSystem.configModule(Config.class));
            }
        };
    }
}
