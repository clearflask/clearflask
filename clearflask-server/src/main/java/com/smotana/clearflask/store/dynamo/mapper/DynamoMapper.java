package com.smotana.clearflask.store.dynamo.mapper;

import com.amazonaws.services.dynamodbv2.document.Item;
import com.amazonaws.services.dynamodbv2.model.AttributeValue;
import com.google.common.collect.ImmutableMap;

import java.util.Map;

public interface DynamoMapper {

    Item toItem(Object obj);

    <T> T fromItem(Item item, Class<T> objClazz);

    ImmutableMap<String, AttributeValue> toAttrMap(Object obj);

    <T> T fromAttrMap(Map<String, AttributeValue> attrMap, Class<T> objClazz);

    String getCompoundPrimaryKey(ImmutableMap<String, String> keys, Class<?> objClazz);

    Object toDynamoValue(Object object);
}
