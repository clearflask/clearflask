package com.smotana.clearflask.util;

import com.smotana.clearflask.store.ProjectStore.ProjectModel;

import java.util.Optional;

public interface ProjectUpgrader {
    Optional<Long> upgrade(ProjectModel project);
}
