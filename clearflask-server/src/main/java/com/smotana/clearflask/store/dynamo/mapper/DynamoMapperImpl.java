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
import lombok.extern.slf4j.Slf4j;

import java.lang.reflect.Constructor;
import java.lang.reflect.Field;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Modifier;
import java.lang.reflect.Parameter;
import java.lang.reflect.ParameterizedType;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

import static com.google.common.base.Preconditions.checkNotNull;
import static com.google.common.base.Preconditions.checkState;

@Slf4j
@Singleton
public class DynamoMapperImpl implements DynamoMapper {

    private final DynamoConvertersProxy.Converters converters = DynamoConvertersProxy.proxy();

    @Override
    public Item toItem(Object object) {
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
            if (val == null) {
                item.withNull(field.getName());
            } else {
                Optional<Class> collectionClazz = getCollectionClazz(field.getType());
                Class itemClazz = collectionClazz.isPresent() ? getCollectionGeneric(field) : field.getType();
                findMarshallerItem(collectionClazz, itemClazz)
                        .marshall(val, field.getName(), item);
            }
        }
        log.trace("toItem class {} item {}", object.getClass().getSimpleName(), item);
        return item;
    }

    @Override
    public <T> T fromItem(Item item, Class<T> objectClazz) {
        log.trace("fromItem class {} item {}", objectClazz.getSimpleName(), item);
        if (item == null) {
            return null;
        }

        List<Object> args = Lists.newArrayList();
        for (Field field : objectClazz.getDeclaredFields()) {
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
            AttributeValue attrVal;
            if (val == null) {
                attrVal = new AttributeValue().withNULL(true);
            } else {
                Optional<Class> collectionClazz = getCollectionClazz(field.getType());
                Class itemClazz = collectionClazz.isPresent() ? getCollectionGeneric(field) : field.getType();
                attrVal = findMarshallerAttrVal(collectionClazz, itemClazz)
                        .marshall(val);
            }
            mapBuilder.put(field.getName(), attrVal);
        }
        ImmutableMap<String, AttributeValue> map = mapBuilder.build();
        log.trace("toAttrMap map {}", map);
        return map;
    }

    @Override
    public <T> T fromAttrMap(Map<String, AttributeValue> attrMap, Class<T> objectClazz) {
        if (attrMap == null) {
            return null;
        }

        List<Object> args = Lists.newArrayList();
        for (Field field : objectClazz.getDeclaredFields()) {
            Optional<Class> collectionClazz = getCollectionClazz(field.getType());
            AttributeValue attrVal = attrMap.get(field.getName());
            if (!collectionClazz.isPresent() && (attrVal == null || attrVal.getNULL() == Boolean.TRUE)) {
                args.add(null);
                continue;
            }
            Class itemClazz = collectionClazz.isPresent() ? getCollectionGeneric(field) : field.getType();
            args.add(findUnMarshallerAttrVal(collectionClazz, itemClazz)
                    .unmarshall(checkNotNull(attrVal)));
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
        return findMarshallerAttrVal(collectionClazz, itemClazz)
                .marshall(object);
    }

    private <T> Constructor<T> findConstructor(Class<T> objectClazz, List<Object> args) {
        OUTER:
        for (Constructor<?> constructorPotential : objectClazz.getDeclaredConstructors()) {
            // Let's only check for args size and assume all types are good...
            if (constructorPotential.getParameterCount() != args.size()) {
                continue;
            }
            return (Constructor<T>) constructorPotential;
        }
        throw new IllegalStateException("Cannot find constructor for class " + objectClazz.getSimpleName());
    }

    private Optional<Class> getCollectionClazz(Class<?> clazz) {
        return Collection.class.isAssignableFrom(clazz)
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
        MarshallerItem f = findInClassSet(itemClazz, converters.mip);
        if (collectionClazz.isPresent()) {
            CollectionMarshallerItem fc = findInClassSet(collectionClazz.get(), converters.mic);
            return (o, a, i) -> fc.marshall(o, a, i, f);
        } else {
            return f;
        }
    }

    private UnMarshallerItem findUnMarshallerItem(Optional<Class> collectionClazz, Class itemClazz) {
        UnMarshallerItem f = findInClassSet(itemClazz, converters.uip);
        if (collectionClazz.isPresent()) {
            CollectionUnMarshallerItem fc = findInClassSet(collectionClazz.get(), converters.uic);
            return (a, i) -> fc.unmarshall(a, i, f);
        } else {
            return f;
        }
    }

    private MarshallerAttrVal findMarshallerAttrVal(Optional<Class> collectionClazz, Class itemClazz) {
        MarshallerAttrVal f = findInClassSet(itemClazz, converters.map);
        if (collectionClazz.isPresent()) {
            CollectionMarshallerAttrVal fc = findInClassSet(collectionClazz.get(), converters.mac);
            return o -> fc.marshall(o, f);
        } else {
            return f;
        }
    }

    private UnMarshallerAttrVal findUnMarshallerAttrVal(Optional<Class> collectionClazz, Class itemClazz) {
        UnMarshallerAttrVal f = findInClassSet(itemClazz, converters.uap);
        if (collectionClazz.isPresent()) {
            CollectionUnMarshallerAttrVal fc = findInClassSet(collectionClazz.get(), converters.uac);
            return a -> fc.unmarshall(a, f);
        } else {
            return f;
        }
    }

    private <T> T findInClassSet(Class clazz, ImmutableSet<Map.Entry<Class<?>, T>> set) {
        for (Map.Entry<Class<?>, T> entry : set) {
            if (entry.getKey().isAssignableFrom(clazz)) {
                return entry.getValue();
            }
        }
        throw new IllegalStateException("None found for class " + clazz.getSimpleName());
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
