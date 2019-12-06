package com.smotana.clearflask.store;

import com.google.common.collect.ImmutableSet;
import com.smotana.clearflask.api.model.VersionedConfig;
import com.smotana.clearflask.api.model.VersionedConfigAdmin;

import java.util.Optional;

public interface ProjectStore {

    Optional<VersionedConfig> getConfig(String projectId, boolean useCache);

    Optional<VersionedConfigAdmin> getConfigAdmin(String projectId);

    ImmutableSet<VersionedConfigAdmin> getConfigAdmins(ImmutableSet<String> projectIds);

    void createConfig(String projectId, VersionedConfigAdmin versionedConfigAdmin);

    void updateConfig(String projectId, String previousVersion, VersionedConfigAdmin versionedConfigAdmin);
}
