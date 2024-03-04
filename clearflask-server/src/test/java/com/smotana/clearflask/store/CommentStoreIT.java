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
import com.smotana.clearflask.api.model.CommentSearchAdmin;
import com.smotana.clearflask.api.model.CommentUpdate;
import com.smotana.clearflask.store.CommentStore.CommentModel;
import com.smotana.clearflask.store.IdeaStore.IdeaModel;
import com.smotana.clearflask.store.ProjectStore.SearchEngine;
import com.smotana.clearflask.store.VoteStore.VoteValue;
import com.smotana.clearflask.store.dynamo.InMemoryDynamoDbProvider;
import com.smotana.clearflask.store.dynamo.SingleTableProvider;
import com.smotana.clearflask.store.elastic.ElasticUtil;
import com.smotana.clearflask.store.impl.*;
import com.smotana.clearflask.store.mysql.MysqlUtil;
import com.smotana.clearflask.testutil.AbstractIT;
import com.smotana.clearflask.util.*;
import com.smotana.clearflask.web.security.Sanitizer;
import com.smotana.clearflask.web.util.WebhookServiceImpl;
import lombok.extern.slf4j.Slf4j;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.junit.runners.Parameterized;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static com.smotana.clearflask.testutil.HtmlUtil.textToSimpleHtml;
import static org.junit.Assert.*;

@Slf4j
@RunWith(Parameterized.class)
public class CommentStoreIT extends AbstractIT {

    @Parameterized.Parameter(0)
    public SearchEngine searchEngine;

    @Parameterized.Parameters(name = "{0}")
    public static Object[][] data() {
        return new Object[][]{
                {ProjectStore.SearchEngine.READWRITE_ELASTICSEARCH},
                {SearchEngine.READWRITE_MYSQL},
        };
    }

    @Inject
    private CommentStore store;
    @Inject
    private IdeaStore ideaStore;
    @Inject
    private UserStore userStore;

    @Override
    protected void configure() {
        overrideSearchEngine = searchEngine;
        super.configure();

        bindMock(ContentStore.class);

        install(Modules.override(
                InMemoryDynamoDbProvider.module(),
                SingleTableProvider.module(),
                DynamoElasticCommentStore.module(),
                DynamoElasticAccountStore.module(),
                DynamoElasticUserStore.module(),
                DynamoVoteStore.module(),
                Sanitizer.module(),
                MysqlUtil.module(),
                ElasticUtil.module(),
                DynamoElasticIdeaStore.module(),
                DefaultServerSecret.module(Names.named("cursor")),
                WebhookServiceImpl.module(),
                DynamoProjectStore.module(),
                ProjectUpgraderImpl.module(),
                IntercomUtil.module(),
                ChatwootUtil.module()
        ).with(new AbstractModule() {
            @Override
            protected void configure() {
                install(ConfigSystem.overrideModule(DynamoElasticCommentStore.Config.class, om -> {
                    om.override(om.id().elasticForceRefresh()).withValue(true);
                }));
                install(ConfigSystem.overrideModule(DefaultServerSecret.Config.class, Names.named("cursor"), om -> {
                    om.override(om.id().sharedKey()).withValue(ServerSecretTest.getRandomSharedKey());
                }));
                install(ConfigSystem.overrideModule(DynamoElasticIdeaStore.Config.class, om -> {
                    om.override(om.id().elasticForceRefresh()).withValue(true);
                }));
            }
        }));
    }

