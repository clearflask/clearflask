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
import com.google.common.collect.ImmutableSet;
import com.google.inject.Inject;
import com.smotana.clearflask.api.model.VersionedConfigAdmin;
import com.smotana.clearflask.store.dynamo.InMemoryDynamoDbProvider;
import com.smotana.clearflask.testutil.AbstractTest;
import com.smotana.clearflask.util.IdUtil;
import com.smotana.clearflask.util.ModelUtil;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.NonNull;
import lombok.Value;
import lombok.extern.slf4j.Slf4j;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.junit.runners.Parameterized;
import org.junit.runners.Parameterized.Parameters;

import java.nio.ByteBuffer;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Arrays;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.junit.Assert.assertEquals;

@Slf4j
@RunWith(Parameterized.class)
public class DynamoMapperTest extends AbstractTest {

    private static final String TEST_TABLE = "test";

    @Inject
    private DynamoMapper mapper;
    @Inject
    private AmazonDynamoDB dynamo;
    @Inject
    private DynamoDB dynamoDoc;

    private Table testTable;

    private final String fieldName;
    private final Object example;

    @Value
    @Builder(toBuilder = true)
    @AllArgsConstructor
    public static class Data {
        @NonNull
        private final String id;
        private final Date date;
        private final Boolean boolObj;
        private final boolean boolPri;
        private final byte bytePri;
        private final Byte byteObj;
        private final short shortPri;
        private final Short shortObj;
        private final int intPri;
        private final Integer integer;
        private final long longPri;
        private final Long longObj;
        private final float floatPri;
        private final Float floatObj;
        private final double doublePri;
        private final Double doubleObj;
        private final String String;
        private final UUID UUID;
        private final ByteBuffer ByteBuffer;
        private final byte[] byteArray;
        private final Byte[] byteArrayObj;
        private final Instant instant;
        private final VersionedConfigAdmin versionedConfigAdmin;
        private final List<UUID> list;
        private final Map<String, Boolean> map;
        private final Set<Instant> set;
        private final ImmutableList<String> immutableList;
        private final ImmutableMap<String, Long> immutableMap;
        private final ImmutableSet<String> immutableSet;
    }

    @Parameters(name = "{0} {1}")
    public static Iterable<Object[]> data() {
        return Arrays.asList(new Object[][]{
                {"date", Date.from(Instant.now().plus(300, ChronoUnit.DAYS))},
                {"boolObj", Boolean.TRUE},
                {"boolPri", true},
                {"bytePri", (byte) 7},
                {"byteObj", (byte) 7},
                {"shortPri", (short) 7},
                {"shortObj", (short) 7},
                {"intPri", 7},
                {"integer", 7},
                {"longPri", 7L},
                {"longObj", 7L},
                {"floatPri", 7f},
                {"floatObj", 7f},
                {"doublePri", 7.7d},
                {"doubleObj", 7.7d},
                {"String", "myString 123"},
                {"UUID", UUID.randomUUID()},
                {"ByteBuffer", ByteBuffer.wrap(new byte[]{6, 2, -34, 127})},
                {"byteArray", new byte[]{6, 2, -34, 127}},
                {"byteArrayObj", new Byte[]{6, 2, -34, 127}},
                {"instant", Instant.now().plus(300, ChronoUnit.DAYS)},
                {"versionedConfigAdmin", ModelUtil.createEmptyConfig("myProjectId")},
                {"list", ImmutableList.of(UUID.randomUUID(), UUID.randomUUID())},
                {"map", ImmutableMap.of("a", true, "c", false, "b", true)},
                {"set", ImmutableSet.of(Instant.now(), Instant.now().plus(1, ChronoUnit.HOURS), Instant.now().minus(3, ChronoUnit.SECONDS))},
                {"immutableList", ImmutableList.of("a", "c", "b")},
                {"immutableMap", ImmutableMap.of("a", 1L, "c", 3L, "b", 2L)},
                {"immutableSet", ImmutableSet.of("a", "c", "b")},
                {"immutableList", ImmutableList.of()},
                {"immutableMap", ImmutableMap.of()},
                {"immutableSet", ImmutableSet.of()}
        });
    }

    public DynamoMapperTest(String fieldName, Object example) {
        this.fieldName = fieldName;
        this.example = example;
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

        Item itemActual = testTable.getItem("id", dataExpected.getId());
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
                .withKey(ImmutableMap.of("id", new AttributeValue(dataExpected.getId()))))
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
                .withKey(ImmutableMap.of("id", new AttributeValue(dataExpected.getId()))))
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


        Item itemActual = testTable.getItem("id", dataExpected.getId());
        Data dataActual = mapper.fromItem(itemActual, dataExpected.getClass());

        assertEquals(dataExpected, dataActual);
    }

    private Data getExpectedData() throws Exception {
        Data.DataBuilder dataBuilder = Data.builder();
        dataBuilder.id(IdUtil.randomId());
        Arrays.stream(dataBuilder.getClass().getMethods())
                .filter(m -> m.getName().equals(fieldName))
                .findAny()
                .get()
                .invoke(dataBuilder, example);
        Data dataExpected = dataBuilder.build();
        return dataExpected;
    }
}
