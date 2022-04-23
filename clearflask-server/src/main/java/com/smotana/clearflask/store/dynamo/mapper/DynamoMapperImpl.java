// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.store.dynamo.mapper;

import com.amazonaws.services.dynamodbv2.document.DynamoDB;
import com.amazonaws.services.dynamodbv2.document.Index;
import com.amazonaws.services.dynamodbv2.document.Item;
import com.amazonaws.services.dynamodbv2.document.KeyAttribute;
import com.amazonaws.services.dynamodbv2.document.PrimaryKey;
import com.amazonaws.services.dynamodbv2.document.Table;
import com.amazonaws.services.dynamodbv2.model.AttributeDefinition;
import com.amazonaws.services.dynamodbv2.model.AttributeValue;
import com.amazonaws.services.dynamodbv2.model.BillingMode;
import com.amazonaws.services.dynamodbv2.model.CreateTableRequest;
import com.amazonaws.services.dynamodbv2.model.GlobalSecondaryIndex;
import com.amazonaws.services.dynamodbv2.model.KeySchemaElement;
import com.amazonaws.services.dynamodbv2.model.KeyType;
import com.amazonaws.services.dynamodbv2.model.LocalSecondaryIndex;
import com.amazonaws.services.dynamodbv2.model.Projection;
import com.amazonaws.services.dynamodbv2.model.ProjectionType;
import com.amazonaws.services.dynamodbv2.model.ProvisionedThroughput;
import com.amazonaws.services.dynamodbv2.model.ResourceInUseException;
import com.amazonaws.services.dynamodbv2.model.ScalarAttributeType;
import com.google.common.base.MoreObjects;
import com.google.common.base.Preconditions;
import com.google.common.base.Strings;
import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableMap;
import com.google.common.collect.ImmutableSet;
import com.google.common.collect.Lists;
import com.google.common.collect.Maps;
import com.google.gson.Gson;
import com.google.gson.reflect.TypeToken;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.google.inject.multibindings.Multibinder;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.smotana.clearflask.core.ManagedService;
import com.smotana.clearflask.store.dynamo.mapper.DynamoConvertersProxy.CollectionMarshallerAttrVal;
import com.smotana.clearflask.store.dynamo.mapper.DynamoConvertersProxy.CollectionMarshallerItem;
import com.smotana.clearflask.store.dynamo.mapper.DynamoConvertersProxy.CollectionUnMarshallerAttrVal;
import com.smotana.clearflask.store.dynamo.mapper.DynamoConvertersProxy.CollectionUnMarshallerItem;
import com.smotana.clearflask.store.dynamo.mapper.DynamoConvertersProxy.MarshallerAttrVal;
import com.smotana.clearflask.store.dynamo.mapper.DynamoConvertersProxy.MarshallerItem;
import com.smotana.clearflask.store.dynamo.mapper.DynamoConvertersProxy.UnMarshallerAttrVal;
import com.smotana.clearflask.store.dynamo.mapper.DynamoConvertersProxy.UnMarshallerItem;
import com.smotana.clearflask.util.LogUtil;
import com.smotana.clearflask.util.StringSerdeUtil;
import lombok.extern.slf4j.Slf4j;

import java.lang.reflect.Constructor;
import java.lang.reflect.Field;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Modifier;
import java.lang.reflect.Parameter;
import java.lang.reflect.ParameterizedType;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.function.BiConsumer;
import java.util.function.Function;
import java.util.function.Supplier;
import java.util.stream.Collectors;
import java.util.stream.LongStream;
import java.util.stream.Stream;

import static com.google.common.base.Preconditions.*;
import static com.smotana.clearflask.store.dynamo.mapper.DynamoMapper.TableType.*;

@Slf4j
@Singleton
public class DynamoMapperImpl extends ManagedService implements DynamoMapper {

    public static final String TTL_IN_EPOCH_SEC_KEY = "ttlInEpochSec";

    public interface Config {
        @DefaultValue("true")
        boolean createTables();

        @DefaultValue("clearflask")
        String tablePrefix();

        @DefaultValue("2")
        long gsiCount();

        @DefaultValue("0")
        long lsiCount();
    }

    @Inject
    private Config config;
    @Inject
    private Gson gson;
    @Inject
    private DynamoDB dynamoDoc;

    private final DynamoConvertersProxy.Converters converters = DynamoConvertersProxy.proxy();
    private final MarshallerItem gsonMarshallerItem = (o, a, i) -> i.withString(a, gson.toJson(o));
    private final MarshallerAttrVal gsonMarshallerAttrVal = o -> new AttributeValue().withS(gson.toJson(o));
    private final Function<Class, UnMarshallerAttrVal> gsonUnMarshallerAttrVal = k -> a -> gson.fromJson(a.getS(), k);
    private final Function<Class, UnMarshallerItem> gsonUnMarshallerItem = k -> (a, i) -> gson.fromJson(i.getString(a), k);
    private final Map<String, DynamoTable> rangePrefixToDynamoTable = Maps.newHashMap();

