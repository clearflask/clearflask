// SPDX-FileCopyrightText: 2019-2026 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.store.dynamo;

import com.amazonaws.auth.AWSStaticCredentialsProvider;
import com.amazonaws.auth.BasicAWSCredentials;
import com.amazonaws.client.builder.AwsClientBuilder;
import com.amazonaws.services.dynamodbv2.AmazonDynamoDB;
import com.amazonaws.services.dynamodbv2.AmazonDynamoDBClientBuilder;
import com.amazonaws.services.dynamodbv2.local.main.ServerRunner;
import com.amazonaws.services.dynamodbv2.local.server.DynamoDBProxyServer;
import com.google.common.base.Strings;
import com.google.inject.*;
import com.google.inject.Module;
import com.google.inject.multibindings.Multibinder;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.smotana.clearflask.core.ManagedService;
import lombok.extern.slf4j.Slf4j;

import java.io.File;
import java.util.Optional;

/**
 * Provides an {@link AmazonDynamoDB} backed by AWS's DynamoDB Local running in-process, persisting
 * to a file on disk. Used by the platform-hosting deployment (PRODUCTION_PLATFORM) so a one-click
 * marketplace deploy needs no external DynamoDB.
 *
 * IMPORTANT: unlike {@code DynamoDBEmbedded.create()} (in-memory, used in tests), this runs the
 * DynamoDB Local server in {@code -dbPath <dir> -sharedDb} mode so data survives restarts. The
 * sqlite file under {@code dbPath} is the source-of-truth datastore: single-writer, single-instance,
 * and must live on a persistent mounted volume with backups.
 */
@Slf4j
@Singleton
public class EmbeddedDynamoDbProvider extends ManagedService implements Provider<AmazonDynamoDB> {

    public interface Config {
        /** Directory holding the persistent DynamoDB Local sqlite file; must be a mounted volume. */
        @DefaultValue("/opt/clearflask/dynamo")
        String dbPath();

        /** Local loopback port the in-process DynamoDB Local server listens on. */
        @DefaultValue("8000")
        String port();

        /**
         * Directory containing the sqlite4java native libraries. Set as the
         * {@code sqlite4java.library.path} system property before the server starts. Empty leaves any
         * externally-provided system property in place.
         */
        @DefaultValue("/opt/clearflask/native-libs")
        String nativeLibsPath();
    }

    @Inject
    private Config config;

    private Optional<DynamoDBProxyServer> serverOpt = Optional.empty();
    private Optional<AmazonDynamoDB> amazonDynamoDBOpt = Optional.empty();

    @Override
    public AmazonDynamoDB get() {
        if (!Strings.isNullOrEmpty(config.nativeLibsPath())) {
            System.setProperty("sqlite4java.library.path", config.nativeLibsPath());
        }
        try {
            File dbDir = new File(config.dbPath());
            if (!dbDir.exists() && !dbDir.mkdirs()) {
                throw new ProvisionException("Failed to create DynamoDB data dir " + config.dbPath());
            }
            log.info("Starting embedded file-backed DynamoDB on port {} at {}", config.port(), config.dbPath());
            DynamoDBProxyServer server = ServerRunner.createServerFromCommandLineArgs(new String[]{
                    "-dbPath", config.dbPath(),
                    "-sharedDb",
                    "-port", config.port(),
            });
            server.start();
            serverOpt = Optional.of(server);
        } catch (Exception ex) {
            throw new ProvisionException("Failed to start embedded DynamoDB", ex);
        }

        AmazonDynamoDB amazonDynamoDB = AmazonDynamoDBClientBuilder.standard()
                .withEndpointConfiguration(new AwsClientBuilder.EndpointConfiguration(
                        "http://localhost:" + config.port(), "us-east-1"))
                .withCredentials(new AWSStaticCredentialsProvider(new BasicAWSCredentials("local", "local")))
                .build();
        amazonDynamoDBOpt = Optional.of(amazonDynamoDB);
        return amazonDynamoDB;
    }

    @Override
    protected void serviceStop() throws Exception {
        amazonDynamoDBOpt.ifPresent(AmazonDynamoDB::shutdown);
        if (serverOpt.isPresent()) {
            try {
                serverOpt.get().stop();
            } catch (Exception ex) {
                log.warn("Failed to stop embedded DynamoDB cleanly", ex);
            }
        }
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(AmazonDynamoDB.class).toProvider(EmbeddedDynamoDbProvider.class).asEagerSingleton();
                Multibinder.newSetBinder(binder(), ManagedService.class).addBinding().to(EmbeddedDynamoDbProvider.class).asEagerSingleton();
                install(ConfigSystem.configModule(Config.class));

                install(DocumentDynamoDbProvider.module());
            }
        };
    }
}
