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
import com.smotana.clearflask.store.AccountStore.Account;
import com.smotana.clearflask.store.CommentStore;
import com.smotana.clearflask.store.IdeaStore;
import com.smotana.clearflask.store.PlanStore;
import com.smotana.clearflask.store.ProjectStore;
import com.smotana.clearflask.store.UserStore;
import com.smotana.clearflask.store.dynamo.mapper.DynamoMapper;
import com.smotana.clearflask.util.ModelUtil;
import com.smotana.clearflask.util.PasswordUtil;

import javax.inject.Singleton;
import java.time.Instant;
import java.util.Base64;
import java.util.Comparator;

@Singleton
public class DemoData extends ManagedService {

    public static final String DEMO_PROJECT_ID = "smotana";

    @Inject
    private ProjectStore projectStore;
    @Inject
    private AccountStore accountStore;
    @Inject
    private PlanStore planStore;
    @Inject
    private PasswordUtil passwordUtil;
    @Inject
    private UserStore userStore;
    @Inject
    private IdeaStore ideaStore;
    @Inject
    private CommentStore commentStore;


    @Override
    protected void serviceStart() throws Exception {
        populateData();
    }

    @Override
    public ImmutableSet<Class> serviceDependencies() {
        // Wait until table is created
        return ImmutableSet.of(DynamoMapper.class);
    }

    private void populateData() {
        Plan plan = planStore.plansGet().getPlans().stream()
                .filter(p -> p.getPricing() != null)
                .max(Comparator.comparing(p -> p.getPricing().getPrice()))
                .get();

        String email = "matus@smotana.com";
        String password = passwordUtil.saltHashPassword(
                PasswordUtil.Type.ACCOUNT,
                // Salt taken from client side (src/common/util/auth.ts)
                Base64.getEncoder().encodeToString(Hashing.sha512().hashString("a" + ":salt:775DFB51571649109DEB70F423AF2B86:salt:", Charsets.UTF_8).asBytes()),
                email);
        Account account = new Account(
                accountStore.genAccountId(),
                email,
                plan.getPlanid(),
                Instant.now(),
                "Matus Faro",
                password,
                null,
                ImmutableSet.of());
        accountStore.createAccount(account);
        VersionedConfigAdmin versionedConfigAdmin = ModelUtil.createEmptyConfig(DEMO_PROJECT_ID);
        projectStore.createProject(versionedConfigAdmin.getConfig().getProjectId(), versionedConfigAdmin);
        commentStore.createIndex(versionedConfigAdmin.getConfig().getProjectId());
        userStore.createIndex(versionedConfigAdmin.getConfig().getProjectId());
        ideaStore.createIndex(versionedConfigAdmin.getConfig().getProjectId());
        accountStore.addAccountProjectId(account.getEmail(), versionedConfigAdmin.getConfig().getProjectId());
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