    @Override
    protected void serviceStart() throws Exception {
        if (config.createTables()) {
            try {
                ArrayList<KeySchemaElement> primaryKeySchemas = Lists.newArrayList();
                ArrayList<AttributeDefinition> primaryAttributeDefinitions = Lists.newArrayList();
                ArrayList<LocalSecondaryIndex> localSecondaryIndexes = Lists.newArrayList();
                ArrayList<GlobalSecondaryIndex> globalSecondaryIndexes = Lists.newArrayList();

                primaryKeySchemas.add(new KeySchemaElement(getPartitionKeyName(Primary, -1), KeyType.HASH));
                primaryAttributeDefinitions.add(new AttributeDefinition(getPartitionKeyName(Primary, -1), ScalarAttributeType.S));
                primaryKeySchemas.add(new KeySchemaElement(getRangeKeyName(Primary, -1), KeyType.RANGE));
                primaryAttributeDefinitions.add(new AttributeDefinition(getRangeKeyName(Primary, -1), ScalarAttributeType.S));

                LongStream.range(1, config.lsiCount() + 1).forEach(indexNumber -> {
                    localSecondaryIndexes.add(new LocalSecondaryIndex()
                            .withIndexName(getTableOrIndexName(Lsi, indexNumber))
                            .withProjection(new Projection().withProjectionType(ProjectionType.ALL))
                            .withKeySchema(ImmutableList.of(
                                    new KeySchemaElement(getPartitionKeyName(Lsi, indexNumber), KeyType.HASH),
                                    new KeySchemaElement(getRangeKeyName(Lsi, indexNumber), KeyType.RANGE))));
                    primaryAttributeDefinitions.add(new AttributeDefinition(getRangeKeyName(Lsi, indexNumber), ScalarAttributeType.S));
                });

                LongStream.range(1, config.gsiCount() + 1).forEach(indexNumber -> {
                    globalSecondaryIndexes.add(new GlobalSecondaryIndex()
                            .withIndexName(getTableOrIndexName(Gsi, indexNumber))
                            .withProjection(new Projection().withProjectionType(ProjectionType.ALL))
                            .withKeySchema(ImmutableList.of(
                                    new KeySchemaElement(getPartitionKeyName(Gsi, indexNumber), KeyType.HASH),
                                    new KeySchemaElement(getRangeKeyName(Gsi, indexNumber), KeyType.RANGE))));
                    primaryAttributeDefinitions.add(new AttributeDefinition(getPartitionKeyName(Gsi, indexNumber), ScalarAttributeType.S));
                    primaryAttributeDefinitions.add(new AttributeDefinition(getRangeKeyName(Gsi, indexNumber), ScalarAttributeType.S));
                });

                CreateTableRequest createTableRequest = new CreateTableRequest()
                        .withTableName(getTableOrIndexName(Primary, -1))
                        .withKeySchema(primaryKeySchemas)
                        .withAttributeDefinitions(primaryAttributeDefinitions)
                        .withBillingMode(BillingMode.PAY_PER_REQUEST);
                if (!localSecondaryIndexes.isEmpty()) {
                    createTableRequest.withLocalSecondaryIndexes(localSecondaryIndexes);
                }
                if (!globalSecondaryIndexes.isEmpty()) {
                    createTableRequest.withGlobalSecondaryIndexes(globalSecondaryIndexes);
                }
                dynamoDoc.createTable(createTableRequest);
                log.info("Table {} created", getTableOrIndexName(Primary, -1));
            } catch (ResourceInUseException ex) {
                log.trace("Table {} already exists", getTableOrIndexName(Primary, -1));
            }
        }
    }

    @Override
    public <T> TableSchema<T> parseTableSchema(Class<T> objClazz) {
        return parseSchema(Primary, -1, objClazz);
    }

    @Override
    public <T> IndexSchema<T> parseLocalSecondaryIndexSchema(long indexNumber, Class<T> objClazz) {
        return parseSchema(Lsi, indexNumber, objClazz);
    }

    @Override
    public <T> IndexSchema<T> parseGlobalSecondaryIndexSchema(long indexNumber, Class<T> objClazz) {
        return parseSchema(Gsi, indexNumber, objClazz);
    }

    private String getTableOrIndexName(TableType type, long indexNumber) {
        return this.config.tablePrefix() + (type == Primary
                ? type.name().toLowerCase()
                : type.name().toLowerCase() + indexNumber);
    }

    private String getPartitionKeyName(TableType type, long indexNumber) {
        return type == Primary || type == Lsi
                ? "pk"
                : type.name().toLowerCase() + "pk" + indexNumber;
    }

    private String getRangeKeyName(TableType type, long indexNumber) {
        return type == Primary
                ? "sk"
                : type.name().toLowerCase() + "sk" + indexNumber;
    }

