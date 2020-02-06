package com.smotana.clearflask.store;

import com.google.common.collect.ImmutableSet;
import com.smotana.clearflask.api.model.Category;
import com.smotana.clearflask.api.model.VersionedConfig;
import com.smotana.clearflask.api.model.VersionedConfigAdmin;
import com.smotana.clearflask.util.IdUtil;

import java.util.Optional;

public interface ProjectStore {

    default String genProjectId() {
        return IdUtil.randomId();
    }

    Optional<Project> getProjectBySlug(String slug, boolean useCache);

    Optional<Project> getProject(String projectId, boolean useCache);

    ImmutableSet<Project> getProjects(ImmutableSet<String> projectIds, boolean useCache);

    Project createProject(String projectId, VersionedConfigAdmin versionedConfigAdmin);

    void updateConfig(String projectId, String previousVersion, VersionedConfigAdmin versionedConfigAdmin);

    interface Project {
        String getProjectId();

        String getVersion();

        VersionedConfig getVersionedConfig();

        VersionedConfigAdmin getVersionedConfigAdmin();

        double getCategoryExpressionWeight(String categoryId, String expression);

        Optional<Category> getCategory(String categoryId);
    }
}
