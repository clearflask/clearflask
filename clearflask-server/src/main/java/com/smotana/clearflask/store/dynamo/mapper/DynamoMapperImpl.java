package com.smotana.clearflask.store.dynamo.mapper;

import com.amazonaws.services.dynamodbv2.document.Item;
import com.amazonaws.services.dynamodbv2.model.AttributeValue;
import com.google.common.collect.ImmutableMap;
import com.google.common.collect.ImmutableSet;
import com.google.common.collect.Lists;
import com.google.inject.AbstractModule;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.smotana.clearflask.store.dynamo.mapper.DynamoConvertersProxy.CollectionMarshallerAttrVal;
import com.smotana.clearflask.store.dynamo.mapper.DynamoConvertersProxy.CollectionMarshallerItem;
import com.smotana.clearflask.store.dynamo.mapper.DynamoConvertersProxy.CollectionUnMarshallerAttrVal;
import com.smotana.clearflask.store.dynamo.mapper.DynamoConvertersProxy.CollectionUnMarshallerItem;
import com.smotana.clearflask.store.dynamo.mapper.DynamoConvertersProxy.MarshallerAttrVal;
import com.smotana.clearflask.store.dynamo.mapper.DynamoConvertersProxy.MarshallerItem;
import com.smotana.clearflask.store.dynamo.mapper.DynamoConvertersProxy.UnMarshallerAttrVal;
import com.smotana.clearflask.store.dynamo.mapper.DynamoConvertersProxy.UnMarshallerItem;
import com.smotana.clearflask.util.GsonProvider;
import com.smotana.clearflask.util.StringSerdeUtil;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang.ArrayUtils;

import java.lang.reflect.Constructor;
import java.lang.reflect.Field;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Modifier;
import java.lang.reflect.Parameter;
import java.lang.reflect.ParameterizedType;
import java.util.Arrays;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.function.Function;

import static com.google.common.base.Preconditions.*;

@Slf4j
@Singleton
public class DynamoMapperImpl implements DynamoMapper {

    private final DynamoConvertersProxy.Converters converters = DynamoConvertersProxy.proxy();

    @Override
    public Item toItem(Object object) {
        Optional<CompoundPrimaryKey> compoundPrimaryKeyOpt = Optional.ofNullable(object.getClass().getDeclaredAnnotation(CompoundPrimaryKey.class));
        String[] compoundPrimaryKeyValues = compoundPrimaryKeyOpt.map(compoundPrimaryKey -> new String[compoundPrimaryKey.primaryKeys().length]).orElse(null);
        Item item = new Item();
        for (Field field : object.getClass().getDeclaredFields()) {
            checkState(Modifier.isFinal(field.getModifiers()),
                    "Cannot map class %s to item,field %s is not final",
                    object.getClass().getSimpleName(), field.getName());
            field.setAccessible(true);
            Object val;
            try {
                val = field.get(object);
            } catch (IllegalAccessException ex) {
                throw new IllegalStateException(ex);
            }
            int primaryKeyIndex = compoundPrimaryKeyOpt
                    .map(compoundPrimaryKey -> ArrayUtils.indexOf(compoundPrimaryKeyOpt.get().primaryKeys(), field.getName()))
                    .orElse(-1);
            if (primaryKeyIndex != -1) {
                checkState(val != null);
                checkState(field.getType() == String.class);
                compoundPrimaryKeyValues[primaryKeyIndex] = (String) val;
            } else if (val == null) {
                item.withNull(field.getName());
            } else {
                Optional<Class> collectionClazz = getCollectionClazz(field.getType());
                Class itemClazz = collectionClazz.isPresent() ? getCollectionGeneric(field) : field.getType();
                findMarshallerItem(collectionClazz, itemClazz)
                        .marshall(val, field.getName(), item);
            }
        }
        compoundPrimaryKeyOpt.ifPresent(compoundPrimaryKey -> item.withString(
                compoundPrimaryKey.key(),
                StringSerdeUtil.mergeStrings(compoundPrimaryKeyValues)));
        log.trace("toItem {} {}", object.getClass().getSimpleName(), item);
        return item;
    }

