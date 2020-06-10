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

    default String genProjectId() {
        return IdUtil.randomId();
    }

    Optional<Project> getProjectBySlug(String slug, boolean useCache);

    Optional<Project> getProject(String projectId, boolean useCache);

    ImmutableSet<Project> getProjects(ImmutableSet<String> projectIds, boolean useCache);

    Project createProject(String projectId, VersionedConfigAdmin versionedConfigAdmin);

    void updateConfig(String projectId, Optional<String> previousVersion, VersionedConfigAdmin versionedConfigAdmin);

    void deleteProject(String projectId);

    interface Project {
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
        private final String projectId;

        @NonNull
        private final String version;

        @NonNull
        private final String configJson;
    }

    @Value
    @Builder(toBuilder = true)
    @AllArgsConstructor
    @DynamoTable(type = Primary, partitionKeys = "slug", rangePrefix = "projectIdBySlug")
    @DynamoTable(type = Gsi, indexNumber = 2, partitionKeys = "projectId", rangePrefix = "slugByProjectId")
    class SlugModel {
        @NonNull
        private final String slug;

        @NonNull
        private final String projectId;
    }
}