    private <T> SchemaImpl<T> parseSchema(TableType type, long indexNumber, Class<T> objClazz) {
        DynamoTable[] dynamoTables = objClazz.getDeclaredAnnotationsByType(DynamoTable.class);
        checkState(dynamoTables != null && dynamoTables.length > 0,
                "Class " + objClazz + " is missing DynamoTable annotation");
        DynamoTable dynamoTable = Arrays.stream(dynamoTables)
                .filter(dt -> dt.type() == type)
                .filter(dt -> dt.indexNumber() == indexNumber)
                .findAny()
                .orElseThrow(() -> new IllegalStateException("Class " + objClazz + " is missing table type " + type));
        String[] partitionKeys = dynamoTable.partitionKeys();
        String[] rangeKeys = dynamoTable.rangeKeys();
        String rangePrefix = dynamoTable.rangePrefix();
        String tableName = getTableOrIndexName(type, indexNumber);
        String partitionKeyName = getPartitionKeyName(type, indexNumber);
        String rangeKeyName = getRangeKeyName(type, indexNumber);

        DynamoTable dynamoTableOther = rangePrefixToDynamoTable.putIfAbsent(rangePrefix, dynamoTable);
        checkState(dynamoTableOther == null || dynamoTableOther == dynamoTable, "Detected multiple schemas with same rangePrefix %s, one in %s and other in %s", rangePrefix, dynamoTable, dynamoTableOther);

        Table table = dynamoDoc.getTable(getTableOrIndexName(Primary, -1));
        Index index = type != Primary
                ? table.getIndex(tableName)
                : null;

        ImmutableMap.Builder<String, MarshallerItem> fieldMarshallersBuilder = ImmutableMap.builder();
        ImmutableMap.Builder<String, UnMarshallerItem> fieldUnMarshallersBuilder = ImmutableMap.builder();
        ImmutableMap.Builder<String, MarshallerAttrVal> fieldAttrMarshallersBuilder = ImmutableMap.builder();
        ImmutableMap.Builder<String, UnMarshallerAttrVal> fieldAttrUnMarshallersBuilder = ImmutableMap.builder();
        ImmutableList.Builder<Function<Item, Object>> fromItemToCtorArgsListBuilder = ImmutableList.builder();
        ImmutableList.Builder<Function<Map<String, AttributeValue>, Object>> fromAttrMapToCtorArgsListBuilder = ImmutableList.builder();
        ImmutableMap.Builder<String, Function<T, Object>> objToFieldValsBuilder = ImmutableMap.builder();
        Field[] partitionKeyFields = new Field[partitionKeys.length];
        Field[] rangeKeyFields = new Field[rangeKeys.length];
        ImmutableList.Builder<BiConsumer<Item, T>> toItemArgsBuilder = ImmutableList.builder();
        ImmutableList.Builder<BiConsumer<ImmutableMap.Builder<String, AttributeValue>, T>> toAttrMapArgsBuilder = ImmutableList.builder();

        long fieldsCount = 0;
        for (Field field : objClazz.getDeclaredFields()) {
            if (field.isSynthetic()) {
                continue; // Skips fields such as "$jacocodata" during tests
            }
            fieldsCount++;
            String fieldName = field.getName();
            checkState(Modifier.isFinal(field.getModifiers()),
                    "Cannot map class %s to item,field %s is not final",
                    objClazz.getSimpleName(), fieldName);
            field.setAccessible(true);
            Optional<Class> collectionClazz = getCollectionClazz(field.getType());
            Class fieldClazz = collectionClazz.isPresent() ? getCollectionGeneric(field) : field.getType();

            Function<T, Object> objToFieldVal = obj -> {
                try {
                    return field.get(obj);
                } catch (IllegalAccessException ex) {
                    throw new RuntimeException(ex);
                }
            };
            objToFieldValsBuilder.put(fieldName, objToFieldVal);

            // fromItem
            UnMarshallerItem unMarshallerItem = findUnMarshallerItem(collectionClazz, fieldClazz);
            fromItemToCtorArgsListBuilder.add((item) ->
                    (!collectionClazz.isPresent() && (!item.isPresent(fieldName) || item.isNull(fieldName)))
                            ? null
                            : unMarshallerItem.unmarshall(fieldName, item));

            // fromAttrMap
            UnMarshallerAttrVal unMarshallerAttrVal = findUnMarshallerAttrVal(collectionClazz, fieldClazz);
            fromAttrMapToCtorArgsListBuilder.add((attrMap) -> {
                AttributeValue attrVal = attrMap.get(fieldName);
                return (!collectionClazz.isPresent() && (attrVal == null || attrVal.getNULL() == Boolean.TRUE))
                        ? null
                        : unMarshallerAttrVal.unmarshall(attrVal);
            });

            boolean isSet = Set.class.isAssignableFrom(field.getType());

            // toItem toAttrVal
            for (int i = 0; i < partitionKeys.length; i++) {
                if (fieldName.equals(partitionKeys[i])) {
                    partitionKeyFields[i] = field;
                }
            }
            for (int i = 0; i < rangeKeys.length; i++) {
                if (fieldName.equals(rangeKeys[i])) {
                    rangeKeyFields[i] = field;
                }
            }

            // toItem
            MarshallerItem marshallerItem = findMarshallerItem(collectionClazz, fieldClazz);
            toItemArgsBuilder.add((item, object) -> {
                Object val = objToFieldVal.apply(object);
                if (isSet && val == null && LogUtil.rateLimitAllowLog("dynamomapper-set-missing-nonnull")) {
                    log.warn("Field {} in class {} missing @NonNull. All sets are required to be non null since" +
                                    " empty set is not allowed by DynamoDB and there is no distinction between null and empty set.",
                            fieldName, object.getClass().getSimpleName());
                }
                if (val == null) {
                    return; // Omit null
                }
                marshallerItem.marshall(val, fieldName, item);
            });

            // toAttrVal
            MarshallerAttrVal marshallerAttrVal = findMarshallerAttrVal(collectionClazz, fieldClazz);
            toAttrMapArgsBuilder.add((mapBuilder, object) -> {
                Object val = objToFieldVal.apply(object);
                if (isSet && val == null && LogUtil.rateLimitAllowLog("dynamomapper-set-missing-nonnull")) {
                    log.warn("Field {} in class {} missing @NonNull. All sets are required to be non null since" +
                                    " empty set is not allowed by DynamoDB and there is no distinction between null and empty set.",
                            fieldName, object.getClass().getSimpleName());
                }
                if (val == null) {
                    return; // Omit null
                }
                AttributeValue valMarsh = marshallerAttrVal.marshall(val);
                if (valMarsh == null) {
                    return; // Omit null
                }
                mapBuilder.put(fieldName, valMarsh);
            });

            // toDynamoValue fromDynamoValue
            fieldMarshallersBuilder.put(fieldName, marshallerItem);
            fieldUnMarshallersBuilder.put(fieldName, unMarshallerItem);

            // toAttrValue fromAttrValue
            fieldAttrMarshallersBuilder.put(fieldName, marshallerAttrVal);
            fieldAttrUnMarshallersBuilder.put(fieldName, unMarshallerAttrVal);
        }

        // fromItem fromAttrVal ctor
        Constructor<T> objCtor = findConstructor(objClazz, fieldsCount);
        objCtor.setAccessible(true);

        // fromItem
        ImmutableList<Function<Item, Object>> fromItemToCtorArgsList = fromItemToCtorArgsListBuilder.build();
        Function<Item, Object[]> fromItemToCtorArgs = item -> fromItemToCtorArgsList.stream()
                .map(u -> u.apply(item))
                .toArray();

        // fromAttrMap
        ImmutableList<Function<Map<String, AttributeValue>, Object>> fromAttrMapToCtorArgsList = fromAttrMapToCtorArgsListBuilder.build();
        Function<Map<String, AttributeValue>, Object[]> fromAttrMapToCtorArgs = attrMap -> fromAttrMapToCtorArgsList.stream()
                .map(u -> u.apply(attrMap))
                .toArray();

        // toItem toAttrVal keys
        ImmutableMap<String, Function<T, Object>> objToFieldVals = objToFieldValsBuilder.build();
        ImmutableMap.Builder<String, Function<T, String>> toItemOtherKeysMapperBuilder = ImmutableMap.builder();
        for (DynamoTable dt : dynamoTables) {
            if (dt.type() == dynamoTable.type() && dt.indexNumber() == dynamoTable.indexNumber()) {
                continue;
            }
            checkState(!Strings.isNullOrEmpty(dt.rangePrefix()) || rangeKeys.length > 0,
                    "Must supply either list of range keys and/or a prefix for class %s", objClazz);
            if (dt.type() != Lsi) {
                ImmutableList<Function<T, Object>> dtPartitionKeyMappers = Arrays.stream(dt.partitionKeys())
                        .map(objToFieldVals::get)
                        .map(Preconditions::checkNotNull)
                        .collect(ImmutableList.toImmutableList());
                toItemOtherKeysMapperBuilder.put(
                        getPartitionKeyName(dt.type(), dt.indexNumber()),
                        obj -> StringSerdeUtil.mergeStrings(dtPartitionKeyMappers.stream()
                                .map(m -> m.apply(obj))
                                .map(gson::toJson)
                                .toArray(String[]::new)));
            }
            String dtRangePrefix = dt.rangePrefix();
            ImmutableList<Function<T, Object>> dtRangeKeyMappers = Arrays.stream(dt.rangeKeys())
                    .map(objToFieldVals::get)
                    .map(Preconditions::checkNotNull)
                    .collect(ImmutableList.toImmutableList());
            toItemOtherKeysMapperBuilder.put(
                    getRangeKeyName(dt.type(), dt.indexNumber()),
                    obj -> StringSerdeUtil.mergeStrings(Stream.concat(Stream.of(dtRangePrefix), dtRangeKeyMappers.stream()
                                    .map(m -> m.apply(obj))
                                    .map(gson::toJson))
                            .toArray(String[]::new)));
        }
        ImmutableMap<String, Function<T, String>> toItemOtherKeysMapper = toItemOtherKeysMapperBuilder.build();
        Function<T, String> getPartitionKeyVal = obj -> StringSerdeUtil.mergeStrings(Arrays.stream(partitionKeyFields)
                .map(f -> {
                    try {
                        return gson.toJson(checkNotNull(f.get(obj)));
                    } catch (IllegalAccessException ex) {
                        throw new RuntimeException(ex);
                    }
                })
                .toArray(String[]::new));
        Function<T, String> getRangeKeyVal = obj -> StringSerdeUtil.mergeStrings(Stream.concat(Stream.of(rangePrefix), Arrays.stream(rangeKeyFields)
                        .map(f -> {
                            try {
                                return gson.toJson(checkNotNull(f.get(obj)));
                            } catch (IllegalAccessException ex) {
                                throw new RuntimeException(ex);
                            }
                        }))
                .toArray(String[]::new));

        // toItem
        ImmutableList<BiConsumer<Item, T>> toItemArgs = toItemArgsBuilder.build();
        Function<T, Item> toItemMapper = obj -> {
            Item item = new Item();
            item.withPrimaryKey(partitionKeyName, getPartitionKeyVal.apply(obj),
                    rangeKeyName, getRangeKeyVal.apply(obj));
            toItemOtherKeysMapper.forEach(((keyName, objToKeyMapper) ->
                    item.withString(keyName, objToKeyMapper.apply(obj))));
            toItemArgs.forEach(m -> m.accept(item, obj));
            return item;
        };

        // toAttrMap
        ImmutableList<BiConsumer<ImmutableMap.Builder<String, AttributeValue>, T>> toAttrMapArgs = toAttrMapArgsBuilder.build();
        Function<T, ImmutableMap<String, AttributeValue>> toAttrMapMapper = obj -> {
            ImmutableMap.Builder<String, AttributeValue> attrMapBuilder = ImmutableMap.builder();
            attrMapBuilder.put(partitionKeyName, new AttributeValue(getPartitionKeyVal.apply(obj)));
            attrMapBuilder.put(rangeKeyName, new AttributeValue(getRangeKeyVal.apply(obj)));
            toItemOtherKeysMapper.forEach(((keyName, objToKeyMapper) ->
                    attrMapBuilder.put(keyName, new AttributeValue(objToKeyMapper.apply(obj)))));
            toAttrMapArgs.forEach(m -> m.accept(attrMapBuilder, obj));
            return attrMapBuilder.build();
        };

        // toDynamoValue fromDynamoValue
        ImmutableMap<String, MarshallerItem> fieldMarshallers = fieldMarshallersBuilder.build();
        ImmutableMap<String, UnMarshallerItem> fieldUnMarshallers = fieldUnMarshallersBuilder.build();

        // toAttrValue fromAttrValue
        ImmutableMap<String, MarshallerAttrVal> fieldAttrMarshallers = fieldAttrMarshallersBuilder.build();
        ImmutableMap<String, UnMarshallerAttrVal> fieldAttrUnMarshallers = fieldAttrUnMarshallersBuilder.build();

        // Expression Builder Supplier
        Supplier<ExpressionBuilder> expressionBuilderSupplier = () -> new ExpressionBuilder() {
            private boolean built = false;
            private final Map<String, String> nameMap = Maps.newHashMap();
            private final Map<String, Object> valMap = Maps.newHashMap();
            private final Map<String, String> setUpdates = Maps.newHashMap();
            private final Map<String, String> removeUpdates = Maps.newHashMap();
            private final Map<String, String> addUpdates = Maps.newHashMap();
            private final Map<String, String> deleteUpdates = Maps.newHashMap();
            private final List<String> conditionExpressions = Lists.newArrayList();

            @Override
            public ExpressionBuilder set(String fieldName, Object object) {
                checkState(!built);
                checkState(!setUpdates.containsKey(fieldName));
                setUpdates.put(fieldName,
                        fieldMapping(fieldName) + " = " + valueMapping(fieldName, object));
                return this;
            }

            @Override
            public ExpressionBuilder set(ImmutableList<String> fieldPath, Object object) {
                checkState(!built);
                checkArgument(!fieldPath.isEmpty());
                String fieldMapping = fieldMapping(fieldPath);
                checkState(!addUpdates.containsKey(fieldMapping));
                setUpdates.put(fieldMapping,
                        fieldMapping + " = " + valueMapping(fieldPath, object));
                return this;
            }

            @Override
            public ExpressionBuilder setIncrement(String fieldName, Number increment) {
                checkState(!built);
                checkState(!setUpdates.containsKey(fieldName));
                setUpdates.put(fieldName, String.format("%s = if_not_exists(%s, %s) + %s",
                        fieldMapping(fieldName),
                        fieldMapping(fieldName),
                        constantMapping("zero", 0L),
                        valueMapping(fieldName, increment)));
                return this;
            }

            @Override
            public ExpressionBuilder setExpression(String fieldName, String valueExpression) {
                checkState(!built);
                checkState(!setUpdates.containsKey(fieldName));
                setUpdates.put(fieldName,
                        fieldMapping(fieldName) + " = " + valueExpression);
                return this;
            }

            @Override
            public ExpressionBuilder setExpression(String expression) {
                checkState(!built);
                setUpdates.put(expression, expression);
                return this;
            }

            @Override
            public ExpressionBuilder add(String fieldName, Object object) {
                checkState(!built);
                checkState(!addUpdates.containsKey(fieldName));
                addUpdates.put(fieldName,
                        fieldMapping(fieldName) + " " + valueMapping(fieldName, object));
                return this;
            }

            @Override
            public ExpressionBuilder add(ImmutableList<String> fieldPath, Object object) {
                checkState(!built);
                checkArgument(!fieldPath.isEmpty());
                String fieldMapping = fieldMapping(fieldPath);
                checkState(!addUpdates.containsKey(fieldMapping));
                addUpdates.put(fieldMapping,
                        fieldMapping + " " + valueMapping(fieldPath, object));
                return this;
            }

            @Override
            public ExpressionBuilder remove(String fieldName) {
                checkState(!built);
                checkState(!removeUpdates.containsKey(fieldName));
                removeUpdates.put(fieldName, fieldMapping(fieldName));
                return this;
            }

            @Override
            public ExpressionBuilder remove(ImmutableList<String> fieldPath) {
                checkState(!built);
                checkArgument(!fieldPath.isEmpty());
                String fieldMapping = fieldMapping(fieldPath);
                checkState(!addUpdates.containsKey(fieldMapping));
                removeUpdates.put(fieldMapping, fieldMapping);
                return this;
            }

            @Override
            public ExpressionBuilder delete(String fieldName, Object object) {
                checkState(!built);
                checkState(!deleteUpdates.containsKey(fieldName));
                deleteUpdates.put(fieldName,
                        fieldMapping(fieldName) + " " + valueMapping(fieldName, object));
                return this;
            }

            @Override
            public String fieldMapping(String fieldName) {
                checkState(!built);
                String mappedName = "#" + sanitizeFieldMapping(fieldName);
                nameMap.put(mappedName, fieldName);
                return mappedName;
            }

            @Override
            public String fieldMapping(ImmutableList<String> fieldPath) {
                return fieldPath.stream()
                        .map(this::fieldMapping)
                        .collect(Collectors.joining("."));
            }

            @Override
            public String fieldMapping(String fieldName, String fieldValue) {
                checkState(!built);
                String mappedName = "#" + sanitizeFieldMapping(fieldName);
                nameMap.put(mappedName, fieldValue);
                return mappedName;
            }

            @Override
            public String valueMapping(String fieldName, Object object) {
                checkState(!built);
                Object val;
                if (object instanceof String) {
                    // For partition range keys and strings in general, there is no marshaller
                    val = object;
                } else {
                    Item tempItem = new Item();
                    checkNotNull(fieldMarshallers.get(fieldName), "Unknown field name %s", fieldName)
                            .marshall(object, "tempAttr", tempItem);
                    val = tempItem.get("tempAttr");
                }
                return constantMapping(fieldName, val);
            }

            @Override
            public String constantMapping(String fieldName, Object object) {
                checkState(!built);
                String mappedName = ":" + sanitizeFieldMapping(fieldName);
                valMap.put(mappedName, object);
                return mappedName;
            }

            @Override
            public String valueMapping(ImmutableList<String> fieldPath, Object object) {
                return constantMapping(fieldPath.stream()
                        .map(String::toLowerCase)
                        .collect(Collectors.joining("X")), object);
            }

            @Override
            public ExpressionBuilder condition(String expression) {
                checkState(!built);
                conditionExpressions.add(expression);
                return this;
            }

            @Override
            public ExpressionBuilder conditionExists() {
                checkState(!built);
                conditionExpressions.add("attribute_exists(" + fieldMapping(partitionKeyName) + ")");
                return this;
            }

            @Override
            public ExpressionBuilder conditionNotExists() {
                checkState(!built);
                conditionExpressions.add("attribute_not_exists(" + fieldMapping(partitionKeyName) + ")");
                return this;
            }

            @Override
            public ExpressionBuilder conditionFieldEquals(String fieldName, Object objectOther) {
                checkState(!built);
                conditionExpressions.add(fieldMapping(fieldName) + " = " + valueMapping(fieldName, objectOther));
                return this;
            }

            @Override
            public ExpressionBuilder conditionFieldExists(String fieldName) {
                checkState(!built);
                conditionExpressions.add("attribute_exists(" + fieldMapping(fieldName) + ")");
                return this;
            }

            @Override
            public ExpressionBuilder conditionFieldNotExists(String fieldName) {
                checkState(!built);
                conditionExpressions.add("attribute_not_exists(" + fieldMapping(fieldName) + ")");
                return this;
            }

            @Override
            public Expression build() {
                built = true;
                ArrayList<String> updates = Lists.newArrayList();
                if (!setUpdates.isEmpty()) {
                    updates.add("SET " + String.join(", ", setUpdates.values()));
                }
                if (!addUpdates.isEmpty()) {
                    updates.add("ADD " + String.join(", ", addUpdates.values()));
                }
                if (!removeUpdates.isEmpty()) {
                    updates.add("REMOVE " + String.join(", ", removeUpdates.values()));
                }
                if (!deleteUpdates.isEmpty()) {
                    updates.add("DELETE " + String.join(", ", deleteUpdates.values()));
                }
                final Optional<String> updateOpt = Optional.ofNullable(Strings.emptyToNull(String.join(" ", updates)));
                final Optional<String> conditionOpt = Optional.ofNullable(Strings.emptyToNull(String.join(" AND ", conditionExpressions)));
                final Optional<ImmutableMap<String, String>> nameImmutableMapOpt = nameMap.isEmpty() ? Optional.empty() : Optional.of(ImmutableMap.copyOf(nameMap));
                final Optional<ImmutableMap<String, Object>> valImmutableMapOpt = valMap.isEmpty() ? Optional.empty() : Optional.of(ImmutableMap.copyOf(valMap));
                log.trace("Built dynamo expression: update {} condition {} nameMap {} valKeys {}",
                        updateOpt, conditionOpt, nameImmutableMapOpt, valImmutableMapOpt.map(ImmutableMap::keySet));
                return new Expression() {
                    @Override
                    public Optional<String> updateExpression() {
                        return updateOpt;
                    }

                    @Override
                    public Optional<String> conditionExpression() {
                        return conditionOpt;
                    }

                    @Override
                    public Optional<ImmutableMap<String, String>> nameMap() {
                        return nameImmutableMapOpt;
                    }

                    @Override
                    public Optional<ImmutableMap<String, Object>> valMap() {
                        return valImmutableMapOpt;
                    }

                    @Override
                    public String toString() {
                        return MoreObjects.toStringHelper(this)
                                .add("updateExpression", this.updateExpression())
                                .add("conditionExpression", this.conditionExpression())
                                .add("nameMap", this.nameMap())
                                .add("valMap", this.valMap())
                                .toString();
                    }
                };
            }

            private String sanitizeFieldMapping(String fieldName) {
                return fieldName.replaceAll("(^[^a-z])|[^a-zA-Z0-9]", "x");
            }
        };

        return new SchemaImpl<T>(
                partitionKeys,
                rangeKeys,
                partitionKeyFields,
                rangeKeyFields,
                rangePrefix,
                tableName,
                partitionKeyName,
                rangeKeyName,
                table,
                index,
                fieldMarshallers,
                fieldUnMarshallers,
                fieldAttrMarshallers,
                fieldAttrUnMarshallers,
                fromItemToCtorArgs,
                fromAttrMapToCtorArgs,
                objCtor,
                toItemMapper,
                toAttrMapMapper,
                expressionBuilderSupplier);
    }

