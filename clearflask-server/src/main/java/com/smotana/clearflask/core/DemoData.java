package com.smotana.clearflask.core;

import com.google.common.base.Charsets;
import com.google.common.collect.ImmutableSet;
import com.google.common.hash.Hashing;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.multibindings.Multibinder;
import com.smotana.clearflask.api.model.Plan;
import com.smotana.clearflask.api.model.VersionedConfigAdmin;
import com.smotana.clearflask.store.AccountStore;
import com.smotana.clearflask.store.PlanStore;
import com.smotana.clearflask.store.ProjectStore;
import com.smotana.clearflask.util.IdUtil;
import com.smotana.clearflask.util.ModelUtil;
import com.smotana.clearflask.util.PasswordUtil;

import javax.inject.Singleton;
import java.util.Base64;
import java.util.Comparator;

@Singleton
public class DemoData extends ManagedService {

    @Inject
    private ProjectStore projectStore;
    @Inject
    private AccountStore accountStore;
    @Inject
    private PlanStore planStore;
    @Inject
    private PasswordUtil passwordUtil;


    @Override
    protected void serviceStart() throws Exception {
        populateData();
    }

    @Override
    public ImmutableSet<Class> serviceDependencies() {
        return ImmutableSet.of(AccountStore.class);
    }

    private void populateData() {
        Plan plan = planStore.plansGet().getPlans().stream()
                .filter(p -> p.getPricing() != null)
                .max(Comparator.comparing(p -> p.getPricing().getPrice()))
                .get();

        String accountId = IdUtil.randomId();
        String password = passwordUtil.saltHashPassword(
                PasswordUtil.Type.ACCOUNT,
                // Salt taken from client side (src/common/util/auth.ts)
                Base64.getEncoder().encodeToString(Hashing.sha512().hashString("a" + ":salt:775DFB51571649109DEB70F423AF2B86:salt:", Charsets.UTF_8).asBytes()),
                accountId);
        AccountStore.Account account = new AccountStore.Account(
                accountId,
                ImmutableSet.of(plan.getPlanid()),
                "Smotana",
                "Matus Faro",
                "matus@smotana.com",
                password,
                "12345678",
                "dummy-payment-token",
                ImmutableSet.of());
        accountStore.createAccount(account);
        VersionedConfigAdmin versionedConfigAdmin = ModelUtil.createEmptyConfig("smotana");
        projectStore.createConfig(versionedConfigAdmin.getConfig().getProjectId(), versionedConfigAdmin);
        accountStore.addAccountProjectId(account.getAccountId(), versionedConfigAdmin.getConfig().getProjectId());
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(DemoData.class).asEagerSingleton();
                Multibinder.newSetBinder(binder(), ManagedService.class).addBinding().to(DemoData.class);
            }
        };
    }
}
