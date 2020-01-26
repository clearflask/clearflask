package com.smotana.clearflask.store;

import com.google.common.collect.ImmutableSet;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.util.Modules;
import com.kik.config.ice.ConfigSystem;
import com.smotana.clearflask.api.model.VersionedConfig;
import com.smotana.clearflask.api.model.VersionedConfigAdmin;
import com.smotana.clearflask.core.DemoData;
import com.smotana.clearflask.store.dynamo.InMemoryDynamoDbProvider;
import com.smotana.clearflask.store.dynamo.mapper.DynamoMapperImpl;
import com.smotana.clearflask.store.impl.DynamoAccountStore;
import com.smotana.clearflask.store.impl.DynamoProjectStore;
import com.smotana.clearflask.store.impl.StaticPlanStore;
import com.smotana.clearflask.testutil.AbstractTest;
import lombok.extern.slf4j.Slf4j;
import org.junit.Test;

import java.util.Optional;

import static com.smotana.clearflask.core.DemoData.DEMO_PROJECT_ID;
import static org.junit.Assert.*;

@Slf4j
public class ProjectStoreTest extends AbstractTest {

    @Inject
    private ProjectStore store;

    @Override
    protected void configure() {
        super.configure();

        install(Modules.override(
                DynamoProjectStore.module(),
                InMemoryDynamoDbProvider.module(),
                DynamoMapperImpl.module(),
                StaticPlanStore.module(),
                DynamoAccountStore.module(),
                DemoData.module()
        ).with(new AbstractModule() {
            @Override
            protected void configure() {
                install(ConfigSystem.overrideModule(DynamoProjectStore.Config.class, om -> {
                    om.override(om.id().enableConfigCacheRead()).withValue(true);
                }));
            }
        }));
    }

    @Test(timeout = 5_000L)
    public void test() throws Exception {
        assertTrue(store.getConfig(DEMO_PROJECT_ID, false).isPresent());
        assertTrue(store.getConfigAdmin(DEMO_PROJECT_ID).isPresent());

        VersionedConfig c = store.getConfig(DEMO_PROJECT_ID, true).get();
        VersionedConfigAdmin ca = store.getConfigAdmin(DEMO_PROJECT_ID).get();
        assertEquals(ImmutableSet.of(ca), store.getConfigAdmins(ImmutableSet.of(DEMO_PROJECT_ID)));

        VersionedConfigAdmin ca1 = ca.toBuilder()
                .version("ca1")
                .config(ca.getConfig().toBuilder()
                        .name("New name")
                        .build()).build();
        store.updateConfig(DEMO_PROJECT_ID, ca.getVersion(), ca1);
        assertEquals(Optional.of(ca1), store.getConfigAdmin(DEMO_PROJECT_ID));

        VersionedConfigAdmin ca2 = ca.toBuilder()
                .version("ca2")
                .config(ca.getConfig().toBuilder()
                        .name("New name again")
                        .build()).build();
        try {
            store.updateConfig(DEMO_PROJECT_ID, ca.getVersion(), ca2);
            fail();
        } catch (Exception ex) {
            log.info("Expected updating conflict", ex);
        }
        assertEquals(Optional.of(ca1), store.getConfigAdmin(DEMO_PROJECT_ID));

        VersionedConfig c1 = c.toBuilder()
                .version(ca1.getVersion())
                .config(c.getConfig().toBuilder()
                        .name(ca1.getConfig().getName())
                        .build()).build();
        assertEquals(Optional.of(c1), store.getConfig(DEMO_PROJECT_ID, true));
        assertEquals(Optional.of(c1), store.getConfig(DEMO_PROJECT_ID, false));

        String newProject = "new Project";
        store.createConfig(newProject, ca);
        assertEquals(Optional.of(ca), store.getConfigAdmin(newProject));
        assertEquals(Optional.of(c), store.getConfig(newProject, false));
        assertEquals(Optional.of(c), store.getConfig(newProject, true));
    }
}