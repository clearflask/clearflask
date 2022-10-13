// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.util;

import com.google.common.collect.ImmutableMap;
import com.google.gson.Gson;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Provider;
import com.google.inject.Singleton;
import com.smotana.clearflask.core.ServiceInjector.Environment;
import com.smotana.clearflask.store.ProjectStore;
import com.smotana.clearflask.store.elastic.ElasticUtil;
import com.smotana.clearflask.store.impl.DynamoElasticIdeaStore;
import com.smotana.clearflask.web.ApiException;
import lombok.extern.slf4j.Slf4j;
import org.elasticsearch.client.RequestOptions;
import org.elasticsearch.client.RestHighLevelClient;
import org.elasticsearch.client.indices.PutMappingRequest;
import org.elasticsearch.common.xcontent.XContentType;

import javax.ws.rs.core.Response;
import java.io.IOException;
import java.util.Optional;

@Slf4j
@Singleton
public class ProjectUpgraderImpl implements ProjectUpgrader {

    public static final long PROJECT_VERSION_LATEST = 2L;

    @Inject
    private Environment env;
    @Inject
    private Gson gson;
    @Inject
    private Provider<RestHighLevelClient> elastic;
    @Inject
    private ElasticUtil elasticUtil;

    public Optional<Long> upgrade(ProjectStore.ProjectModel project) {
        long projectVersion = project.getProjectVersion() == null ? 0L : project.getProjectVersion();

        Optional<Long> updatedVersion = Optional.empty();
        try {

            // Add idea order field
            if (projectVersion <= 0L) {
                elastic.get().indices().putMapping(new PutMappingRequest(elasticUtil.getIndexName(DynamoElasticIdeaStore.IDEA_INDEX, project.getProjectId())).source(gson.toJson(ImmutableMap.of(
                                "properties", ImmutableMap.builder()
                                        .put("order", ImmutableMap.of(
                                                "type", "double"))
                                        .build())), XContentType.JSON),
                        RequestOptions.DEFAULT);
                updatedVersion = Optional.of(1L);
            }

            // Add post's mergedToPostId
            if (projectVersion <= 1L) {
                elastic.get().indices().putMapping(new PutMappingRequest(elasticUtil.getIndexName(DynamoElasticIdeaStore.IDEA_INDEX, project.getProjectId())).source(gson.toJson(ImmutableMap.of(
                                "properties", ImmutableMap.builder()
                                        .put("mergedToPostId", ImmutableMap.of(
                                                "type", "keyword"))
                                        .build())), XContentType.JSON),
                        RequestOptions.DEFAULT);
                updatedVersion = Optional.of(2L);
            }

            // !! IMPORTANT !!:
            // When adding a new upgrade, do the following:
            // - Add the changes for new projects (ie update IdeaStore to create index field)
            // - Add the upgrade for existing projects by copying the template below
            // - ENSURE the upgrade is idempotent
            // - Increment PROJECT_VERSION_LATEST
            // - Add test undo logic in ProjectUpgraderIT
            // - Add test assertion logic in ProjectUpgraderIT

            /* ******** TEMPLATE START ********
            // || list changes here ||
            if (projectVersion <= || 2L match previous version ||){
                elastic.|| perform changes here ||;
                updatedVersion = Optional.of( || 3L increment version by one, should match PROJECT_VERSION_LATEST ||);
            }
            ******** TEMPLATE END ******** */

        } catch (IOException ex) {
            if (LogUtil.rateLimitAllowLog("elasticschemaupgrader-error")) {
                log.error("Failed to upgrade ElasticSearch schema for project {}", project.getProjectId(), ex);
            }
            throw new ApiException(Response.Status.INTERNAL_SERVER_ERROR, "Failed to upgrade project under maintenance");
        }
        if (updatedVersion.orElse(project.getProjectVersion()) != PROJECT_VERSION_LATEST) {
            if (env.isProduction()) {
                if (LogUtil.rateLimitAllowLog("elasticschemaupgrader-not-latest-after-upgrade")) {
                    log.error("Not at latest version after upgrade, most likely a bug, projectId {} projectVersion {} updatedVersion {}",
                            project.getProjectId(), project.getProjectVersion(), updatedVersion);
                }
            } else {
                throw new RuntimeException("Not at latest version after upgrade");
            }
        }
        return updatedVersion;
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(ProjectUpgrader.class).to(ProjectUpgraderImpl.class).asEagerSingleton();
            }
        };
    }
}
