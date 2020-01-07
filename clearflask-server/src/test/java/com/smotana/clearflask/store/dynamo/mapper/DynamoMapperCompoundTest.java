package com.smotana.clearflask.store.dynamo.mapper;

import com.amazonaws.services.dynamodbv2.AmazonDynamoDB;
import com.amazonaws.services.dynamodbv2.document.DynamoDB;
import com.amazonaws.services.dynamodbv2.document.Item;
import com.amazonaws.services.dynamodbv2.document.Table;
import com.amazonaws.services.dynamodbv2.model.AttributeDefinition;
import com.amazonaws.services.dynamodbv2.model.AttributeValue;
import com.amazonaws.services.dynamodbv2.model.BillingMode;
import com.amazonaws.services.dynamodbv2.model.CreateTableRequest;
import com.amazonaws.services.dynamodbv2.model.GetItemRequest;
import com.amazonaws.services.dynamodbv2.model.KeySchemaElement;
import com.amazonaws.services.dynamodbv2.model.KeyType;
import com.amazonaws.services.dynamodbv2.model.PutItemRequest;
import com.amazonaws.services.dynamodbv2.model.ScalarAttributeType;
import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableMap;
import com.google.inject.Inject;
import com.smotana.clearflask.store.dynamo.InMemoryDynamoDbProvider;
import com.smotana.clearflask.testutil.AbstractTest;
import lombok.AllArgsConstructor;
import lombok.NonNull;
import lombok.Value;
import lombok.extern.slf4j.Slf4j;
import org.junit.Before;
import org.junit.Test;

import java.util.Map;

import static com.smotana.clearflask.util.StringSerdeUtil.DELIMITER;
import static com.smotana.clearflask.util.StringSerdeUtil.ESCAPER;
import static org.junit.Assert.assertEquals;

@Slf4j
public class DynamoMapperCompoundTest extends AbstractTest {

    private static final String TEST_TABLE = "test";

    @Inject
    private DynamoMapper mapper;
    @Inject
    private AmazonDynamoDB dynamo;
    @Inject
    private DynamoDB dynamoDoc;

    private Table testTable;

    @Value
    @AllArgsConstructor
    @CompoundPrimaryKey(key = "id", primaryKeys = {"id1", "id2", "id3"})
    public static class Data {
        @NonNull
        private final String id1;
        @NonNull
        private final String id2;
        @NonNull
        private final String id3;
        private final String content;
    }

    @Before
    public void setup() {
        super.setup();

        dynamo.createTable(new CreateTableRequest()
                .withTableName(TEST_TABLE)
                .withKeySchema(ImmutableList.of(
                        new KeySchemaElement().withAttributeName("id").withKeyType(KeyType.HASH)))
                .withAttributeDefinitions(ImmutableList.of(
                        new AttributeDefinition().withAttributeName("id").withAttributeType(ScalarAttributeType.S)))
                .withBillingMode(BillingMode.PAY_PER_REQUEST));
        testTable = dynamoDoc.getTable(TEST_TABLE);
    }


    @Override
    protected void configure() {
        super.configure();

        install(InMemoryDynamoDbProvider.module());
        install(DynamoMapperImpl.module());
    }

    @Test(timeout = 20_000L)
    public void fromItemToItem() throws Exception {
        Data dataExpected = getExpectedData();

        Item itemExpected = mapper.toItem(dataExpected);
        testTable.putItem(itemExpected);

        Item itemActual = testTable.getItem("id", mapper.getCompoundPrimaryKey(ImmutableMap.of(
                "id1", dataExpected.getId1(),
                "id2", dataExpected.getId2(),
                "id3", dataExpected.getId3()
        ), Data.class));
        Data dataActual = mapper.fromItem(itemActual, dataExpected.getClass());

        assertEquals(dataExpected, dataActual);
    }


    @Test(timeout = 20_000L)
    public void fromAttrMapToAttrMap() throws Exception {
        Data dataExpected = getExpectedData();

        ImmutableMap<String, AttributeValue> attrMapExpected = mapper.toAttrMap(dataExpected);
        dynamo.putItem(new PutItemRequest()
                .withTableName(TEST_TABLE)
                .withItem(attrMapExpected));

        Map<String, AttributeValue> attrMapActual = dynamo.getItem(new GetItemRequest()
                .withTableName(TEST_TABLE)
                .withKey(ImmutableMap.of("id", new AttributeValue(mapper.getCompoundPrimaryKey(ImmutableMap.of(
                        "id1", dataExpected.getId1(),
                        "id2", dataExpected.getId2(),
                        "id3", dataExpected.getId3()
                ), Data.class)))))
                .getItem();
        Data dataActual = mapper.fromAttrMap(attrMapActual, dataExpected.getClass());

        assertEquals(dataExpected, dataActual);
    }


    @Test(timeout = 20_000L)
    public void fromItemToAttrMap() throws Exception {
        Data dataExpected = getExpectedData();

        Item itemExpected = mapper.toItem(dataExpected);
        testTable.putItem(itemExpected);

        Map<String, AttributeValue> attrMapActual = dynamo.getItem(new GetItemRequest()
                .withTableName(TEST_TABLE)
                .withKey(ImmutableMap.of("id", new AttributeValue(mapper.getCompoundPrimaryKey(ImmutableMap.of(
                        "id1", dataExpected.getId1(),
                        "id2", dataExpected.getId2(),
                        "id3", dataExpected.getId3()
                ), Data.class)))))
                .getItem();
        Data dataActual = mapper.fromAttrMap(attrMapActual, dataExpected.getClass());

        assertEquals(dataExpected, dataActual);
    }

    @Test(timeout = 20_000L)
    public void fromAttrMapToItem() throws Exception {
        Data dataExpected = getExpectedData();

        ImmutableMap<String, AttributeValue> attrMapExpected = mapper.toAttrMap(dataExpected);
        dynamo.putItem(new PutItemRequest()
                .withTableName(TEST_TABLE)
                .withItem(attrMapExpected));


        Item itemActual = testTable.getItem("id", mapper.getCompoundPrimaryKey(ImmutableMap.of(
                "id1", dataExpected.getId1(),
                "id2", dataExpected.getId2(),
                "id3", dataExpected.getId3()
        ), Data.class));
        Data dataActual = mapper.fromItem(itemActual, dataExpected.getClass());

        assertEquals(dataExpected, dataActual);
    }

    private Data getExpectedData() throws Exception {
        return new Data(
                ESCAPER + DELIMITER + "asddsa" + ESCAPER + ESCAPER,
                ESCAPER + ESCAPER + "asdaddas" + DELIMITER + DELIMITER,
                DELIMITER + DELIMITER + DELIMITER + "asdaa" + ESCAPER + ESCAPER + DELIMITER + DELIMITER + "ddsa" + DELIMITER,
                "content");
    }
}
