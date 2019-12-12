package com.smotana.clearflask.store.dynamo.mapper;

import com.amazonaws.services.dynamodbv2.document.Item;
import com.amazonaws.services.dynamodbv2.model.AttributeValue;
import com.google.common.collect.ImmutableMap;

public interface DynamoMapper {

    Item toItem(Object obj);

    <T> T fromItem(Item item, Class<T> objClazz);

    ImmutableMap<String, AttributeValue> toAttrMap(Object obj);

    <T> T fromAttrMap(ImmutableMap<String, AttributeValue> attrMap, Class<T> objClazz);
}
