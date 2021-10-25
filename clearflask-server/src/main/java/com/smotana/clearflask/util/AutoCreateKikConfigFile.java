package com.smotana.clearflask.util;

import com.smotana.clearflask.core.ServiceInjector;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.io.FileUtils;

import java.io.File;
import java.io.IOException;
import java.net.URL;

@Slf4j
public class AutoCreateKikConfigFile {
    public static void run(String configFilePath, ServiceInjector.Environment env) {
        String doCreateEnvVariable = System.getenv("CLEARFLASK_CREATE_SERVER_CONFIG_IF_MISSING");
        if (!"1".equals(doCreateEnvVariable) && !"true".equalsIgnoreCase(doCreateEnvVariable)) {
            return;
        }

        File file = new File(configFilePath);
        if (file.exists()) {
            return;
        }

        URL inputUrl;
        switch (env) {
            case DEVELOPMENT_LOCAL:
                inputUrl = Thread.currentThread().getContextClassLoader().getResource("config-local-template.cfg");
                break;
            case PRODUCTION_SELF_HOST:
                inputUrl = Thread.currentThread().getContextClassLoader().getResource("config-selfhost.cfg");
                break;
            case PRODUCTION_AWS:
            case TEST:
            default:
                log.warn("Could not create default config file, unsupported environment {}", env);
                return;
        }
        if (inputUrl == null) {
            log.warn("Could not create default config file, can't find it, continuing anyway");
            return;
        }
        try {
            FileUtils.copyURLToFile(inputUrl, new File(configFilePath));
        } catch (IOException ex) {
            log.warn("Could not create default config file, continuing anyway", ex);
            return;
        }

        log.info("Auto-created default config file at {}", configFilePath);
    }
}