    private <T> Constructor<T> findConstructor(Class<T> objectClazz, long argc) {
        for (Constructor<?> constructorPotential : objectClazz.getDeclaredConstructors()) {
            // Let's only check for args size and assume all types are good...
            if (constructorPotential.getParameterCount() != argc) {
                log.trace("Unsuitable constructor {}", constructorPotential);
                continue;
            }
            return (Constructor<T>) constructorPotential;
        }
        throw new IllegalStateException("Cannot find constructor for class " + objectClazz.getSimpleName());
    }

    private boolean isSetClazz(Class<?> clazz) {
        return Set.class.isAssignableFrom(clazz);
    }

    private Optional<Class> getCollectionClazz(Class<?> clazz) {
        return Collection.class.isAssignableFrom(clazz) || Map.class.isAssignableFrom(clazz)
                ? Optional.of(clazz)
                : Optional.empty();
    }

    private Class getCollectionGeneric(Parameter parameter) {
        if (Map.class.isAssignableFrom(parameter.getType())) {
            return ((Class) ((ParameterizedType) parameter.getParameterizedType())
                    .getActualTypeArguments()[1]);
        } else {
            return ((Class) ((ParameterizedType) parameter.getParameterizedType())
                    .getActualTypeArguments()[0]);
        }
    }

