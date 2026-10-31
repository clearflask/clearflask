// SPDX-FileCopyrightText: 2019-2026 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.store.impl;

import com.amazonaws.services.dynamodbv2.AmazonDynamoDB;
import com.amazonaws.services.dynamodbv2.document.DynamoDB;
import com.amazonaws.services.dynamodbv2.model.*;
import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableMap;
import com.google.common.collect.ImmutableSet;
import com.smotana.clearflask.store.UserStore.UserModel;
import com.smotana.clearflask.util.GsonProvider;
import io.dataspray.singletable.SingleTable;
import io.dataspray.singletable.TableSchema;
import org.junit.Before;
import org.junit.Test;

import java.lang.reflect.Field;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

import static org.junit.Assert.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

public class DynamoElasticUserStoreBatchTest {
    private final AmazonDynamoDB dynamo = mock(AmazonDynamoDB.class);
    private final DynamoElasticUserStore store = new DynamoElasticUserStore();
    private final List<Integer> batchSizes = new ArrayList<>();
    private final Map<Map<String, AttributeValue>, Map<String, AttributeValue>> records = new HashMap<>();
    private TableSchema<UserModel> schema;
    private boolean deferFirstKey;

    @Before
    public void setup() throws Exception {
        SingleTable singleTable = SingleTable.builder().overrideDynamo(dynamo).tablePrefix("batch-test")
                .overrideGson(new GsonProvider().get()).build();
        schema = singleTable.parseTableSchema(UserModel.class);
        inject("singleTable", singleTable);
        inject("dynamoDoc", new DynamoDB(dynamo));
        inject("userSchema", schema);
        when(dynamo.batchGetItem(any(BatchGetItemRequest.class))).thenAnswer(call -> {
            BatchGetItemRequest request = call.getArgument(0);
            List<Map<String, AttributeValue>> keys = request.getRequestItems().get(schema.tableName()).getKeys();
            assertTrue("DynamoDB batch limit exceeded", keys.size() <= 100);
            assertEquals("Duplicate DynamoDB keys", keys.size(), new HashSet<>(keys).size());
            batchSizes.add(keys.size());
            Map<String, KeysAndAttributes> unprocessed = new HashMap<>();
            List<Map<String, AttributeValue>> returned = new ArrayList<>();
            for (int i = 0; i < keys.size(); i++) {
                if (deferFirstKey && i == 0) {
                    unprocessed.put(schema.tableName(), new KeysAndAttributes().withKeys(keys.get(i)));
                } else if (records.containsKey(keys.get(i))) {
                    returned.add(records.get(keys.get(i)));
                }
            }
            deferFirstKey = false;
            return new BatchGetItemResult().withResponses(Collections.singletonMap(schema.tableName(), returned))
                    .withUnprocessedKeys(unprocessed);
        });
    }

    private void inject(String name, Object value) throws Exception {
        Field field = DynamoElasticUserStore.class.getDeclaredField(name);
        field.setAccessible(true);
        field.set(store, value);
    }

    private ImmutableList<String> users(int count) {
        return IntStream.range(0, count).mapToObj(i -> {
            String id = "user-" + i;
            UserModel user = UserModel.builder().projectId("project").userId(id).created(Instant.EPOCH)
                    .subscribedCategoryIds(ImmutableSet.of()).build();
            Map<String, AttributeValue> item = schema.toAttrMap(user);
            Map<String, AttributeValue> key = new HashMap<>();
            key.put(schema.partitionKeyName(), item.get(schema.partitionKeyName()));
            key.put(schema.rangeKeyName(), item.get(schema.rangeKeyName()));
            records.put(key, item);
            return id;
        }).collect(ImmutableList.toImmutableList());
    }

    @Test
    public void respectsBatchBoundariesAndReturnsEveryUser() {
        for (int count : new int[]{1, 100, 101, 250}) {
            batchSizes.clear();
            ImmutableList<String> ids = users(count);
            ImmutableMap<String, UserModel> found = store.getUsers("project", ids);
            assertEquals(ImmutableSet.copyOf(ids), found.keySet());
            assertTrue(found.values().stream().allMatch(user -> user.getProjectId().equals("project")));
            List<Integer> expected = IntStream.range(0, (count + 99) / 100)
                    .mapToObj(i -> Math.min(100, count - i * 100)).collect(Collectors.toList());
            assertEquals(expected, batchSizes);
        }
    }

    @Test
    public void emptyInputDoesNotCallDynamo() {
        assertTrue(store.getUsers("project", ImmutableList.of()).isEmpty());
        verifyNoInteractions(dynamo);
    }

    @Test
    public void retriesUnprocessedKeysAndOmitsMissingUsersAcrossBatches() {
        ImmutableList<String> ids = users(101);
        deferFirstKey = true;
        ImmutableMap<String, UserModel> found = store.getUsers("project",
                ImmutableList.<String>builder().addAll(ids).add("deleted-user").build());
        assertEquals(ImmutableSet.copyOf(ids), found.keySet());
        assertEquals(Arrays.asList(100, 1, 2), batchSizes);
    }

    @Test
    public void duplicateIdsAreRequestedOnce() {
        ImmutableList<String> ids = users(101);
        assertEquals(101, store.getUsers("project",
                ImmutableList.<String>builder().addAll(ids).addAll(ids).build()).size());
        assertEquals(Arrays.asList(100, 1), batchSizes);
    }
}
