// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
package com.smotana.clearflask.store.dynamo.mapper;

import com.amazonaws.services.dynamodbv2.document.Index;
import com.amazonaws.services.dynamodbv2.document.Item;
import com.amazonaws.services.dynamodbv2.document.KeyAttribute;
import com.amazonaws.services.dynamodbv2.document.PrimaryKey;
import com.amazonaws.services.dynamodbv2.document.Table;
import com.amazonaws.services.dynamodbv2.model.AttributeValue;
import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableMap;
import com.google.common.collect.ImmutableSet;

import java.util.Map;

public interface DynamoMapper {

    <T> TableSchema<T> parseTableSchema(Class<T> objClazz);

    <T> IndexSchema<T> parseLocalSecondaryIndexSchema(long indexNumber, Class<T> objClazz);

    <T> IndexSchema<T> parseGlobalSecondaryIndexSchema(long indexNumber, Class<T> objClazz);

    enum TableType {
        Primary,
        Lsi,
        Gsi
    }

    interface Schema<T> {
        PrimaryKey primaryKey(T obj);

        PrimaryKey primaryKey(Map<String, Object> values);

        String partitionKeyName();

        KeyAttribute partitionKey(T obj);

        KeyAttribute partitionKey(Map<String, Object> values);

        String rangeKeyName();

        KeyAttribute rangeKey(T obj);

        KeyAttribute rangeKey(Map<String, Object> values);

        /**
         * Retrieve sort key from incomplete given values.
         * Intended to be used by a range query.
         */
        KeyAttribute rangeKeyPartial(Map<String, Object> values);

        /**
         * Retrieve sort key value from incomplete given values.
         * Intended to be used by a range query.
         */
        String rangeValuePartial(Map<String, Object> values);


        Object toDynamoValue(String fieldName, Object object);

        Object fromDynamoValue(String fieldName, Object object);

        AttributeValue toAttrValue(String fieldName, Object object);

        Object fromAttrValue(String fieldName, AttributeValue attrVal);

        Item toItem(T obj);

        T fromItem(Item item);

        ImmutableMap<String, AttributeValue> toAttrMap(T obj);

        T fromAttrMap(Map<String, AttributeValue> attrMap);

        String upsertExpression(T object, Map<String, String> nameMap, Map<String, Object> valMap, ImmutableSet<String> skipFieldNames, String additionalExpression);

        String upsertExpressionAttrVal(T object, Map<String, String> nameMap, Map<String, AttributeValue> valMap, ImmutableSet<String> skipFieldNames, String additionalExpression);

        String serializeLastEvaluatedKey(Map<String, AttributeValue> lastEvaluatedKey);

        PrimaryKey toExclusiveStartKey(String serializedlastEvaluatedKey);
    }

    interface TableSchema<T> extends Schema<T> {
        String tableName();

        Table table();

        ExpressionBuilder expressionBuilder();
    }

    interface IndexSchema<T> extends Schema<T> {
        Index index();

        String indexName();
    }

    /**
     * Update expression builder that ensures updated pk or sk keys are properly
     * mapped.
     */
    interface ExpressionBuilder {
        ExpressionBuilder set(String fieldName, Object object);

        ExpressionBuilder setIncrement(String fieldName, Number increment);

        ExpressionBuilder setExpression(String fieldName, String valueExpression);

        ExpressionBuilder setExpression(String expression);

        ExpressionBuilder add(String fieldName, Object object);

        ExpressionBuilder add(ImmutableList<String> fieldPath, Object object);

        ExpressionBuilder remove(String fieldName);

        ExpressionBuilder remove(ImmutableList<String> fieldPath);

        ExpressionBuilder delete(String fieldName, Object object);


        String fieldMapping(String fieldName);

        String fieldMapping(ImmutableList<String> fieldPath);

        String fieldMapping(String fieldName, String fieldValue);

        String valueMapping(String fieldName, Object object);

        String valueMapping(ImmutableList<String> fieldPath, Object object);


        ExpressionBuilder condition(String expression);

        ExpressionBuilder conditionExists();

        ExpressionBuilder conditionNotExists();

        ExpressionBuilder conditionFieldEquals(String fieldName, Object objectOther);

        ExpressionBuilder conditionFieldExists(String fieldName);

        ExpressionBuilder conditionFieldNotExists(String fieldName);


        Expression build();
    }

    interface Expression {
        String updateExpression();

        String conditionExpression();

        ImmutableMap<String, String> nameMap();

        ImmutableMap<String, Object> valMap();
    }
}
