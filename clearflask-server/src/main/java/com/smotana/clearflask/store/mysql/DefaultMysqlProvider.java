// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.store.mysql;

import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Provider;
import com.google.inject.ProvisionException;
import com.google.inject.Singleton;
import com.google.inject.multibindings.Multibinder;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.kik.config.ice.annotations.NoDefaultValue;
import com.mysql.cj.jdbc.MysqlDataSource;
import com.smotana.clearflask.core.ManagedService;
import com.smotana.clearflask.core.ServiceInjector.Environment;
import com.smotana.clearflask.util.Extern;
import com.smotana.clearflask.util.NetworkUtil;
import com.smotana.clearflask.web.Application;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.jooq.CloseableDSLContext;
import org.jooq.DSLContext;
import org.jooq.SQLDialect;
import org.jooq.impl.DSL;

import java.io.IOException;
import java.util.Optional;

@Slf4j
@Singleton
public class DefaultMysqlProvider extends ManagedService implements Provider<DSLContext> {

    public interface Config {
        @NoDefaultValue
        String host();

        @DefaultValue("3306")
        int port();

        @NoDefaultValue
        String user();

        @NoDefaultValue
        String pass();

        @DefaultValue("clearflask")
        String databaseName();

        /** For testing only */
        @DefaultValue("false")
        boolean dropDatabase();
    }

    @Inject
    private Config config;
    @Inject
    private Application.Config configApp;
    @Inject
    private Environment env;

    private Optional<DSLContext> clientOpt = Optional.empty();

    @SneakyThrows
    @Override
    public DSLContext get() {
        if (configApp.startupWaitUntilDeps()) {
            log.info("Waiting for Mysql to be up {}:{}", config.host(), config.port());
            try {
                NetworkUtil.waitUntilPortOpen(config.host(), config.port());
            } catch (IOException ex) {
                throw new ProvisionException("Failed to wait until Mysql port opened", ex);
            }
        }
        log.info("Opening Mysql client on {}:{}", config.host(), config.port());

        if (clientOpt.isEmpty()) {
            Class.forName("com.mysql.cj.jdbc.Driver");
            System.setProperty("org.jooq.no-logo", "true");
            MysqlDataSource dataSource = new MysqlDataSource();
            dataSource.setURL(getConnectionUrl(true));
            dataSource.setPassword(config.pass());
            dataSource.setUser(config.user());
            dataSource.setDatabaseName(config.databaseName());
            clientOpt = Optional.of(DSL.using(dataSource, SQLDialect.MYSQL));
        }

        return clientOpt.get();
    }

    @Override
    protected void serviceStart() throws Exception {
        if (configApp.createIndexesOnStartup() && configApp.defaultSearchEngine().isWriteMysql()) {
            createDatabase();
        }
    }

    @Override
    protected void serviceStop() throws Exception {
        if (config.dropDatabase() && configApp.defaultSearchEngine().isWriteMysql()) {
            if (env.isProduction()) {
                log.error("Refusing to drop database in production");
            } else {
                try (CloseableDSLContext context = DSL.using(getConnectionUrl(false), config.user(), config.pass())) {
                    context.dropDatabase(config.databaseName()).execute();
                }
            }
        }
    }

    @Extern
    public void createDatabase() throws Exception {
        try (CloseableDSLContext context = DSL.using(getConnectionUrl(false), config.user(), config.pass())) {
            context.createDatabaseIfNotExists(config.databaseName()).execute();
        }
    }

    private String getConnectionUrl(boolean includeDatabase) {
        String url = "jdbc:mysql://" + config.host() + ":" + config.port();
        return !includeDatabase ? url
                : url + "/" + config.databaseName();
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(DSLContext.class).toProvider(DefaultMysqlProvider.class).asEagerSingleton();
                install(ConfigSystem.configModule(Config.class));
                Multibinder.newSetBinder(binder(), ManagedService.class).addBinding().to(DefaultMysqlProvider.class).asEagerSingleton();
            }
        };
    }
}