    @Override
    public <T> T fromItem(Item item, Class<T> objectClazz) {
        log.trace("fromItem {} {}", objectClazz.getSimpleName(), item);
        if (item == null) {
            return null;
        }

        ImmutableMap<String, String> primaryKeys = Optional.ofNullable(objectClazz.getDeclaredAnnotation(CompoundPrimaryKey.class))
                .map(compoundPrimaryKey -> {
                    String[] primaryKeyValues = StringSerdeUtil.unMergeString(item.getString(compoundPrimaryKey.key()));
                    checkState(primaryKeyValues.length == compoundPrimaryKey.primaryKeys().length);
                    ImmutableMap.Builder<String, String> primaryKeysBuilder = ImmutableMap.builderWithExpectedSize(compoundPrimaryKey.primaryKeys().length);
                    for (int i = 0; i < primaryKeyValues.length; i++) {
                        primaryKeysBuilder.put(compoundPrimaryKey.primaryKeys()[i], primaryKeyValues[i]);
                    }
                    return primaryKeysBuilder.build();
                })
                .orElse(ImmutableMap.of());

        List<Object> args = Lists.newArrayList();
        for (Field field : objectClazz.getDeclaredFields()) {
            if (primaryKeys.containsKey(field.getName())) {
                args.add(primaryKeys.get(field.getName()));
                continue;
            }
            Optional<Class> collectionClazz = getCollectionClazz(field.getType());
            if (!collectionClazz.isPresent() && (!item.isPresent(field.getName()) || item.isNull(field.getName()))) {
                args.add(null);
            } else {
                Class itemClazz = collectionClazz.isPresent() ? getCollectionGeneric(field) : field.getType();
                args.add(findUnMarshallerItem(collectionClazz, itemClazz)
                        .unmarshall(field.getName(), item));
            }
        }

        Constructor<T> constructor = findConstructor(objectClazz, args);
        constructor.setAccessible(true);
        try {
            return constructor.newInstance(args.toArray());
        } catch (InstantiationException | IllegalAccessException | IllegalArgumentException | InvocationTargetException ex) {
            throw new RuntimeException(ex);
        }
    }

    @Override
    public ImmutableMap<String, AttributeValue> toAttrMap(Object object) {
        Optional<CompoundPrimaryKey> compoundPrimaryKeyOpt = Optional.ofNullable(object.getClass().getDeclaredAnnotation(CompoundPrimaryKey.class));
        String[] compoundPrimaryKeyValues = compoundPrimaryKeyOpt.map(compoundPrimaryKey -> new String[compoundPrimaryKey.primaryKeys().length]).orElse(null);
        ImmutableMap.Builder<String, AttributeValue> mapBuilder = ImmutableMap.builder();
        for (Field field : object.getClass().getDeclaredFields()) {
            checkState(Modifier.isFinal(field.getModifiers()),
                    "Cannot map class %s to item,field %s is not final",
                    object.getClass().getSimpleName(), field.getName());
            field.setAccessible(true);
            Object val;
            try {
                val = field.get(object);
            } catch (IllegalAccessException ex) {
                throw new IllegalStateException(ex);
            }
            int primaryKeyIndex = compoundPrimaryKeyOpt
                    .map(compoundPrimaryKey -> ArrayUtils.indexOf(compoundPrimaryKeyOpt.get().primaryKeys(), field.getName()))
                    .orElse(-1);
            if (primaryKeyIndex != -1) {
                checkState(val != null);
                checkState(field.getType() == String.class);
                compoundPrimaryKeyValues[primaryKeyIndex] = (String) val;
            } else if (val == null) {
                mapBuilder.put(field.getName(), new AttributeValue().withNULL(true));
            } else {
                Optional<Class> collectionClazz = getCollectionClazz(field.getType());
                Class itemClazz = collectionClazz.isPresent() ? getCollectionGeneric(field) : field.getType();
                mapBuilder.put(field.getName(), findMarshallerAttrVal(collectionClazz, itemClazz).marshall(val));
            }
        }
        compoundPrimaryKeyOpt.ifPresent(compoundPrimaryKey -> mapBuilder.put(
                compoundPrimaryKey.key(),
                new AttributeValue().withS(StringSerdeUtil.mergeStrings(compoundPrimaryKeyValues))));
        ImmutableMap<String, AttributeValue> map = mapBuilder.build();
        log.trace("toAttrMap {} {}", object.getClass().getSimpleName(), map);
        return map;
    }

    @Override
    public <T> T fromAttrMap(Map<String, AttributeValue> attrMap, Class<T> objectClazz) {
        log.trace("fromAttrMap {} {}", objectClazz.getSimpleName(), attrMap);
        if (attrMap == null) {
            return null;
        }

        ImmutableMap<String, String> primaryKeys = Optional.ofNullable(objectClazz.getDeclaredAnnotation(CompoundPrimaryKey.class))
                .map(compoundPrimaryKey -> {
                    String[] primaryKeyValues = StringSerdeUtil.unMergeString(attrMap.get(compoundPrimaryKey.key()).getS());
                    checkState(primaryKeyValues.length == compoundPrimaryKey.primaryKeys().length);
                    ImmutableMap.Builder<String, String> primaryKeysBuilder = ImmutableMap.builderWithExpectedSize(compoundPrimaryKey.primaryKeys().length);
                    for (int i = 0; i < primaryKeyValues.length; i++) {
                        primaryKeysBuilder.put(compoundPrimaryKey.primaryKeys()[i], primaryKeyValues[i]);
                    }
                    return primaryKeysBuilder.build();
                })
                .orElse(ImmutableMap.of());

        List<Object> args = Lists.newArrayList();
        for (Field field : objectClazz.getDeclaredFields()) {
            if (primaryKeys.containsKey(field.getName())) {
                args.add(primaryKeys.get(field.getName()));
                continue;
            }
            Optional<Class> collectionClazz = getCollectionClazz(field.getType());
            AttributeValue attrVal = attrMap.get(field.getName());
            if (!collectionClazz.isPresent() && (attrVal == null || attrVal.getNULL() == Boolean.TRUE)) {
                args.add(null);
            } else {
                Class itemClazz = collectionClazz.isPresent() ? getCollectionGeneric(field) : field.getType();
                args.add(findUnMarshallerAttrVal(collectionClazz, itemClazz)
                        .unmarshall(checkNotNull(attrVal)));
            }
        }

        Constructor<T> constructor = findConstructor(objectClazz, args);
        constructor.setAccessible(true);
        try {
            return constructor.newInstance(args.toArray());
        } catch (InstantiationException | IllegalAccessException | InvocationTargetException ex) {
            throw new RuntimeException(ex);
        }
    }

