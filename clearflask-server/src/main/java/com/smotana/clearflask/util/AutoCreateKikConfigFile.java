// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.util;

import com.smotana.clearflask.core.ServiceInjector;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.io.FileUtils;

import java.io.File;
import java.io.IOException;
import java.net.URL;

@Slf4j
public class AutoCreateKikConfigFile {
    /** @return whether the config file was just created from the template */
    public static boolean run(String configFilePath, ServiceInjector.Environment env) {
        String doCreateEnvVariable = System.getenv("CLEARFLASK_CREATE_SERVER_CONFIG_IF_MISSING");
        if (!"1".equals(doCreateEnvVariable) && !"true".equalsIgnoreCase(doCreateEnvVariable)) {
            return false;
        }

        File file = new File(configFilePath);
        if (file.exists()) {
            return false;
        }

        URL inputUrl;
        switch (env) {
            case DEVELOPMENT_LOCAL:
                inputUrl = Thread.currentThread().getContextClassLoader().getResource("config-local-template.cfg");
                break;
            case PRODUCTION_SELF_HOST:
                inputUrl = Thread.currentThread().getContextClassLoader().getResource("config-selfhost.cfg");
                break;
            case PRODUCTION_PLATFORM:
                inputUrl = Thread.currentThread().getContextClassLoader().getResource("config-platform.cfg");
                break;
            case PRODUCTION_AWS:
            case TEST:
            default:
                log.warn("Could not create default config file, unsupported environment {}", env);
                return false;
        }
        if (inputUrl == null) {
            log.warn("Could not create default config file, can't find it, continuing anyway");
            return false;
        }
        try {
            FileUtils.copyURLToFile(inputUrl, new File(configFilePath));
        } catch (IOException ex) {
            log.warn("Could not create default config file, continuing anyway", ex);
            return false;
        }

        log.info("Auto-created default config file at {}", configFilePath);
        return true;
    }
}
