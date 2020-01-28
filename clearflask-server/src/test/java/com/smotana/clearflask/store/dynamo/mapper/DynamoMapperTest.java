package com.smotana.clearflask.store.dynamo.mapper;

import com.amazonaws.services.dynamodbv2.AmazonDynamoDB;
import com.amazonaws.services.dynamodbv2.document.DynamoDB;
import com.amazonaws.services.dynamodbv2.document.Table;
import com.amazonaws.services.dynamodbv2.document.spec.PutItemSpec;
import com.amazonaws.services.dynamodbv2.model.ReturnValue;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.util.Modules;
import com.kik.config.ice.ConfigSystem;
import com.smotana.clearflask.store.dynamo.InMemoryDynamoDbProvider;
import com.smotana.clearflask.store.dynamo.mapper.DynamoMapper.IndexSchema;
import com.smotana.clearflask.store.dynamo.mapper.DynamoMapper.TableSchema;
import com.smotana.clearflask.testutil.AbstractTest;
import lombok.AllArgsConstructor;
import lombok.NonNull;
import lombok.Value;
import lombok.extern.slf4j.Slf4j;
import org.junit.Test;

import java.time.Instant;
import java.util.Optional;
import java.util.stream.StreamSupport;

import static com.smotana.clearflask.store.dynamo.mapper.DynamoMapper.TableType.*;
import static org.junit.Assert.assertEquals;

@Slf4j
public class DynamoMapperTest extends AbstractTest {

    private static final String TEST_TABLE = "test";

    @Inject
    private DynamoMapper mapper;
    @Inject
    private AmazonDynamoDB dynamo;
    @Inject
    private DynamoDB dynamoDoc;

    private Table testTable;

    @Override
    protected void configure() {
        super.configure();

        install(Modules.override(
                InMemoryDynamoDbProvider.module(),
                DynamoMapperImpl.module()
        ).with(new AbstractModule() {
            @Override
            protected void configure() {
                install(ConfigSystem.overrideModule(DynamoMapperImpl.Config.class, om -> {
                    om.override(om.id().createTables()).withValue(true);
                    om.override(om.id().lsiCount()).withValue(2L);
                    om.override(om.id().gsiCount()).withValue(2L);
                }));
            }
        }));
    }

    @Value
    @AllArgsConstructor
    @DynamoTable(type = Primary, partitionKeys = {"f1", "f2"}, rangePrefix = "prefix1", rangeKeys = {"f3", "f4", "f5"})
    @DynamoTable(type = Lsi, indexNumber = 1, partitionKeys = {"f1", "f2"}, rangeKeys = {"f5", "f6"})
    @DynamoTable(type = Gsi, indexNumber = 1, partitionKeys = {"f3", "f4", "f5"}, rangePrefix = "prefix2", rangeKeys = {"f1", "f2"})
    @DynamoTable(type = Gsi, indexNumber = 2, partitionKeys = {"f1", "f3"}, rangeKeys = {"f2", "f4"})
    public static class Data {
        @NonNull
        private final String f1;
        @NonNull
        private final long f2;
        @NonNull
        private final String f3;
        @NonNull
        private final Integer f4;
        @NonNull
        private final Instant f5;
        @NonNull
        private final String f6;
    }

    @Test(timeout = 20_000L)
    public void test() throws Exception {
        TableSchema<Data> primary = mapper.parseTableSchema(Data.class);
        IndexSchema<Data> lsi1 = mapper.parseLocalSecondaryIndexSchema(1, Data.class);
        IndexSchema<Data> gsi1 = mapper.parseGlobalSecondaryIndexSchema(1, Data.class);
        IndexSchema<Data> gsi2 = mapper.parseGlobalSecondaryIndexSchema(2, Data.class);


        Data data = new Data("f1", 2L, "f3", 4, Instant.ofEpochMilli(5), "f6");

        log.info("Table description {}", primary.table().describe());
        log.info("primary.toItem(data) {}", primary.toItem(data));
        log.info("primary.primaryKey(data) {}", primary.primaryKey(data));
        assertEquals(null, primary.fromItem(primary.table().putItem(new PutItemSpec()
                .withItem(primary.toItem(data)).withReturnValues(ReturnValue.ALL_OLD)).getItem()));
        assertEquals(data, primary.fromItem(primary.table().getItem(primary.primaryKey(data))));
        assertEquals(Optional.of(data), StreamSupport.stream(lsi1.index().query(lsi1.partitionKey(data)).pages().spliterator(), false).flatMap(p -> StreamSupport.stream(p.spliterator(), false)).map(lsi1::fromItem).findAny());
        assertEquals(Optional.of(data), StreamSupport.stream(gsi1.index().query(gsi1.partitionKey(data)).pages().spliterator(), false).flatMap(p -> StreamSupport.stream(p.spliterator(), false)).map(gsi1::fromItem).findAny());
        assertEquals(Optional.of(data), StreamSupport.stream(gsi2.index().query(gsi2.partitionKey(data)).pages().spliterator(), false).flatMap(p -> StreamSupport.stream(p.spliterator(), false)).map(gsi2::fromItem).findAny());
    }
}