    @Override
    public String getCompoundPrimaryKey(ImmutableMap<String, String> keys, Class<?> objectClazz) {
        CompoundPrimaryKey compoundPrimaryKey = objectClazz.getDeclaredAnnotation(CompoundPrimaryKey.class);
        checkState(compoundPrimaryKey != null);
        checkArgument(keys.size() == compoundPrimaryKey.primaryKeys().length);
        String primaryKey = StringSerdeUtil.mergeStrings(Arrays.stream(compoundPrimaryKey
                .primaryKeys())
                .map(key -> checkNotNull(keys.get(key), "getCompoundPrimaryKey key %s is not found", key))
                .toArray(String[]::new));
        log.trace("getCompoundPrimaryKey {} {}", objectClazz.getSimpleName(), primaryKey);
        return primaryKey;
    }

    @Override
    public Object toDynamoValue(Object object) {
        Optional<Class> collectionClazz = getCollectionClazz(object.getClass());
        Class itemClazz;
        if (collectionClazz.isPresent()) {
            itemClazz = ((Collection<?>) object).stream()
                    .filter(Objects::nonNull)
                    .map(i -> (Class) i.getClass())
                    .findAny()
                    .orElse(Object.class);
        } else {
            itemClazz = object.getClass();
        }
        Item tempItem = new Item();
        findMarshallerItem(collectionClazz, itemClazz).marshall(object, "tempAttr", tempItem);
        return tempItem.get("tempAttr");
    }

    private <T> Constructor<T> findConstructor(Class<T> objectClazz, List<Object> args) {
        OUTER:
        for (Constructor<?> constructorPotential : objectClazz.getDeclaredConstructors()) {
            // Let's only check for args size and assume all types are good...
            if (constructorPotential.getParameterCount() != args.size()) {
                log.trace("Unsuitable constructor {}", constructorPotential);
                continue;
            }
            return (Constructor<T>) constructorPotential;
        }
        throw new IllegalStateException("Cannot find constructor for class " + objectClazz.getSimpleName());
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


    private final MarshallerItem GsonMarshallerItem = (o, a, i) -> i.withString(a, GsonProvider.GSON.toJson(o));
    private final MarshallerAttrVal GsonMarshallerAttrVal = o -> new AttributeValue().withS(GsonProvider.GSON.toJson(o));
    private final Function<Class, UnMarshallerAttrVal> GsonUnMarshallerAttrVal = k -> a -> GsonProvider.GSON.fromJson(a.getS(), k);
    private final Function<Class, UnMarshallerItem> GsonUnMarshallerItem = k -> (a, i) -> GsonProvider.GSON.fromJson(i.getString(a), k);

    private MarshallerItem findMarshallerItem(Optional<Class> collectionClazz, Class itemClazz) {
        MarshallerItem f = findInClassSet(itemClazz, converters.mip).orElse(GsonMarshallerItem);
        if (collectionClazz.isPresent()) {
            CollectionMarshallerItem fc = findInClassSet(collectionClazz.get(), converters.mic).get();
            return (o, a, i) -> fc.marshall(o, a, i, f);
        } else {
            return f;
        }
    }

    private UnMarshallerItem findUnMarshallerItem(Optional<Class> collectionClazz, Class itemClazz) {
        UnMarshallerItem f = findInClassSet(itemClazz, converters.uip).orElseGet(() -> GsonUnMarshallerItem.apply(itemClazz));
        if (collectionClazz.isPresent()) {
            CollectionUnMarshallerItem fc = findInClassSet(collectionClazz.get(), converters.uic).get();
            return (a, i) -> fc.unmarshall(a, i, f);
        } else {
            return f;
        }
    }

    private MarshallerAttrVal findMarshallerAttrVal(Optional<Class> collectionClazz, Class itemClazz) {
        MarshallerAttrVal f = findInClassSet(itemClazz, converters.map).orElse(GsonMarshallerAttrVal);
        if (collectionClazz.isPresent()) {
            CollectionMarshallerAttrVal fc = findInClassSet(collectionClazz.get(), converters.mac).get();
            return o -> fc.marshall(o, f);
        } else {
            return f;
        }
    }

    private UnMarshallerAttrVal findUnMarshallerAttrVal(Optional<Class> collectionClazz, Class itemClazz) {
        UnMarshallerAttrVal f = findInClassSet(itemClazz, converters.uap).orElseGet(() -> GsonUnMarshallerAttrVal.apply(itemClazz));
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

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(DynamoMapper.class).to(DynamoMapperImpl.class).asEagerSingleton();
            }
        };
    }
}