    private Class getCollectionGeneric(Field field) {
        if (Map.class.isAssignableFrom(field.getType())) {
            return ((Class) ((ParameterizedType) field.getGenericType())
                    .getActualTypeArguments()[1]);
        } else {
            return ((Class) ((ParameterizedType) field.getGenericType())
                    .getActualTypeArguments()[0]);
        }
    }

    private MarshallerItem findMarshallerItem(Optional<Class> collectionClazz, Class itemClazz) {
        MarshallerItem f = findInClassSet(itemClazz, converters.mip).orElse(gsonMarshallerItem);
        if (collectionClazz.isPresent()) {
            CollectionMarshallerItem fc = findInClassSet(collectionClazz.get(), converters.mic).get();
            return (o, a, i) -> fc.marshall(o, a, i, f);
        } else {
            return f;
        }
    }

    private UnMarshallerItem findUnMarshallerItem(Optional<Class> collectionClazz, Class itemClazz) {
        UnMarshallerItem f = findInClassSet(itemClazz, converters.uip).orElseGet(() -> gsonUnMarshallerItem.apply(itemClazz));
        if (collectionClazz.isPresent()) {
            CollectionUnMarshallerItem fc = findInClassSet(collectionClazz.get(), converters.uic).get();
            return (a, i) -> fc.unmarshall(a, i, f);
        } else {
            return f;
        }
    }

