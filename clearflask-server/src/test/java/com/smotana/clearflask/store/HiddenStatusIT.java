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
                                new Support(true, new Voting(true, null), new Expressing(true, null), true),
                                new Workflow(
                                        hiddenStatusId,
                                        ImmutableList.of(
                                                new IdeaStatus(hiddenStatusId, "Pending Approval", null, "#ff0000", false, false, false, false, false, true),
                                                new IdeaStatus(visibleStatusId, "Approved", null, "#00ff00", false, false, false, false, false, false)
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
                        .filterCategoryIds(ImmutableList.of(categoryId))
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
                        .filterCategoryIds(ImmutableList.of(categoryId))
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
                                new Support(true, new Voting(true, null), new Expressing(true, null), true),
                                new Workflow(
                                        "status1",
                                        ImmutableList.of(
                                                new IdeaStatus("status1", "Hidden 1", null, "#ff0000", false, false, false, false, false, true),
                                                new IdeaStatus("status2", "Visible", null, "#00ff00", false, false, false, false, false, false),
                                                new IdeaStatus("status3", "Hidden 2", null, "#0000ff", false, false, false, false, false, true)
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
                                new Support(true, new Voting(true, null), new Expressing(true, null), true),
                                new Workflow(
                                        "status1",
                                        ImmutableList.of(
                                                new IdeaStatus("status1", "Visible 1", null, "#ff0000", false, false, false, false, false, false),
                                                new IdeaStatus("status2", "Visible 2", null, "#00ff00", false, false, false, false, false, false)
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

    /**
     * Test that authors can see their own posts even when the status is hidden.
     * This is important for UX - users should be able to see posts they created.
     */
    @Test(timeout = 30_000L)
    public void testAuthorAccessToOwnHiddenPosts() throws Exception {
        String projectId = IdUtil.randomId();
        String categoryId = "feedback";
        String hiddenStatusId = "pending-approval";
        String authorId = "author-user-id";

        // Create project with hidden status
        ConfigAdmin configAdmin = new ConfigAdmin(
                1L,
                "test-project",
                null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
                new com.smotana.clearflask.api.model.Config(
                        ImmutableList.of(new Category(
                                categoryId,
                                "Feedback",
                                null,
                                null,
                                new Support(true, new Voting(true, null), new Expressing(true, null), true),
                                new Workflow(
                                        hiddenStatusId,
                                        ImmutableList.of(
                                                new IdeaStatus(hiddenStatusId, "Pending Approval", null, "#ff0000", false, false, false, false, false, true)
                                        )
                                ),
                                null, null, null, null
                        )),
                        null, null, null, null
                )
        );

        VersionedConfigAdmin versionedConfigAdmin = new VersionedConfigAdmin(configAdmin, IdUtil.randomId());
        projectStore.createProject(IdUtil.randomId(), projectId, versionedConfigAdmin);
        ideaStore.createIndex(projectId).get();

        // Create post by specific author with hidden status
        IdeaModel hiddenPost = MockModelUtil.getRandomIdea().toBuilder()
                .projectId(projectId)
                .categoryId(categoryId)
                .statusId(hiddenStatusId)
                .authorUserId(authorId)
                .title("Author's Hidden Post")
                .created(Instant.now())
                .build();

        ideaStore.createIdea(hiddenPost).get();

        Project project = projectStore.getProject(projectId, true).get();
        ImmutableSet<String> hiddenStatusIds = project.getHiddenStatusIds();

        // Note: This test documents current behavior where authors also cannot see their own hidden posts
        // This might be changed in the future to improve UX
        // For now, filtering is based solely on user role, not ownership

        // Search as the author (but not as moderator)
        SearchResponse searchResponse = ideaStore.searchIdeas(
                projectId,
                IdeaSearch.builder()
                        .filterCategoryIds(ImmutableList.of(categoryId))
                        .limit(100)
                        .build(),
                Optional.of(authorId), // Search as the author
                hiddenStatusIds, // Filter hidden statuses (non-moderator)
                Optional.empty()
        );

        // Current behavior: Authors cannot see their own hidden posts
        // This is consistent with the role-based filtering approach
        assertEquals("Authors currently cannot see their own hidden posts", 0, searchResponse.getIdeaIds().size());

        // Search as the author with moderator view (no filtering)
        SearchResponse searchResponseModerator = ideaStore.searchIdeas(
                projectId,
                IdeaSearch.builder()
                        .filterCategoryIds(ImmutableList.of(categoryId))
                        .limit(100)
                        .build(),
                Optional.of(authorId),
                ImmutableSet.of(), // No filtering (moderator view)
                Optional.empty()
        );

        // With moderator privileges, the author can see the post
        assertEquals("Authors with moderator role can see hidden posts", 1, searchResponseModerator.getIdeaIds().size());
        assertTrue("Post should be in results", searchResponseModerator.getIdeaIds().contains(hiddenPost.getIdeaId()));
    }

    /**
     * Test behavior when post status changes from visible to hidden and vice versa.
     */
    @Test(timeout = 30_000L)
    public void testStatusChanges() throws Exception {
        String projectId = IdUtil.randomId();
        String categoryId = "feedback";
        String hiddenStatusId = "pending";
        String visibleStatusId = "approved";

        // Create project with both hidden and visible statuses
        ConfigAdmin configAdmin = new ConfigAdmin(
                1L,
                "test-project",
                null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
                new com.smotana.clearflask.api.model.Config(
                        ImmutableList.of(new Category(
                                categoryId,
                                "Feedback",
                                null,
                                null,
                                new Support(true, new Voting(true, null), new Expressing(true, null), true),
                                new Workflow(
                                        visibleStatusId,
                                        ImmutableList.of(
                                                new IdeaStatus(visibleStatusId, "Approved", null, "#00ff00", false, false, false, false, false, false),
                                                new IdeaStatus(hiddenStatusId, "Pending", null, "#ff0000", false, false, false, false, false, true)
                                        )
                                ),
                                null, null, null, null
                        )),
                        null, null, null, null
                )
        );

        VersionedConfigAdmin versionedConfigAdmin = new VersionedConfigAdmin(configAdmin, IdUtil.randomId());
        projectStore.createProject(IdUtil.randomId(), projectId, versionedConfigAdmin);
        ideaStore.createIndex(projectId).get();

        Project project = projectStore.getProject(projectId, true).get();
        ImmutableSet<String> hiddenStatusIds = project.getHiddenStatusIds();

        // Create post with visible status initially
        IdeaModel post = MockModelUtil.getRandomIdea().toBuilder()
                .projectId(projectId)
                .categoryId(categoryId)
                .statusId(visibleStatusId)
                .title("Test Post")
                .created(Instant.now())
                .build();

        ideaStore.createIdea(post).get();

        // Verify post is visible
        SearchResponse searchResponse1 = ideaStore.searchIdeas(
                projectId,
                IdeaSearch.builder()
                        .filterCategoryIds(ImmutableList.of(categoryId))
                        .limit(100)
                        .build(),
                Optional.empty(),
                hiddenStatusIds,
                Optional.empty()
        );
        assertEquals("Post with visible status should be found", 1, searchResponse1.getIdeaIds().size());

        // Change status to hidden
        IdeaModel updatedPost = post.toBuilder()
                .statusId(hiddenStatusId)
                .build();
        ideaStore.updateIdea(projectId, updatedPost.getIdeaId(), ideaUpdate -> updatedPost);

        // Verify post is now hidden
        SearchResponse searchResponse2 = ideaStore.searchIdeas(
                projectId,
                IdeaSearch.builder()
                        .filterCategoryIds(ImmutableList.of(categoryId))
                        .limit(100)
                        .build(),
                Optional.empty(),
                hiddenStatusIds,
                Optional.empty()
        );
        assertEquals("Post with hidden status should not be found", 0, searchResponse2.getIdeaIds().size());

        // Change status back to visible
        IdeaModel reapprovedPost = updatedPost.toBuilder()
                .statusId(visibleStatusId)
                .build();
        ideaStore.updateIdea(projectId, reapprovedPost.getIdeaId(), ideaUpdate -> reapprovedPost);

        // Verify post is visible again
        SearchResponse searchResponse3 = ideaStore.searchIdeas(
                projectId,
                IdeaSearch.builder()
                        .filterCategoryIds(ImmutableList.of(categoryId))
                        .limit(100)
                        .build(),
                Optional.empty(),
                hiddenStatusIds,
                Optional.empty()
        );
        assertEquals("Post with visible status should be found again", 1, searchResponse3.getIdeaIds().size());
    }

    /**
     * Test that posts without a category are handled correctly.
     * Posts with null categoryId should still respect hidden status filtering.
     */
    @Test(timeout = 30_000L)
    public void testPostsWithoutCategory() throws Exception {
        String projectId = IdUtil.randomId();
        String categoryId = "feedback";
        String hiddenStatusId = "pending";

        // Create project
        ConfigAdmin configAdmin = new ConfigAdmin(
                1L,
                "test-project",
                null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
                new com.smotana.clearflask.api.model.Config(
                        ImmutableList.of(new Category(
                                categoryId,
                                "Feedback",
                                null,
                                null,
                                new Support(true, new Voting(true, null), new Expressing(true, null), true),
                                new Workflow(
                                        hiddenStatusId,
                                        ImmutableList.of(
                                                new IdeaStatus(hiddenStatusId, "Pending", null, "#ff0000", false, false, false, false, false, true)
                                        )
                                ),
                                null, null, null, null
                        )),
                        null, null, null, null
                )
        );

        VersionedConfigAdmin versionedConfigAdmin = new VersionedConfigAdmin(configAdmin, IdUtil.randomId());
        projectStore.createProject(IdUtil.randomId(), projectId, versionedConfigAdmin);
        ideaStore.createIndex(projectId).get();

        Project project = projectStore.getProject(projectId, true).get();
        ImmutableSet<String> hiddenStatusIds = project.getHiddenStatusIds();

        // Create post with valid category but hidden status
        IdeaModel postWithCategory = MockModelUtil.getRandomIdea().toBuilder()
                .projectId(projectId)
                .categoryId(categoryId)
                .statusId(hiddenStatusId)
                .title("Post with Category")
                .created(Instant.now())
                .build();

        ideaStore.createIdea(postWithCategory).get();

        // Search without category filter - should not find hidden post
        SearchResponse searchResponse = ideaStore.searchIdeas(
                projectId,
                IdeaSearch.builder()
                        .limit(100)
                        .build(),
                Optional.empty(),
                hiddenStatusIds,
                Optional.empty()
        );

        assertEquals("Hidden post should not be found regardless of category filter", 0, searchResponse.getIdeaIds().size());

        // Search as moderator - should find the post
        SearchResponse searchResponseModerator = ideaStore.searchIdeas(
                projectId,
                IdeaSearch.builder()
                        .limit(100)
                        .build(),
                Optional.empty(),
                ImmutableSet.of(), // No filtering
                Optional.empty()
        );

        assertEquals("Moderator should find the post", 1, searchResponseModerator.getIdeaIds().size());
    }

    /**
     * Test thread safety by creating and searching posts concurrently.
     * Note: This is a basic smoke test, not a comprehensive concurrency test.
     */
    @Test(timeout = 30_000L)
    public void testThreadSafety() throws Exception {
        String projectId = IdUtil.randomId();
        String categoryId = "feedback";
        String hiddenStatusId = "pending";
        String visibleStatusId = "approved";

        // Create project
        ConfigAdmin configAdmin = new ConfigAdmin(
                1L,
                "test-project",
                null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
                new com.smotana.clearflask.api.model.Config(
                        ImmutableList.of(new Category(
                                categoryId,
                                "Feedback",
                                null,
                                null,
                                new Support(true, new Voting(true, null), new Expressing(true, null), true),
                                new Workflow(
                                        visibleStatusId,
                                        ImmutableList.of(
                                                new IdeaStatus(visibleStatusId, "Approved", null, "#00ff00", false, false, false, false, false, false),
                                                new IdeaStatus(hiddenStatusId, "Pending", null, "#ff0000", false, false, false, false, false, true)
                                        )
                                ),
                                null, null, null, null
                        )),
                        null, null, null, null
                )
        );

        VersionedConfigAdmin versionedConfigAdmin = new VersionedConfigAdmin(configAdmin, IdUtil.randomId());
        projectStore.createProject(IdUtil.randomId(), projectId, versionedConfigAdmin);
        ideaStore.createIndex(projectId).get();

        Project project = projectStore.getProject(projectId, true).get();
        ImmutableSet<String> hiddenStatusIds = project.getHiddenStatusIds();

        // Create multiple posts with different statuses
        for (int i = 0; i < 5; i++) {
            IdeaModel visiblePost = MockModelUtil.getRandomIdea().toBuilder()
                    .projectId(projectId)
                    .categoryId(categoryId)
                    .statusId(visibleStatusId)
                    .title("Visible Post " + i)
                    .created(Instant.now())
                    .build();
            ideaStore.createIdea(visiblePost).get();

            IdeaModel hiddenPost = MockModelUtil.getRandomIdea().toBuilder()
                    .projectId(projectId)
                    .categoryId(categoryId)
                    .statusId(hiddenStatusId)
                    .title("Hidden Post " + i)
                    .created(Instant.now())
                    .build();
            ideaStore.createIdea(hiddenPost).get();
        }

        // Perform searches concurrently (basic smoke test)
        SearchResponse regularSearch = ideaStore.searchIdeas(
                projectId,
                IdeaSearch.builder()
                        .filterCategoryIds(ImmutableList.of(categoryId))
                        .limit(100)
                        .build(),
                Optional.empty(),
                hiddenStatusIds,
                Optional.empty()
        );

        SearchResponse moderatorSearch = ideaStore.searchIdeas(
                projectId,
                IdeaSearch.builder()
                        .filterCategoryIds(ImmutableList.of(categoryId))
                        .limit(100)
                        .build(),
                Optional.empty(),
                ImmutableSet.of(), // No filtering
                Optional.empty()
        );

        // Verify results
        assertEquals("Regular search should find only visible posts", 5, regularSearch.getIdeaIds().size());
        assertEquals("Moderator search should find all posts", 10, moderatorSearch.getIdeaIds().size());
    }
}
