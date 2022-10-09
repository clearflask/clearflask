package com.smotana.clearflask.store.mysql;

import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.name.Names;
import com.google.inject.util.Modules;
import com.kik.config.ice.ConfigSystem;
import com.smotana.clearflask.store.ContentStore;
import com.smotana.clearflask.store.ProjectStore;
import com.smotana.clearflask.store.VoteStore;
import com.smotana.clearflask.store.dynamo.InMemoryDynamoDbProvider;
import com.smotana.clearflask.store.dynamo.SingleTableProvider;
import com.smotana.clearflask.store.impl.DynamoElasticAccountStore;
import com.smotana.clearflask.store.impl.DynamoElasticCommentStore;
import com.smotana.clearflask.store.impl.DynamoElasticIdeaStore;
import com.smotana.clearflask.store.impl.DynamoElasticUserStore;
import com.smotana.clearflask.testutil.AbstractIT;
import com.smotana.clearflask.util.DefaultServerSecret;
import com.smotana.clearflask.util.IntercomUtil;
import com.smotana.clearflask.util.ProjectUpgrader;
import com.smotana.clearflask.util.ServerSecretTest;
import com.smotana.clearflask.web.security.Sanitizer;
import com.smotana.clearflask.web.util.WebhookService;
import lombok.extern.slf4j.Slf4j;
import org.jooq.codegen.GenerationTool;
import org.jooq.meta.jaxb.Configuration;
import org.jooq.meta.jaxb.Database;
import org.jooq.meta.jaxb.ForcedType;
import org.jooq.meta.jaxb.Generator;
import org.jooq.meta.jaxb.Jdbc;
import org.jooq.meta.jaxb.Logging;
import org.jooq.meta.jaxb.OnError;
import org.jooq.meta.jaxb.Strategy;
import org.jooq.meta.jaxb.Target;
import org.junit.Test;

import java.nio.file.Path;
import java.time.Instant;

import static org.junit.Assert.assertTrue;

@Slf4j
public class JooqCodegenIT extends AbstractIT {

    @Inject
    private DefaultMysqlProvider.Config configMysql;

    @Override
    protected ProjectStore.SearchEngine overrideSearchEngine() {
        return ProjectStore.SearchEngine.READ_MYSQL_WRITE_BOTH;
    }

    @Override
    protected void configure() {
        super.configure();

        bindMock(ContentStore.class);
        bindMock(WebhookService.class);
        bindMock(ProjectUpgrader.class);
        bindMock(VoteStore.class);
        bindMock(ProjectStore.class);

        install(Modules.override(
                DynamoElasticIdeaStore.module(),
                DynamoElasticAccountStore.module(),
                DynamoElasticUserStore.module(),
                DynamoElasticCommentStore.module(),
                InMemoryDynamoDbProvider.module(),
                SingleTableProvider.module(),
                Sanitizer.module(),
                IntercomUtil.module(),
                DefaultServerSecret.module(Names.named("cursor"))
        ).with(new AbstractModule() {
            @Override
            protected void configure() {
                install(ConfigSystem.overrideModule(DefaultServerSecret.Config.class, Names.named("cursor"), om -> {
                    om.override(om.id().sharedKey()).withValue(ServerSecretTest.getRandomSharedKey());
                }));
            }
        }));
    }

    @Test(timeout = 30_000L)
    public void generate() throws Exception {
        Path sourcesPath = Path.of("src", "main", "java");
        assertTrue(sourcesPath.toFile().isDirectory());
        GenerationTool.generate(new Configuration()
                .withJdbc(new Jdbc()
                        .withDriver("com.mysql.cj.jdbc.Driver")
                        .withUrl("jdbc:mysql://" + configMysql.host() + ":" + configMysql.port() + "/" + configMysql.databaseName())
                        .withUser(configMysql.user())
                        .withPassword(configMysql.pass()))
                .withGenerator(new Generator()
                        .withName(CfJavaGenerator.class.getCanonicalName())
                        .withStrategy(new Strategy()
                                .withName(CfGeneratorStrategy.class.getCanonicalName()))
                        .withDatabase(new Database()
                                .withName("org.jooq.meta.mysql.MySQLDatabase")
                                .withInputSchema(configMysql.databaseName())
                                .withOutputSchema("clearflask")
                                .withOutputSchemaToDefault(true)
                                .withIncludes(".*")
                                .withForcedTypes(
                                        new ForcedType()
                                                .withUserType(Instant.class.getCanonicalName())
                                                .withIncludeTypes("(?i:DATETIME)")
                                                .withBinding(LocalDateTimeToInstantBinding.class.getCanonicalName()),
                                        new ForcedType()
                                                .withName("BOOLEAN")
                                                .withIncludeTypes("(?i:TINYINT\\(1\\))")))
                        .withTarget(new Target()
                                .withDirectory(sourcesPath.toAbsolutePath().toString())
                                .withPackageName("com.smotana.clearflask.store.mysql.model")
                                .withClean(true)))
                .withLogging(Logging.TRACE)
                .withOnError(OnError.FAIL));
    }
}