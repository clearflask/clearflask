package com.smotana.clearflask.store;

import com.smotana.clearflask.api.model.VersionedConfigAdmin;

import java.util.Optional;

public interface ProjectStore {

    Optional<VersionedConfigAdmin> getConfig(String projectId, boolean useCache);

    void createConfig(String projectId, VersionedConfigAdmin versionedConfigAdmin);

    void updateConfig(String projectId, String previousVersion, VersionedConfigAdmin versionedConfigAdmin);
}
