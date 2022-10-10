// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.testutil;

import com.amazonaws.auth.AWSCredentialsProvider;
import com.amazonaws.auth.AWSStaticCredentialsProvider;
import com.amazonaws.auth.BasicAWSCredentials;
import com.carrotsearch.randomizedtesting.RandomizedRunner;
import com.carrotsearch.randomizedtesting.annotations.ThreadLeakScope;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.util.Modules;
import com.kik.config.ice.ConfigSystem;
import com.smotana.clearflask.billing.KillBillClientProvider;
import com.smotana.clearflask.store.ProjectStore.SearchEngine;
import com.smotana.clearflask.store.elastic.DefaultElasticSearchProvider;
import com.smotana.clearflask.store.mysql.DefaultMysqlProvider;
import com.smotana.clearflask.util.IdUtil;
import lombok.extern.slf4j.Slf4j;
import org.elasticsearch.action.admin.indices.delete.DeleteIndexRequest;
import org.elasticsearch.client.RequestOptions;
import org.elasticsearch.client.RestHighLevelClient;
import org.jooq.DSLContext;
import org.junit.Before;
import org.junit.runner.RunWith;
import org.killbill.billing.client.KillBillHttpClient;
import org.mockito.Mockito;
import org.mockito.internal.stubbing.answers.ThrowsException;

import java.net.ConnectException;
import java.util.Optional;

import static com.carrotsearch.randomizedtesting.annotations.ThreadLeakScope.Scope.NONE;
import static org.junit.Assert.fail;

@Slf4j
@RunWith(RandomizedRunner.class)
@ThreadLeakScope(NONE)
public abstract class AbstractIT extends AbstractTest {

    @Inject
    protected RestHighLevelClient elastic;
    @Inject
    protected KillBillHttpClient kbClient;

    @Override
    protected void configure() {
        super.configure();

        bind(AWSCredentialsProvider.class).toInstance(new AWSStaticCredentialsProvider(new BasicAWSCredentials("", "")));

        Optional<SearchEngine> searchEngineOverrideOpt = Optional.ofNullable(overrideSearchEngine());
        boolean enableElasticClient = searchEngineOverrideOpt.map(SearchEngine::isWriteElastic).orElse(true);
        boolean enableMysqlClient = searchEngineOverrideOpt.map(SearchEngine::isWriteMysql).orElse(true);
        install(Modules.override(
                enableElasticClient ? DefaultElasticSearchProvider.module() : disabledElasticClient(),
                enableMysqlClient ? DefaultMysqlProvider.module() : disabledMysqlClient(),
                KillBillClientProvider.module()
        ).with(new AbstractModule() {
            @Override
            protected void configure() {
                if (enableElasticClient) {
                    install(ConfigSystem.overrideModule(DefaultElasticSearchProvider.Config.class, om -> {
                        om.override(om.id().serviceEndpoint()).withValue("http://localhost:9200");
                    }));
                }
                String apiKey = IdUtil.randomAscId();
                String secretKey = IdUtil.randomId();
                log.info("KillBill test randomized apiKey {} secretKey {}", apiKey, secretKey);
                install(ConfigSystem.overrideModule(KillBillClientProvider.Config.class, om -> {
                    om.override(om.id().host()).withValue("localhost");
                    om.override(om.id().port()).withValue(8082);
                    om.override(om.id().user()).withValue("admin");
                    om.override(om.id().pass()).withValue("password");
                    om.override(om.id().apiKey()).withValue(apiKey);
                    om.override(om.id().apiSecret()).withValue(secretKey);
                    om.override(om.id().requireTls()).withValue(false);
                }));
                if (enableMysqlClient) {
                    String databaseName = "clearflask" + IdUtil.randomId(5);
                    log.info("IT test with mysql database name {}", databaseName);
                    install(ConfigSystem.overrideModule(DefaultMysqlProvider.Config.class, om -> {
                        om.override(om.id().host()).withValue("localhost");
                        om.override(om.id().user()).withValue("root");
                        om.override(om.id().pass()).withValue("killbill");
                        om.override(om.id().databaseName()).withValue(databaseName);
                        om.override(om.id().dropDatabase()).withValue(true);
                    }));
                }
            }
        }));
    }

    private Module disabledMysqlClient() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(DSLContext.class).toInstance(Mockito.mock(DSLContext.class, new ThrowsException(
                        new RuntimeException("Mysql client is disabled, it should never be used")
                )));
            }
        };
    }

    private Module disabledElasticClient() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(RestHighLevelClient.class).toInstance(Mockito.mock(RestHighLevelClient.class, new ThrowsException(
                        new RuntimeException("ElasticSearch client is disabled, it should never be used")
                )));
            }
        };
    }

    @Before
    public void setupAbstractIT() throws Exception {
        try {
            elastic.indices().delete(new DeleteIndexRequest()
                    .indices("_all"), RequestOptions.DEFAULT);
        } catch (ConnectException ex) {
            if ("Connection refused".equals(ex.getMessage())) {
                log.warn("Failed to connect to local ElasticSearch", ex);
                fail("Failed to connect to local ElasticSearch instance for Integration Testing, did you forget to start it?");
            } else {
                throw ex;
            }
        }
    }
}