    private MarshallerAttrVal findMarshallerAttrVal(Optional<Class> collectionClazz, Class itemClazz) {
        MarshallerAttrVal f = findInClassSet(itemClazz, converters.map).orElse(gsonMarshallerAttrVal);
        if (collectionClazz.isPresent()) {
            CollectionMarshallerAttrVal fc = findInClassSet(collectionClazz.get(), converters.mac).get();
            return o -> fc.marshall(o, f);
        } else {
            return f;
        }
    }

    private UnMarshallerAttrVal findUnMarshallerAttrVal(Optional<Class> collectionClazz, Class itemClazz) {
        UnMarshallerAttrVal f = findInClassSet(itemClazz, converters.uap).orElseGet(() -> gsonUnMarshallerAttrVal.apply(itemClazz));
        if (collectionClazz.isPresent()) {
            CollectionUnMarshallerAttrVal fc = findInClassSet(collectionClazz.get(), converters.uac).get();
            return a -> fc.unmarshall(a, f);
        } else {
            return f;
        }
    }

    private <T> Optional<T> findInClassSet(Class clazz, ImmutableSet<Map.Entry<Class<?>, T>> set) {
        for (Map.Entry<Class<?>, T> entry : set) {
            if (entry.getKey().isAssignableFrom(clazz)) {
                return Optional.of(entry.getValue());
            }
        }
        return Optional.empty();
    }

