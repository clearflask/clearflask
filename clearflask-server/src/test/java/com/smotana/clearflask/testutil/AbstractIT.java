package com.smotana.clearflask.testutil;

import com.carrotsearch.randomizedtesting.RandomizedRunner;
import com.carrotsearch.randomizedtesting.annotations.ThreadLeakScope;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.util.Modules;
import com.kik.config.ice.ConfigSystem;
import com.smotana.clearflask.store.elastic.DefaultElasticSearchProvider;
import lombok.extern.slf4j.Slf4j;
import org.elasticsearch.action.admin.indices.delete.DeleteIndexRequest;
import org.elasticsearch.client.RequestOptions;
import org.elasticsearch.client.RestHighLevelClient;
import org.junit.Before;
import org.junit.runner.RunWith;

import java.net.ConnectException;

import static com.carrotsearch.randomizedtesting.annotations.ThreadLeakScope.Scope.NONE;
import static org.junit.Assert.fail;

@Slf4j
@RunWith(RandomizedRunner.class)
@ThreadLeakScope(NONE)
public abstract class AbstractIT extends AbstractTest {

    @Inject
    protected RestHighLevelClient elastic;

    @Override
    protected void configure() {
        super.configure();

        install(Modules.override(
                DefaultElasticSearchProvider.module()
        ).with(new AbstractModule() {
            @Override
            protected void configure() {
                install(ConfigSystem.overrideModule(DefaultElasticSearchProvider.Config.class, om -> {
                    om.override(om.id().serviceEndpoint()).withValue("localhost:9200");
                }));
            }
        }));
    }

    @Before
    public void clearElasticIndices() throws Exception {
        try {
            elastic.indices().delete(new DeleteIndexRequest()
                    .indices("_all"), RequestOptions.DEFAULT);
        } catch (ConnectException ex) {
            if ("Connection refused".equals(ex.getMessage())) {
                log.error("Failed to connect to local ElasticSearch", ex);
                fail("Failed to connect to local ElasticSearch instance for Integration Testing, did you forget to start it?");
            } else {
                throw ex;
            }
        }
    }
}
