// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.store;

import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableSet;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.name.Names;
import com.google.inject.util.Modules;
import com.kik.config.ice.ConfigSystem;
import com.smotana.clearflask.api.model.*;
import com.smotana.clearflask.store.IdeaStore.IdeaModel;
import com.smotana.clearflask.store.IdeaStore.SearchResponse;
import com.smotana.clearflask.store.ProjectStore.Project;
import com.smotana.clearflask.store.dynamo.InMemoryDynamoDbProvider;
import com.smotana.clearflask.store.dynamo.SingleTableProvider;
import com.smotana.clearflask.store.impl.*;
import com.smotana.clearflask.testutil.AbstractIT;
import com.smotana.clearflask.util.*;
import com.smotana.clearflask.web.security.Sanitizer;
import com.smotana.clearflask.web.util.WebhookServiceImpl;
import lombok.extern.slf4j.Slf4j;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.junit.runners.Parameterized;

import java.time.Instant;
import java.util.Optional;

import static com.smotana.clearflask.testutil.HtmlUtil.textToSimpleHtml;
import static org.junit.Assert.*;

/**
 * Integration test for hidden status functionality in the post approval workflow.
 * Tests that posts with hidden statuses are properly filtered based on user roles.
 */
@Slf4j
@RunWith(Parameterized.class)
public class HiddenStatusIT extends AbstractIT {

    @Parameterized.Parameter(0)
    public ProjectStore.SearchEngine searchEngine;

    @Parameterized.Parameters(name = "{0}")
    public static Object[][] data() {
        return new Object[][]{
                {ProjectStore.SearchEngine.READWRITE_ELASTICSEARCH},
                {ProjectStore.SearchEngine.READWRITE_MYSQL},
        };
    }

    @Inject
    private IdeaStore ideaStore;
    @Inject
    private ProjectStore projectStore;

    @Override
    protected void configure() {
        overrideSearchEngine = searchEngine;
        super.configure();

        bindMock(ContentStore.class);

        install(Modules.override(
                InMemoryDynamoDbProvider.module(),
                SingleTableProvider.module(),
                DynamoElasticIdeaStore.module(),
                DynamoElasticAccountStore.module(),
                DynamoElasticUserStore.module(),
                DynamoVoteStore.module(),
                Sanitizer.module(),
                DefaultServerSecret.module(Names.named("cursor")),
                WebhookServiceImpl.module(),
                DynamoProjectStore.module(),
                ProjectUpgraderImpl.module(),
                IntercomUtil.module(),
                ChatwootUtil.module()
        ).with(new AbstractModule() {
            @Override
            protected void configure() {
                install(ConfigSystem.overrideModule(DefaultServerSecret.Config.class, Names.named("cursor"), om -> {
                    om.override(om.id().sharedKey()).withValue(ServerSecretTest.getRandomSharedKey());
                }));
                install(ConfigSystem.overrideModule(DynamoElasticIdeaStore.Config.class, om -> {
                    om.override(om.id().elasticForceRefresh()).withValue(true);
                }));
            }
        }));
    }