    public class SchemaImpl<T> implements TableSchema<T>, IndexSchema<T> {
        private final String[] partitionKeys;
        private final String[] rangeKeys;
        private final Field[] partitionKeyFields;
        private final Field[] rangeKeyFields;
        private final String rangePrefix;
        private final String tableName;
        private final String partitionKeyName;
        private final String rangeKeyName;
        private final Table table;
        private final Index index;
        private final ImmutableMap<String, MarshallerItem> fieldMarshallers;
        private final ImmutableMap<String, UnMarshallerItem> fieldUnMarshallers;
        private final ImmutableMap<String, MarshallerAttrVal> fieldAttrMarshallers;
        private final ImmutableMap<String, UnMarshallerAttrVal> fieldAttrUnMarshallers;
        private final Function<Item, Object[]> fromItemToCtorArgs;
        private final Function<Map<String, AttributeValue>, Object[]> fromAttrMapToCtorArgs;
        private final Constructor<T> objCtor;
        private final Function<T, Item> toItemMapper;
        private final Function<T, ImmutableMap<String, AttributeValue>> toAttrMapMapper;
        private final Supplier<ExpressionBuilder> expressionBuilderSupplier;

        public SchemaImpl(
                String[] partitionKeys,
                String[] rangeKeys,
                Field[] partitionKeyFields,
                Field[] rangeKeyFields,
                String rangePrefix,
                String tableName,
                String partitionKeyName,
                String rangeKeyName,
                Table table,
                Index index,
                ImmutableMap<String, MarshallerItem> fieldMarshallers,
                ImmutableMap<String, UnMarshallerItem> fieldUnMarshallers,
                ImmutableMap<String, MarshallerAttrVal> fieldAttrMarshallers,
                ImmutableMap<String, UnMarshallerAttrVal> fieldAttrUnMarshallers,
                Function<Item, Object[]> fromItemToCtorArgs,
                Function<Map<String, AttributeValue>, Object[]> fromAttrMapToCtorArgs,
                Constructor<T> objCtor, Function<T, Item> toItemMapper,
                Function<T, ImmutableMap<String, AttributeValue>> toAttrMapMapper,
                Supplier<ExpressionBuilder> expressionBuilderSupplier) {
            this.partitionKeys = partitionKeys;
            this.rangeKeys = rangeKeys;
            this.partitionKeyFields = partitionKeyFields;
            this.rangeKeyFields = rangeKeyFields;
            this.rangePrefix = rangePrefix;
            this.tableName = tableName;
            this.partitionKeyName = partitionKeyName;
            this.rangeKeyName = rangeKeyName;
            this.table = table;
            this.index = index;
            this.fieldMarshallers = fieldMarshallers;
            this.fieldUnMarshallers = fieldUnMarshallers;
            this.fieldAttrMarshallers = fieldAttrMarshallers;
            this.fieldAttrUnMarshallers = fieldAttrUnMarshallers;
            this.fromItemToCtorArgs = fromItemToCtorArgs;
            this.fromAttrMapToCtorArgs = fromAttrMapToCtorArgs;
            this.objCtor = objCtor;
            this.toItemMapper = toItemMapper;
            this.toAttrMapMapper = toAttrMapMapper;
            this.expressionBuilderSupplier = expressionBuilderSupplier;
        }

        @Override
        public String tableName() {
            return tableName;
        }

        @Override
        public Table table() {
            return table;
        }

        @Override
        public ExpressionBuilder expressionBuilder() {
            return expressionBuilderSupplier.get();
        }

        @Override
        public String indexName() {
            return tableName;
        }

        @Override
        public Index index() {
            return index;
        }

        @Override
        public PrimaryKey primaryKey(T obj) {
            return new PrimaryKey(partitionKey(obj), rangeKey(obj));
        }

        @Override
        public PrimaryKey primaryKey(Map<String, Object> values) {
            checkState(partitionKeys.length + rangeKeys.length >= values.size(), "Unexpected extra values, partition keys %s range keys %s values %s", partitionKeys, rangeKeys, values);
            return new PrimaryKey(
                    new KeyAttribute(
                            partitionKeyName,
                            StringSerdeUtil.mergeStrings(Arrays.stream(partitionKeys)
                                    .map(partitionKey -> gson.toJson(checkNotNull(values.get(partitionKey), "Partition key missing value for %s", partitionKey)))
                                    .toArray(String[]::new))),
                    new KeyAttribute(
                            rangeKeyName,
                            StringSerdeUtil.mergeStrings(Stream.concat(Stream.of(rangePrefix), Arrays.stream(rangeKeys)
                                            .map(rangeKey -> gson.toJson(checkNotNull(values.get(rangeKey), "Range key missing value for %s", rangeKey))))
                                    .toArray(String[]::new))));
        }

        @Override
        public String partitionKeyName() {
            return partitionKeyName;
        }

        @Override
        public KeyAttribute partitionKey(T obj) {
            return new KeyAttribute(
                    partitionKeyName,
                    StringSerdeUtil.mergeStrings(Arrays.stream(partitionKeyFields)
                            .map(partitionKeyField -> {
                                try {
                                    return gson.toJson(checkNotNull(partitionKeyField.get(obj),
                                            "Partition key value null, should add @NonNull on all keys for class %s", obj));
                                } catch (IllegalAccessException ex) {
                                    throw new RuntimeException(ex);
                                }
                            })
                            .toArray(String[]::new)));
        }

        @Override
        public KeyAttribute partitionKey(Map<String, Object> values) {
            String[] partitionValues = Arrays.stream(partitionKeys)
                    .map(partitionKey -> gson.toJson(checkNotNull(values.get(partitionKey), "Partition key missing value for %s", partitionKey)))
                    .toArray(String[]::new);
            checkState(partitionValues.length == values.size(), "Unexpected extra values, partition keys %s values %s", rangeKeys, values);
            return new KeyAttribute(
                    partitionKeyName,
                    StringSerdeUtil.mergeStrings(partitionValues));
        }

        @Override
        public String rangeKeyName() {
            return rangeKeyName;
        }

        @Override
        public KeyAttribute rangeKey(T obj) {
            return new KeyAttribute(
                    rangeKeyName,
                    StringSerdeUtil.mergeStrings(Stream.concat(Stream.of(rangePrefix), Arrays.stream(rangeKeyFields)
                                    .map(rangeKeyField -> {
                                        try {
                                            return gson.toJson(checkNotNull(rangeKeyField.get(obj),
                                                    "Range key value null, should add @NonNull on all keys for class %s", obj));
                                        } catch (IllegalAccessException ex) {
                                            throw new RuntimeException(ex);
                                        }
                                    }))
                            .toArray(String[]::new)));
        }

