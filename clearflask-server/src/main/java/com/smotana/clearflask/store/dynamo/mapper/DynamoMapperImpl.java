package com.smotana.clearflask.store.dynamo.mapper;

import com.amazonaws.services.dynamodbv2.document.Item;
import com.amazonaws.services.dynamodbv2.model.AttributeValue;
import com.google.common.collect.ImmutableMap;
import com.google.common.collect.ImmutableSet;
import com.google.inject.AbstractModule;
import com.google.inject.Module;
import com.google.inject.Singleton;

import java.lang.reflect.Constructor;
import java.lang.reflect.Field;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Modifier;
import java.lang.reflect.Parameter;
import java.lang.reflect.ParameterizedType;
import java.lang.reflect.Type;
import java.text.ParseException;
import java.util.Map;
import java.util.Map.Entry;
import java.util.Set;

import static com.google.common.base.Preconditions.checkNotNull;
import static com.google.common.base.Preconditions.checkState;

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
            DynamoConvertersProxy.MarshallerItem m = findInClassSet(
                    field.getType(),
                    Set.class.isAssignableFrom(field.getType()) ? converters.mis : converters.mic);
            field.setAccessible(true);
            try {
                m.marshall(field.get(object), field.getName(), item);
            } catch (IllegalAccessException ex) {
                throw new IllegalStateException(ex);
            }
        }
        return item;
    }

    @Override
    public <T> T fromItem(Item item, Class<T> objectClazz) {
        Constructor<T> constructor = findConstructor(objectClazz);
        Object[] args = new Object[constructor.getParameterCount()];
        Parameter[] parameters = constructor.getParameters();
        for (int i = 0; i < parameters.length; i++) {
            Parameter parameter = parameters[i];
            DynamoConvertersProxy.UnMarshallerItem u = findInClassSet(
                    parameter.getType(),
                    Set.class.isAssignableFrom(parameter.getType()) ? converters.uis : converters.uic);
            args[i] = u.unmarshall(parameter.getName(), item);
        }

        constructor.setAccessible(true);
        try {
            return (T) constructor.newInstance(args);
        } catch (InstantiationException | IllegalAccessException | InvocationTargetException ex) {
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
            DynamoConvertersProxy.MarshallerAttrVal m = findInClassSet(
                    field.getType(),
                    Set.class.isAssignableFrom(field.getType()) ? converters.mas : converters.mac);
            field.setAccessible(true);
            AttributeValue value;
            try {
                value = m.marshall(field.get(object));
            } catch (IllegalAccessException ex) {
                throw new IllegalStateException(ex);
            }
            mapBuilder.put(field.getName(), value);
        }
        return mapBuilder.build();
    }

    @Override
    public <T> T fromAttrMap(ImmutableMap<String, AttributeValue> attrMap, Class<T> objectClazz) {
        Constructor<T> constructor = findConstructor(objectClazz);
        Object[] args = new Object[constructor.getParameterCount()];
        Parameter[] parameters = constructor.getParameters();
        for (int i = 0; i < parameters.length; i++) {
            Parameter parameter = parameters[i];
            DynamoConvertersProxy.UnMarshallerAttrVal u = findInClassSet(
                    parameter.getType(),
                    Set.class.isAssignableFrom(parameter.getType()) ? converters.uas : converters.uac);
            args[i] = u.unmarshall(checkNotNull(attrMap.get(parameter.getName())));
        }

        constructor.setAccessible(true);
        try {
            return constructor.newInstance(args);
        } catch (InstantiationException | IllegalAccessException | InvocationTargetException ex) {
            throw new RuntimeException(ex);
        }
    }

    private <T> Constructor<T> findConstructor(Class<T> objectClazz) {
        Constructor<?> constructor = null;
        for (Constructor<?> constructorPotential : objectClazz.getDeclaredConstructors()) {
            if (constructor == null) {
                constructor = constructorPotential;
            } else if (constructor.getParameterCount() < constructorPotential.getParameterCount()) {
                constructor = constructorPotential;
            }
        }
        checkState(constructor != null, "Cannot find constructor for class %s", objectClazz.getSimpleName());
        return (Constructor<T>) constructor;
    }

    private <T> T findInClassSet(Class clazz, ImmutableSet<Map.Entry<Class<?>, T>> set) {
        for (Map.Entry<Class<?>, T> entry : set) {
            if (entry.getKey().isAssignableFrom(clazz)) {
                return entry.getValue();
            }
        }
        throw new IllegalStateException("None found");
    }

    private <T> T findMarshaller(Field field, ImmutableSet<Entry<Class<?>, T>> mars, ImmutableSet<Entry<Class<?>, T>> marSets) throws IllegalAccessException, ParseException {
        T marshaller = null;
        Class<?> fieldType = field.getType();
        if (Set.class.isAssignableFrom(fieldType)) {
            // Find set generic class
            Class<?> setClazz;
            Type genericType = field.getGenericType();
            if (genericType instanceof ParameterizedType) {
                Type setType = ((ParameterizedType) genericType).getActualTypeArguments()[0];
                if (setType.toString().equals("byte[]")) {
                    setClazz = byte[].class;
                } else {
                    setClazz = (Class<?>) setType;
                }
            } else {
                setClazz = Object.class;
            }

            for (Entry<Class<?>, T> marSetEntry : mars) {
                if (marSetEntry.getKey().isAssignableFrom(setClazz)) {
                    return marSetEntry.getValue();
                }
            }
        } else {
            for (Entry<Class<?>, T> marSetEntry : marSets) {
                if (marSetEntry.getKey().isAssignableFrom(fieldType)) {
                    return marSetEntry.getValue();
                }
            }
        }

        throw new IllegalStateException("Cannot find (un)marshaller");
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
