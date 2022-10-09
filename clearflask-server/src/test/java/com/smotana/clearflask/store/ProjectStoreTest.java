// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.store;

import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableSet;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.util.Modules;
import com.kik.config.ice.ConfigSystem;
import com.smotana.clearflask.api.model.ConfigAdmin;
import com.smotana.clearflask.api.model.VersionedConfig;
import com.smotana.clearflask.api.model.VersionedConfigAdmin;
import com.smotana.clearflask.store.ProjectStore.Project;
import com.smotana.clearflask.store.ProjectStore.SearchEngine;
import com.smotana.clearflask.store.ProjectStore.SlugModel;
import com.smotana.clearflask.store.dynamo.InMemoryDynamoDbProvider;
import com.smotana.clearflask.store.dynamo.SingleTableProvider;
import com.smotana.clearflask.store.impl.DynamoProjectStore;
import com.smotana.clearflask.testutil.AbstractTest;
import com.smotana.clearflask.util.ChatwootUtil;
import com.smotana.clearflask.util.IdUtil;
import com.smotana.clearflask.util.IntercomUtil;
import com.smotana.clearflask.util.ModelUtil;
import com.smotana.clearflask.util.ProjectUpgrader;
import com.smotana.clearflask.web.security.Sanitizer;
import io.dataspray.singletable.SingleTable;
import io.dataspray.singletable.TableSchema;
import lombok.extern.slf4j.Slf4j;
import org.junit.Test;

import java.util.Optional;

import static org.junit.Assert.*;

@Slf4j
public class ProjectStoreTest extends AbstractTest {

    @Inject
    private ProjectStore store;
    @Inject
    private SingleTable singleTable;

    @Override
    protected SearchEngine overrideSearchEngine() {
        return SearchEngine.READ_ELASTICSEARCH_WRITE_BOTH;
    }

    @Override
    protected void configure() {
        super.configure();

        bindMock(ContentStore.class);
        bindMock(ProjectUpgrader.class);
        bindMock(AccountStore.class);

        install(Modules.override(
                DynamoProjectStore.module(),
                InMemoryDynamoDbProvider.module(),
                SingleTableProvider.module(),
                Sanitizer.module(),
                IntercomUtil.module(),
                ChatwootUtil.module()
        ).with(new AbstractModule() {
            @Override
            protected void configure() {
                install(ConfigSystem.overrideModule(DynamoProjectStore.Config.class, om -> {
                    om.override(om.id().enableConfigCacheRead()).withValue(true);
                    om.override(om.id().enableSlugCacheRead()).withValue(true);
                }));
            }
        }));
    }

    @Test(timeout = 10_000L)
    public void test() throws Exception {
        String newProject = "newProject";
        store.createProject(IdUtil.randomId(), newProject, ModelUtil.createEmptyConfig(newProject));

        assertTrue(store.getProject(newProject, false).isPresent());
        assertFalse(store.getProjects(ImmutableSet.of(newProject), false).isEmpty());

        Project project = store.getProject(newProject, true).get();
        VersionedConfig c = project.getVersionedConfig();
        VersionedConfigAdmin ca = project.getVersionedConfigAdmin();
        assertEquals(ImmutableSet.of(project), store.getProjects(ImmutableSet.of(newProject), false));

        VersionedConfigAdmin ca1 = ca.toBuilder()
                .version("ca1")
                .config(ca.getConfig().toBuilder()
                        .name("New name")
                        .build()).build();
        store.updateConfig(newProject, Optional.of(ca.getVersion()), ca1, false);
        assertEquals(Optional.of(ca1), store.getProject(newProject, false).map(Project::getVersionedConfigAdmin));

        VersionedConfigAdmin ca2 = ca.toBuilder()
                .version("ca2")
                .config(ca.getConfig().toBuilder()
                        .name("New name again")
                        .build()).build();
        try {
            store.updateConfig(newProject, Optional.of(ca.getVersion()), ca2, false);
            fail();
        } catch (Exception ex) {
            log.info("Expected updating conflict", ex);
        }
        assertEquals(Optional.of(ca1), store.getProject(newProject, false).map(Project::getVersionedConfigAdmin));

        VersionedConfig c1 = c.toBuilder()
                .version(ca1.getVersion())
                .config(c.getConfig().toBuilder()
                        .name(ca1.getConfig().getName())
                        .build()).build();
        assertEquals(Optional.of(c1), store.getProject(newProject, true).map(Project::getVersionedConfig));
        assertEquals(Optional.of(c1), store.getProject(newProject, false).map(Project::getVersionedConfig));
    }

