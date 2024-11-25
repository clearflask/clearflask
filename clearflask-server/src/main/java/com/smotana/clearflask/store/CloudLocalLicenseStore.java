package com.smotana.clearflask.store;

import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.smotana.clearflask.billing.Billing;
import com.smotana.clearflask.billing.KillBillPlanStore;
import lombok.extern.slf4j.Slf4j;
import org.killbill.billing.client.model.gen.Account;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Optional;

@Slf4j
@Singleton
public class CloudLocalLicenseStore implements LocalLicenseStore {

    @Inject
    AccountStore accountStore;
    @Inject
    Billing billing;

    @Override
    public boolean validateLicenseLocally(String license, String clientIp, Optional<Account> accountKbOpt) {
        String accountId = getAccountId(license);
        Optional<AccountStore.Account> accountOpt = accountStore.getAccount(accountId, true);
        if (accountOpt.isEmpty()) {
            log.info("License Check: account {} not found, ip {}", accountId, clientIp);
            return false;
        }
        AccountStore.Account account = accountOpt.get();

        if (!KillBillPlanStore.SELFHOST_SERVICE_PLANS.contains(account.getPlanid())) {
            log.info("License Check: account {} with email {} found but not a selfhost service plan {}, ip {}",
                    accountId, account.getEmail(), account.getPlanid(), clientIp);
            return false;
        }

        switch (account.getStatus()) {
            case ACTIVENORENEWAL:
            case ACTIVETRIAL:
            case ACTIVE:
                break;
            default:
                log.info("License Check: account {} with email {} not in good billing status {}, ip {}",
                        accountId, account.getEmail(), account.getStatus(), clientIp);
                return false;
        }

        // If account is recently created, entitlement will be ACTIVE even though first bill has
        // not been paid. Wait until there is no outstanding balance.
        if (account.getCreated().isAfter(Instant.now().minus(3, ChronoUnit.DAYS))) {
            Account accountKb = accountKbOpt.orElseGet(() -> billing.getAccount(accountId));
            boolean hasOutstandingBalance = accountKb.getAccountBalance() != null
                    && accountKb.getAccountBalance().compareTo(BigDecimal.ZERO) > 0;
            if (hasOutstandingBalance) {
                log.info("License Check: account {} with email {} is new and has outstanding balance of {}, ip {}",
                        accountId, account.getEmail(), accountKb.getAccountBalance(), clientIp);
                return false;
            }
        }

        log.info("License Check: account {} with email {} allowing with status {}, ip {}",
                accountId, account.getEmail(), account.getStatus(), clientIp);
        return true;
    }


    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(LocalLicenseStore.class).to(CloudLocalLicenseStore.class).asEagerSingleton();
            }
        };
    }
}
