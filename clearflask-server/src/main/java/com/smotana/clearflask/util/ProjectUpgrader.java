// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.util;

import com.smotana.clearflask.store.ProjectStore.ProjectModel;

import java.util.Optional;

public interface ProjectUpgrader {
    Optional<Long> upgrade(ProjectModel project);
}
