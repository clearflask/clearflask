// SPDX-FileCopyrightText: 2023 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.util;

import com.google.common.base.Strings;
import com.google.inject.Singleton;
import com.smotana.clearflask.api.model.ConfigAdmin;
import lombok.extern.slf4j.Slf4j;

import java.util.Optional;

@Slf4j
@Singleton
public class ProjectUtil {
    public String getProjectName(ConfigAdmin configAdmin) {
        // If changed, also change in projectUtil.ts
        return Optional.ofNullable(Strings.emptyToNull(configAdmin.getName()))
                .or(() -> Optional.ofNullable(Strings.emptyToNull(configAdmin.getSlug())))
                .or(() -> Optional.ofNullable(Strings.emptyToNull(configAdmin.getDomain())))
                .or(() -> Optional.ofNullable(Strings.emptyToNull(configAdmin.getProjectId())))
                .orElse("Unnamed");
    }
}