    @Test(timeout = 10_000L)
    public void testInvitations() throws Exception {
        String projectId = "projectId";
        Project project = store.createProject(IdUtil.randomId(), projectId, ModelUtil.createEmptyConfig(projectId));

        ProjectStore.InvitationModel invitation = store.createInvitation(projectId, "sandy@example.com", "Johnny");
        ProjectStore.InvitationModel invitationExpected = new ProjectStore.InvitationModel(
                invitation.getInvitationId(),
                projectId,
                "sandy@example.com",
                "Johnny",
                project.getVersionedConfigAdmin().getConfig().getName(),
                null,
                invitation.getTtlInEpochSec());
        assertEquals(invitationExpected, invitation);
        assertEquals(Optional.of(invitationExpected), store.getInvitation(invitation.getInvitationId()));
        assertEquals(Optional.empty(), store.getInvitation("asdfdsaf"));
        assertEquals(ImmutableList.of(invitationExpected), store.getInvitations(projectId));

        assertEquals(ImmutableSet.of(), store.getProject(projectId, true).get().getModel().getAdminsAccountIds());
        String admin1AccountId = IdUtil.randomId();
        assertEquals(projectId, store.acceptInvitation(invitation.getInvitationId(), admin1AccountId));
        assertEquals(ImmutableSet.of(admin1AccountId), store.getProject(projectId, true).get().getModel().getAdminsAccountIds());

        String admin2AccountId = IdUtil.randomId();
        store.addAdmin(projectId, admin2AccountId);
        assertEquals(ImmutableSet.of(admin1AccountId, admin2AccountId), store.getProject(projectId, true).get().getModel().getAdminsAccountIds());
        store.addAdmin(projectId, admin2AccountId);
        assertEquals(ImmutableSet.of(admin1AccountId, admin2AccountId), store.getProject(projectId, true).get().getModel().getAdminsAccountIds());

        store.removeAdmin(projectId, admin1AccountId);
        assertEquals(ImmutableSet.of(admin2AccountId), store.getProject(projectId, true).get().getModel().getAdminsAccountIds());

        store.removeAdmin(projectId, admin1AccountId);
        assertEquals(ImmutableSet.of(admin2AccountId), store.getProject(projectId, true).get().getModel().getAdminsAccountIds());
    }

    @Test(timeout = 10_000L)
    public void testDeleteProject() throws Exception {
        String projectId = "projectId";
        String slug1 = "slug1";
        VersionedConfigAdmin configSlug1 = ModelUtil.createEmptyConfig(projectId);
        configSlug1 = configSlug1.toBuilder().config(configSlug1.getConfig().toBuilder()
                .slug(slug1).build()).build();
        store.createProject(IdUtil.randomId(), projectId, configSlug1);

        assertEquals(Optional.of(projectId), store.getProject(projectId, false).map(Project::getProjectId));
        assertEquals(Optional.of(projectId), store.getProjectBySlug(slug1, false).map(Project::getVersionedConfigAdmin).map(VersionedConfigAdmin::getConfig).map(ConfigAdmin::getProjectId));

        String slug2 = "slug2";
        VersionedConfigAdmin configSlug2 = configSlug1.toBuilder().config(configSlug1.getConfig().toBuilder()
                .slug(slug2).build()).build();
        store.updateConfig(projectId, Optional.empty(), configSlug2, false);

        assertEquals(Optional.of(projectId), store.getProject(projectId, false).map(Project::getProjectId));
        assertEquals(Optional.of(projectId), store.getProjectBySlug(slug1, false).map(Project::getVersionedConfigAdmin).map(VersionedConfigAdmin::getConfig).map(ConfigAdmin::getProjectId));
        assertEquals(Optional.of(projectId), store.getProjectBySlug(slug2, false).map(Project::getVersionedConfigAdmin).map(VersionedConfigAdmin::getConfig).map(ConfigAdmin::getProjectId));

        store.deleteProject(projectId);

        assertEquals(Optional.empty(), store.getProject(projectId, false).map(Project::getProjectId));
        assertEquals(Optional.empty(), store.getProjectBySlug(slug1, false).map(Project::getVersionedConfigAdmin).map(VersionedConfigAdmin::getConfig).map(ConfigAdmin::getProjectId));
        assertEquals(Optional.empty(), store.getProjectBySlug(slug2, false).map(Project::getVersionedConfigAdmin).map(VersionedConfigAdmin::getConfig).map(ConfigAdmin::getProjectId));

        // Ensure we can create another project with same slug
        store.createProject(IdUtil.randomId(), projectId, configSlug1);
        store.updateConfig(projectId, Optional.empty(), configSlug2, false);
    }

    @Test(timeout = 10_000L)
    public void testAutoDeleteSlugWithoutProject() throws Exception {
        TableSchema<SlugModel> slugSchema = singleTable.parseTableSchema(SlugModel.class);

        SlugModel slugModel = new SlugModel("mySlug", "myProject", null);
        slugSchema.table().putItem(slugSchema.toItem(slugModel));
        assertEquals(slugModel, slugSchema.fromItem(slugSchema.table().getItem(slugSchema.primaryKey(slugModel))));

        assertEquals(Optional.empty(), store.getProjectBySlug(slugModel.getSlug(), false));

        assertNull(slugSchema.fromItem(slugSchema.table().getItem(slugSchema.primaryKey(slugModel))));
    }
}