    @Test(timeout = 10_000L)
    public void testCreateGetSearch() throws Exception {
        String projectId = IdUtil.randomId();
        store.createIndex(projectId).get();
        ideaStore.createIndex(projectId);
        String ideaId = createRandomIdea(projectId).getIdeaId();

        CommentModel c0 = createRandomComment(projectId, ideaId, ImmutableList.of());
        assertEquals(Optional.of(c0), store.getComment(projectId, ideaId, c0.getCommentId()));
        assertEquals(ImmutableSet.of(c0), ImmutableSet.copyOf(store.getComments(projectId, ideaId, ImmutableSet.of(c0.getCommentId())).values()));

        CommentModel c00 = createRandomComment(projectId, ideaId, ImmutableList.of(c0.getCommentId()));
        c0 = c0.toBuilder().childCommentCount(c0.getChildCommentCount() + 1).build();
        assertEquals(Optional.of(c00), store.getComment(projectId, ideaId, c00.getCommentId()));
        assertEquals(ImmutableSet.of(c0, c00), ImmutableSet.copyOf(store.getComments(projectId, ideaId, ImmutableSet.of(c0.getCommentId(), c00.getCommentId())).values()));
        assertEquals(Optional.of(c0), store.getComment(projectId, ideaId, c0.getCommentId()));

        // Search by DynamoDB
        ImmutableList<CommentModel> comments = store.searchComments(projectId, CommentSearchAdmin.builder()
                        .build(), false, Optional.empty())
                .getComments();
        assertEquals(2, comments.size());

        // Search by ElasticSearch
        comments = store.searchComments(projectId, CommentSearchAdmin.builder()
                        .filterAuthorId(c0.getAuthorUserId())
                        .build(), false, Optional.empty())
                .getComments();
        assertEquals(1, comments.size());
        assertEquals(c0.getCommentId(), comments.get(0).getCommentId());
    }

    @Test(timeout = 10_000L)
    public void testUpdate() throws Exception {
        String projectId = IdUtil.randomId();
        store.createIndex(projectId).get();
        ideaStore.createIndex(projectId);
        String ideaId = createRandomIdea(projectId).getIdeaId();

        CommentModel c = createRandomComment(projectId, ideaId, ImmutableList.of());
        assertEquals(Optional.of(c), store.getComment(projectId, ideaId, c.getCommentId()));

        c = c.toBuilder().content(textToSimpleHtml("newContent")).build();
        CommentStore.CommentAndIndexingFuture<Void> writeResponseCommentAndIndexingFuture = store.updateComment(projectId, ideaId, c.getCommentId(), Instant.now(), new CommentUpdate(c.getContentAsUnsafeHtml()));
        writeResponseCommentAndIndexingFuture.getIndexingFuture().get();
        c = c.toBuilder().edited(writeResponseCommentAndIndexingFuture.getCommentModel().getEdited()).build();
        assertEquals(Optional.of(c), store.getComment(projectId, ideaId, c.getCommentId()));
    }

    @Test(timeout = 10_000L)
    public void testVote() throws Exception {
        String projectId = IdUtil.randomId();
        store.createIndex(projectId).get();
        ideaStore.createIndex(projectId);
        String ideaId = createRandomIdea(projectId).getIdeaId();
        userStore.createIndex(projectId);
        String userId1 = userStore.createUser(MockModelUtil.getRandomUser().toBuilder().projectId(projectId).build()).getUser().getUserId();
        String userId2 = userStore.createUser(MockModelUtil.getRandomUser().toBuilder().projectId(projectId).build()).getUser().getUserId();

        CommentModel c = createRandomComment(projectId, ideaId, ImmutableList.of());
        assertEquals(Optional.of(c), store.getComment(projectId, ideaId, c.getCommentId()));

        c = c.toBuilder().upvotes(1).build();
        assertEquals(Optional.of(c), store.getComment(projectId, ideaId, c.getCommentId()));

        c = c.toBuilder().upvotes(2).build();
        store.voteComment(projectId, ideaId, c.getCommentId(), userId1, VoteValue.Upvote).getIndexingFuture().get();
        assertEquals(Optional.of(c), store.getComment(projectId, ideaId, c.getCommentId()));

        c = c.toBuilder().downvotes(1).build();
        store.voteComment(projectId, ideaId, c.getCommentId(), userId2, VoteValue.Downvote).getIndexingFuture().get();
        assertEquals(Optional.of(c), store.getComment(projectId, ideaId, c.getCommentId()));

        c = c.toBuilder().upvotes(1).downvotes(2).build();
        store.voteComment(projectId, ideaId, c.getCommentId(), userId1, VoteValue.Downvote).getIndexingFuture().get();
        assertEquals(Optional.of(c), store.getComment(projectId, ideaId, c.getCommentId()));
    }