    @Test(timeout = 30_000L)
    public void testHiddenStatusFiltering() throws Exception {
        String projectId = IdUtil.randomId();
        String categoryId = "feedback";
        String hiddenStatusId = "pending-approval";
        String visibleStatusId = "approved";

        // Create project with hidden and visible statuses
        ConfigAdmin configAdmin = new ConfigAdmin(
                1L,
                "test-project",
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                new com.smotana.clearflask.api.model.Config(
                        ImmutableList.of(new Category(
                                categoryId,
                                "Feedback",
                                null,
                                null,
                                new Support(),
                                new Workflow(
                                        hiddenStatusId,
                                        ImmutableList.of(
                                                new IdeaStatus(hiddenStatusId, "Pending Approval", "#ff0000", true),
                                                new IdeaStatus(visibleStatusId, "Approved", "#00ff00", false)
                                        )
                                ),
                                null,
                                null,
                                null,
                                null
                        )),
                        null,
                        null,
                        null,
                        null
                )
        );

        VersionedConfigAdmin versionedConfigAdmin = new VersionedConfigAdmin(configAdmin, IdUtil.randomId());
        projectStore.createProject(IdUtil.randomId(), projectId, versionedConfigAdmin);

        // Create index
        ideaStore.createIndex(projectId).get();

        // Verify hidden status IDs are correctly identified
        Project project = projectStore.getProject(projectId, true).get();
        ImmutableSet<String> hiddenStatusIds = project.getHiddenStatusIds();
        assertEquals("Should have exactly one hidden status", 1, hiddenStatusIds.size());
        assertTrue("Hidden status should be in the set", hiddenStatusIds.contains(hiddenStatusId));
        assertFalse("Visible status should not be in the set", hiddenStatusIds.contains(visibleStatusId));

        // Create posts with different statuses
        IdeaModel hiddenPost = MockModelUtil.getRandomIdea().toBuilder()
                .projectId(projectId)
                .categoryId(categoryId)
                .statusId(hiddenStatusId)
                .title("Hidden Post")
                .created(Instant.now())
                .build();

        IdeaModel visiblePost = MockModelUtil.getRandomIdea().toBuilder()
                .projectId(projectId)
                .categoryId(categoryId)
                .statusId(visibleStatusId)
                .title("Visible Post")
                .created(Instant.now())
                .build();

        IdeaModel nullStatusPost = MockModelUtil.getRandomIdea().toBuilder()
                .projectId(projectId)
                .categoryId(categoryId)
                .statusId(null)
                .title("Null Status Post")
                .created(Instant.now())
                .build();

        ideaStore.createIdea(hiddenPost).get();
        ideaStore.createIdea(visiblePost).get();
        ideaStore.createIdea(nullStatusPost).get();

        // Test search filtering with hidden statuses (non-moderator view)
        SearchResponse searchResponse = ideaStore.searchIdeas(
                projectId,
                IdeaSearch.builder()
                        .categoryId(categoryId)
                        .limit(100)
                        .build(),
                Optional.empty(), // No user ID (anonymous)
                hiddenStatusIds, // Filter hidden statuses
                Optional.empty()
        );

        // Only visible and null status posts should be returned
        assertEquals("Should return 2 posts (visible + null status)", 2, searchResponse.getIdeaIds().size());
        assertFalse("Hidden post should not be in results", searchResponse.getIdeaIds().contains(hiddenPost.getIdeaId()));
        assertTrue("Visible post should be in results", searchResponse.getIdeaIds().contains(visiblePost.getIdeaId()));
        assertTrue("Null status post should be in results", searchResponse.getIdeaIds().contains(nullStatusPost.getIdeaId()));

        // Test search without filtering (moderator/admin view)
        SearchResponse searchResponseAll = ideaStore.searchIdeas(
                projectId,
                IdeaSearch.builder()
                        .categoryId(categoryId)
                        .limit(100)
                        .build(),
                Optional.empty(), // No user ID
                ImmutableSet.of(), // No filtering (moderator view)
                Optional.empty()
        );

        // All posts should be returned
        assertEquals("Should return all 3 posts", 3, searchResponseAll.getIdeaIds().size());
        assertTrue("Hidden post should be in results", searchResponseAll.getIdeaIds().contains(hiddenPost.getIdeaId()));
        assertTrue("Visible post should be in results", searchResponseAll.getIdeaIds().contains(visiblePost.getIdeaId()));
        assertTrue("Null status post should be in results", searchResponseAll.getIdeaIds().contains(nullStatusPost.getIdeaId()));
    }

    @Test(timeout = 30_000L)
    public void testGetHiddenStatusIds() throws Exception {
        String projectId = IdUtil.randomId();
        String categoryId = "feedback";

        // Create project with multiple hidden statuses
        ConfigAdmin configAdmin = new ConfigAdmin(
                1L,
                "test-project",
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                new com.smotana.clearflask.api.model.Config(
                        ImmutableList.of(new Category(
                                categoryId,
                                "Feedback",
                                null,
                                null,
                                new Support(),
                                new Workflow(
                                        "status1",
                                        ImmutableList.of(
                                                new IdeaStatus("status1", "Hidden 1", "#ff0000", true),
                                                new IdeaStatus("status2", "Visible", "#00ff00", false),
                                                new IdeaStatus("status3", "Hidden 2", "#0000ff", true)
                                        )
                                ),
                                null,
                                null,
                                null,
                                null
                        )),
                        null,
                        null,
                        null,
                        null
                )
        );

        VersionedConfigAdmin versionedConfigAdmin = new VersionedConfigAdmin(configAdmin, IdUtil.randomId());
        projectStore.createProject(IdUtil.randomId(), projectId, versionedConfigAdmin);

        Project project = projectStore.getProject(projectId, true).get();
        ImmutableSet<String> hiddenStatusIds = project.getHiddenStatusIds();

        assertEquals("Should have exactly 2 hidden statuses", 2, hiddenStatusIds.size());
        assertTrue("status1 should be hidden", hiddenStatusIds.contains("status1"));
        assertTrue("status3 should be hidden", hiddenStatusIds.contains("status3"));
        assertFalse("status2 should not be hidden", hiddenStatusIds.contains("status2"));
    }

    @Test(timeout = 30_000L)
    public void testNoHiddenStatuses() throws Exception {
        String projectId = IdUtil.randomId();
        String categoryId = "feedback";

        // Create project with no hidden statuses
        ConfigAdmin configAdmin = new ConfigAdmin(
                1L,
                "test-project",
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                new com.smotana.clearflask.api.model.Config(
                        ImmutableList.of(new Category(
                                categoryId,
                                "Feedback",
                                null,
                                null,
                                new Support(),
                                new Workflow(
                                        "status1",
                                        ImmutableList.of(
                                                new IdeaStatus("status1", "Visible 1", "#ff0000", false),
                                                new IdeaStatus("status2", "Visible 2", "#00ff00", false)
                                        )
                                ),
                                null,
                                null,
                                null,
                                null
                        )),
                        null,
                        null,
                        null,
                        null
                )
        );

        VersionedConfigAdmin versionedConfigAdmin = new VersionedConfigAdmin(configAdmin, IdUtil.randomId());
        projectStore.createProject(IdUtil.randomId(), projectId, versionedConfigAdmin);

        Project project = projectStore.getProject(projectId, true).get();
        ImmutableSet<String> hiddenStatusIds = project.getHiddenStatusIds();

        assertTrue("Should have no hidden statuses", hiddenStatusIds.isEmpty());
    }
}
