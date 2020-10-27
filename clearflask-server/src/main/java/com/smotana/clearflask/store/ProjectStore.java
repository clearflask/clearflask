package com.smotana.clearflask.store;

import com.google.common.collect.ImmutableSet;
import com.smotana.clearflask.api.model.Category;
import com.smotana.clearflask.api.model.VersionedConfig;
import com.smotana.clearflask.api.model.VersionedConfigAdmin;
import com.smotana.clearflask.store.dynamo.mapper.DynamoTable;
import com.smotana.clearflask.util.IdUtil;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.NonNull;
import lombok.Value;

import java.util.Optional;

import static com.smotana.clearflask.store.dynamo.mapper.DynamoMapper.TableType.Gsi;
import static com.smotana.clearflask.store.dynamo.mapper.DynamoMapper.TableType.Primary;

public interface ProjectStore {

    default String genProjectId(String slug) {
        return IdUtil.contentUnique(slug);
    }

    default String genConfigVersion() {
        return IdUtil.randomAscId();
    }

    Optional<Project> getProjectBySlug(String slug, boolean useCache);

    Optional<Project> getProject(String projectId, boolean useCache);

    ImmutableSet<Project> getProjects(ImmutableSet<String> projectIds, boolean useCache);

    Project createProject(String accountId, String projectId, VersionedConfigAdmin versionedConfigAdmin);

    void updateConfig(String projectId, Optional<String> previousVersion, VersionedConfigAdmin versionedConfigAdmin);

    void deleteProject(String projectId);

    interface Project {
        String getAccountId();

        String getProjectId();

        String getVersion();

        VersionedConfig getVersionedConfig();

        VersionedConfigAdmin getVersionedConfigAdmin();

        double getCategoryExpressionWeight(String categoryId, String expression);

        Optional<Category> getCategory(String categoryId);
    }

    @Value
    @Builder(toBuilder = true)
    @AllArgsConstructor
    @DynamoTable(type = Primary, partitionKeys = "projectId", rangePrefix = "project")
    class ProjectModel {
        @NonNull
        String accountId;

        @NonNull
        String projectId;

        @NonNull
        String version;

        Long schemaVersion;

        @NonNull
        String configJson;
    }

    @Value
    @Builder(toBuilder = true)
    @AllArgsConstructor
    @DynamoTable(type = Primary, partitionKeys = "slug", rangePrefix = "projectIdBySlug")
    @DynamoTable(type = Gsi, indexNumber = 2, partitionKeys = "projectId", rangePrefix = "slugByProjectId")
    class SlugModel {
        @NonNull
        String slug;

        @NonNull
        String projectId;

        /**
         * Only set during migration to phase out an old slug
         */
        Long ttlInEpochSec;
    }
}