    @Test(timeout = 10_000L)
    public void testMarkAsDeleted() throws Exception {
        String projectId = IdUtil.randomId();
        store.createIndex(projectId).get();
        ideaStore.createIndex(projectId);
        String ideaId = createRandomIdea(projectId).getIdeaId();

        CommentModel comment = createRandomComment(projectId, ideaId, ImmutableList.of());
        assertEquals(Optional.of(comment), store.getComment(projectId, ideaId, comment.getCommentId()));

        store.markAsDeletedComment(projectId, ideaId, comment.getCommentId()).getIndexingFuture().get();
        Optional<CommentModel> commentActual = store.getComment(projectId, ideaId, comment.getCommentId());
        assertTrue(commentActual.isPresent());
        assertNotNull(commentActual.get().getEdited());
        comment = comment.toBuilder()
                .authorUserId(null)
                .authorName(null)
                .content(null)
                .edited(commentActual.get().getEdited())
                .build();
        assertEquals(comment, commentActual.get());
    }

    @Test(timeout = 10_000L)
    public void testDelete() throws Exception {
        String projectId = IdUtil.randomId();
        store.createIndex(projectId).get();
        ideaStore.createIndex(projectId);
        String ideaId = createRandomIdea(projectId).getIdeaId();
        String ideaId2 = createRandomIdea(projectId).getIdeaId();

        CommentModel c0 = createRandomComment(projectId, ideaId, ImmutableList.of());
        CommentModel c1 = createRandomComment(projectId, ideaId, ImmutableList.of());
        CommentModel c01 = createRandomComment(projectId, ideaId, ImmutableList.of(c0.getCommentId()));
        CommentModel cOther = createRandomComment(projectId, ideaId2, ImmutableList.of());
        c0 = c0.toBuilder().childCommentCount(c0.getChildCommentCount() + 1).build();
        assertEquals(ImmutableSet.of(c01, c1, c0), ImmutableSet.copyOf(store.getComments(projectId, ideaId, ImmutableSet.of(c0.getCommentId(), c1.getCommentId(), c01.getCommentId(), cOther.getCommentId())).values()));

        store.deleteComment(projectId, ideaId, c0.getCommentId()).get();
        assertEquals(ImmutableSet.of(c1, c01), ImmutableSet.copyOf(ImmutableSet.copyOf(store.getComments(projectId, ideaId, ImmutableSet.of(c0.getCommentId(), c1.getCommentId(), c01.getCommentId(), cOther.getCommentId())).values())));

        store.deleteCommentsForIdea(projectId, ideaId).get();
        assertEquals(ImmutableSet.of(), ImmutableSet.copyOf(store.getComments(projectId, ideaId, ImmutableSet.of(c0.getCommentId(), c1.getCommentId(), c01.getCommentId(), cOther.getCommentId())).values()));
    }

    private CommentModel createRandomComment(String projectId, String ideaId, ImmutableList<String> parentCommentIds) throws Exception {
        CommentStore.CommentAndIndexingFuture<List<Void>> commentAndFuture = store.createCommentAndUpvote(getRandomComment(projectId, ideaId, parentCommentIds));
        commentAndFuture.getIndexingFuture().get();
        return commentAndFuture.getCommentModel();
    }

    private CommentModel getRandomComment(String projectId, String ideaId, ImmutableList<String> parentCommentIds) throws Exception {
        return new CommentModel(
                projectId,
                ideaId,
                store.genCommentId(IdUtil.randomId()),
                parentCommentIds,
                parentCommentIds.size(),
                0,
                IdUtil.randomId(),
                IdUtil.randomId(),
                false,
                Instant.now(),
                null,
                textToSimpleHtml(IdUtil.randomId()),
                0,
                0);
    }

    private IdeaModel createRandomIdea(String projectId) throws Exception {
        IdeaModel idea = MockModelUtil.getRandomIdea().toBuilder()
                .projectId(projectId)
                .ideaId(ideaStore.genIdeaId(" this !@#$%^&*()is my title 9032 " + IdUtil.randomId()))
                .authorIsMod(false)
                .build();
        ideaStore.createIdea(idea).get();
        return idea;
    }
}