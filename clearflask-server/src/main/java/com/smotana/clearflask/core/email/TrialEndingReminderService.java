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
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.joda.time.DateTimeZone;
import org.killbill.billing.catalog.api.PhaseType;
import org.killbill.billing.client.model.gen.EventSubscription;
import org.killbill.billing.client.model.gen.Subscription;
import org.killbill.billing.entitlement.api.SubscriptionEventType;

import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.temporal.ChronoUnit;
import java.util.Optional;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

@Slf4j
@Singleton
public class TrialEndingReminderService extends ManagedService {

    public interface Config {

        @DefaultValue("true")
        boolean enabled();

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

        /**
         * Days before trial ends to send reminder
         */
        @DefaultValue("5")
        int sendDaysBeforeEnd();
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

    private ListeningScheduledExecutorService executor;

    @Override
    protected void serviceStart() throws Exception {
        executor = MoreExecutors.listeningDecorator(Executors.newSingleThreadScheduledExecutor(new ThreadFactoryBuilder()
                .setNameFormat("TrialEndingReminderService-worker-%d").build()));
        Duration nextRuntime = WeeklyDigestService.getNextRuntime(now(), config.sendAtTime(), config.jitterSeconds());
        log.info("TrialEndingReminderService next runtime {}", nextRuntime);
        executor.scheduleAtFixedRate(this::processAll, nextRuntime, Duration.ofDays(1));
    }

    @Override
    protected void serviceStop() throws Exception {
        executor.shutdownNow();
        executor.awaitTermination(30, TimeUnit.SECONDS);
    }

    @Extern
    private void processAll() {
        synchronized (this) {
            if (!config.enabled()) {
                return;
            }
            log.info("Starting trial ending reminder");

            // Iterate all accounts
            Optional<String> cursorOpt = Optional.empty();
            do {
                SearchAccountsResponse searchAccountsResponse = accountStore.searchAccounts(AccountSearchSuperAdmin.builder()
                        .filterStatus(ImmutableList.of(SubscriptionStatus.ACTIVETRIAL))
                        .build(), true, cursorOpt, Optional.empty());
                cursorOpt = searchAccountsResponse.getCursorOpt();
                for (Account account : searchAccountsResponse.getAccounts()) {
                    // Process each account individually
                    try {
                        processAccount(account);
                    } catch (Exception ex) {
                        log.warn("Trial Ending Reminder: Failed to process account {} {}",
                                account.getEmail(), account.getAccountId(), ex);
                    }
                }
            } while (cursorOpt.isPresent());
        }
    }

    @SneakyThrows
    private void processAccount(Account account) {
        if (!SubscriptionStatus.ACTIVETRIAL.equals(account.getStatus())) {
            return;
        }
        if (Boolean.TRUE.equals(account.getTrialEndingReminderSent())) {
            return;
        }

        // Sanity check, some old accounts have subscription already blocked but account status is not updated
        Subscription subscription = billing.getSubscription(account.getAccountId());
        if (subscription.getPhaseType() != PhaseType.TRIAL) {
            SubscriptionStatus newStatus = billing.updateAndGetEntitlementStatus(
                    account.getStatus(),
                    billing.getAccount(account.getAccountId()),
                    billing.getSubscription(account.getAccountId()),
                    "project deletion check");
            if (!SubscriptionStatus.ACTIVETRIAL.equals(account.getStatus())) {
                log.info("Trial Ending Reminder: Account {} was in {} status not matching subscription status {}, but after entitlement refresh is now {} status, skipping",
                        account.getAccountId(), account.getStatus(), subscription.getPhaseType(), newStatus);
            } else {
                log.warn("Trial Ending Reminder: Account {} indicates {} but subscription in {}", account.getAccountId(), account.getStatus(), subscription.getPhaseType());
            }
            return;
        }

        org.joda.time.LocalDate trialEndLocalDate = subscription.getEvents()
                .stream()
                .filter(e -> e.getPhase() != null && e.getPhase().contains("evergreen")
                        && e.getEventType() == SubscriptionEventType.PHASE)
                .map(EventSubscription::getEffectiveDate)
                .findFirst()
                // Fallback assuming all plans have 14 day trial
                .orElseGet(() -> Optional.ofNullable(subscription.getChargedThroughDate())
                        .orElseGet(subscription::getStartDate)
                        .plusDays(14));
        Instant trialEnd = Instant.ofEpochMilli(trialEndLocalDate
                .toDateTimeAtStartOfDay(DateTimeZone.UTC)
                .toInstant()
                .getMillis());

        int sendDaysBeforeEnd = config.sendDaysBeforeEnd();
        if (Instant.now().plus(sendDaysBeforeEnd, ChronoUnit.DAYS).isBefore(trialEnd)) {
            return;
        }

        account = accountStore.setTrialReminderSent(account.getAccountId());
        notificationService.onTrialEnding(account, trialEnd);
    }

    private ZonedDateTime now() {
        return ZonedDateTime.now(ZoneId.of(configApp.zoneId()));
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(TrialEndingReminderService.class).asEagerSingleton();
                Multibinder.newSetBinder(binder(), ManagedService.class).addBinding().to(TrialEndingReminderService.class).asEagerSingleton();
                install(ConfigSystem.configModule(Config.class));
            }
        };
    }
}