        @Override
        public KeyAttribute rangeKey(Map<String, Object> values) {
            checkState(rangeKeys.length == values.size(), "Unexpected extra values, range keys %s values %s", rangeKeys, values);
            return new KeyAttribute(
                    rangeKeyName,
                    StringSerdeUtil.mergeStrings(Stream.concat(Stream.of(rangePrefix), Arrays.stream(rangeKeys)
                                    .map(rangeKey -> gson.toJson(checkNotNull(values.get(rangeKey), "Range key missing value for %s", rangeKey))))
                            .toArray(String[]::new)));
        }

        @Override
        public KeyAttribute rangeKeyPartial(Map<String, Object> values) {
            return new KeyAttribute(
                    rangeKeyName,
                    StringSerdeUtil.mergeStrings(Stream.concat(Stream.of(rangePrefix), Arrays.stream(rangeKeys)
                                    .map(values::get)
                                    .takeWhile(Objects::nonNull)
                                    .map(gson::toJson))
                            .toArray(String[]::new)));
        }

        @Override
        public String rangeValuePartial(Map<String, Object> values) {
            return StringSerdeUtil.mergeStrings(Stream.concat(Stream.of(rangePrefix), Arrays.stream(rangeKeys)
                            .map(values::get)
                            .takeWhile(Objects::nonNull)
                            .map(gson::toJson))
                    .toArray(String[]::new));
        }

        @Override
        public Object toDynamoValue(String fieldName, Object object) {
            if (object == null) {
                return null;
            }
            Item tempItem = new Item();
            checkNotNull(fieldMarshallers.get(fieldName), "Unknown field name %s", fieldName)
                    .marshall(object, "tempAttr", tempItem);
            return tempItem.get("tempAttr");
        }

        @Override
        public Object fromDynamoValue(String fieldName, Object object) {
            if (object == null) {
                return null;
            }
            Item tempItem = new Item();
            tempItem.with("tempAttr", object);
            return checkNotNull(fieldUnMarshallers.get(fieldName), "Unknown field name %s", fieldName)
                    .unmarshall("tempAttr", tempItem);
        }

        @Override
        public AttributeValue toAttrValue(String fieldName, Object object) {
            return fieldAttrMarshallers.get(fieldName).marshall(object);
        }

        @Override
        public Object fromAttrValue(String fieldName, AttributeValue attrVal) {
            return fieldAttrUnMarshallers.get(fieldName).unmarshall(attrVal);
        }

        @Override
        public Item toItem(T object) {
            if (object == null) {
                return null;
            }
            return toItemMapper.apply(object);
        }

        @Override
        public T fromItem(Item item) {
            // TODO check consistency of returning values. prevent user from updating fields that are also pk or sk in GSI or LSI
            if (item == null) {
                return null;
            }
            try {
                return objCtor.newInstance(fromItemToCtorArgs.apply(item));
            } catch (InstantiationException | IllegalAccessException | IllegalArgumentException | InvocationTargetException ex) {
                throw new RuntimeException("Failed to construct, item: " + item.toJSON() + " objCtor: " + objCtor.toString(), ex);
            }
        }

        @Override
        public ImmutableMap<String, AttributeValue> toAttrMap(T object) {
            if (object == null) {
                return null;
            }
            return toAttrMapMapper.apply(object);
        }

        @Override
        public T fromAttrMap(Map<String, AttributeValue> attrMap) {
            if (attrMap == null) {
                return null;
            }
            try {
                return objCtor.newInstance(fromAttrMapToCtorArgs.apply(attrMap));
            } catch (InstantiationException | IllegalAccessException | IllegalArgumentException | InvocationTargetException ex) {
                throw new RuntimeException(ex);
            }
        }

        @Override
        public String upsertExpression(T object, Map<String, String> nameMap, Map<String, Object> valMap, ImmutableSet<String> skipFieldNames, String additionalExpression) {
            return upsertExpression(
                    object,
                    nameMap,
                    (key, val) -> valMap.put(":" + key, val),
                    skipFieldNames,
                    additionalExpression);
        }

        @Override
        public String upsertExpressionAttrVal(T object, Map<String, String> nameMap, Map<String, AttributeValue> valMap, ImmutableSet<String> skipFieldNames, String additionalExpression) {
            return upsertExpression(
                    object,
                    nameMap,
                    (key, val) -> valMap.put(":" + key, toAttrValue(key, val)),
                    skipFieldNames,
                    additionalExpression);
        }

        private String upsertExpression(T object, Map<String, String> nameMap, BiConsumer<String, Object> valMapPutter, ImmutableSet<String> skipFieldNames, String additionalExpression) {
            List<String> setUpdates = Lists.newArrayList();
            toItemMapper.apply(object).attributes().forEach(entry -> {
                if (partitionKeyName.equals(entry.getKey()) || rangeKeyName.equals(entry.getKey())) {
                    return;
                }
                if (skipFieldNames.contains(entry.getKey())) {
                    return;
                }
                nameMap.put("#" + entry.getKey(), entry.getKey());
                valMapPutter.accept(entry.getKey(), entry.getValue());
                setUpdates.add("#" + entry.getKey() + " = " + ":" + entry.getKey());
            });
            return "SET " + String.join(", ", setUpdates) + additionalExpression;
        }

        @Override
        public String serializeLastEvaluatedKey(Map<String, AttributeValue> lastEvaluatedKey) {
            return gson.toJson(Maps.transformValues(lastEvaluatedKey, AttributeValue::getS));
        }

        @Override
        public PrimaryKey toExclusiveStartKey(String serializedlastEvaluatedKey) {
            Map<String, String> attributes = gson.fromJson(serializedlastEvaluatedKey, new TypeToken<Map<String, String>>() {
            }.getType());
            return new PrimaryKey(attributes.entrySet().stream()
                    .map(e -> new KeyAttribute(e.getKey(), e.getValue()))
                    .toArray(KeyAttribute[]::new));
        }
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(DynamoMapper.class).to(DynamoMapperImpl.class).asEagerSingleton();
                Multibinder.newSetBinder(binder(), ManagedService.class).addBinding().to(DynamoMapperImpl.class);
                install(ConfigSystem.configModule(Config.class));
            }
        };
    }
}
