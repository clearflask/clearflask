// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.store.dynamo.mapper;

import com.amazonaws.services.dynamodbv2.datamodeling.marshallers.BooleanToBooleanMarshaller;
import com.amazonaws.services.dynamodbv2.datamodeling.marshallers.ByteArrayToBinaryMarshaller;
import com.amazonaws.services.dynamodbv2.datamodeling.marshallers.ByteBufferToBinaryMarshaller;
import com.amazonaws.services.dynamodbv2.datamodeling.marshallers.CalendarToStringMarshaller;
import com.amazonaws.services.dynamodbv2.datamodeling.marshallers.DateToStringMarshaller;
import com.amazonaws.services.dynamodbv2.datamodeling.marshallers.NumberToNumberMarshaller;
import com.amazonaws.services.dynamodbv2.datamodeling.marshallers.ObjectToStringMarshaller;
import com.amazonaws.services.dynamodbv2.datamodeling.marshallers.StringToStringMarshaller;
import com.amazonaws.services.dynamodbv2.datamodeling.unmarshallers.BigDecimalUnmarshaller;
import com.amazonaws.services.dynamodbv2.datamodeling.unmarshallers.BigIntegerUnmarshaller;
import com.amazonaws.services.dynamodbv2.datamodeling.unmarshallers.BooleanUnmarshaller;
import com.amazonaws.services.dynamodbv2.datamodeling.unmarshallers.ByteArrayUnmarshaller;
import com.amazonaws.services.dynamodbv2.datamodeling.unmarshallers.ByteBufferUnmarshaller;
import com.amazonaws.services.dynamodbv2.datamodeling.unmarshallers.ByteUnmarshaller;
import com.amazonaws.services.dynamodbv2.datamodeling.unmarshallers.CalendarUnmarshaller;
import com.amazonaws.services.dynamodbv2.datamodeling.unmarshallers.DateUnmarshaller;
import com.amazonaws.services.dynamodbv2.datamodeling.unmarshallers.DoubleUnmarshaller;
import com.amazonaws.services.dynamodbv2.datamodeling.unmarshallers.FloatUnmarshaller;
import com.amazonaws.services.dynamodbv2.datamodeling.unmarshallers.IntegerUnmarshaller;
import com.amazonaws.services.dynamodbv2.datamodeling.unmarshallers.LongUnmarshaller;
import com.amazonaws.services.dynamodbv2.datamodeling.unmarshallers.ShortUnmarshaller;
import com.amazonaws.services.dynamodbv2.datamodeling.unmarshallers.StringUnmarshaller;
import com.amazonaws.services.dynamodbv2.datamodeling.unmarshallers.UUIDUnmarshaller;
import com.amazonaws.services.dynamodbv2.document.Item;
import com.amazonaws.services.dynamodbv2.model.AttributeValue;
import com.amazonaws.util.DateUtils;
import com.google.common.base.Strings;
import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableMap;
import com.google.common.collect.ImmutableSet;
import lombok.Value;
import org.apache.commons.lang.ArrayUtils;

import java.math.BigDecimal;
import java.math.BigInteger;
import java.nio.ByteBuffer;
import java.time.Instant;
import java.util.Calendar;
import java.util.Date;
import java.util.GregorianCalendar;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;


public class DynamoConvertersProxy {

    private static Converters convertersCache = null;

    @Value
    public static class Converters {
        /** Marshaller for Item Scalar */
        public final ImmutableSet<Map.Entry<Class<?>, MarshallerItem>> mip;
        /** UnMarshaller for Item Scalar */
        public final ImmutableSet<Map.Entry<Class<?>, UnMarshallerItem>> uip;
        /** Marshaller for AttributeValue Scalar */
        public final ImmutableSet<Map.Entry<Class<?>, MarshallerAttrVal>> map;
        /** UnMarshaller for AttributeValue Scalar */
        public final ImmutableSet<Map.Entry<Class<?>, UnMarshallerAttrVal>> uap;
        /** Marshaller for Item Collection */
        public final ImmutableSet<Map.Entry<Class<?>, CollectionMarshallerItem>> mic;
        /** UnMarshaller for Item Collection */
        public final ImmutableSet<Map.Entry<Class<?>, CollectionUnMarshallerItem>> uic;
        /** Marshaller for AttributeValue Collection */
        public final ImmutableSet<Map.Entry<Class<?>, CollectionMarshallerAttrVal>> mac;
        /** UnMarshaller for AttributeValue Collection */
        public final ImmutableSet<Map.Entry<Class<?>, CollectionUnMarshallerAttrVal>> uac;
        /** Default instance */
        public final ImmutableSet<Map.Entry<Class<?>, DefaultInstanceGetter>> di;
    }

    public static Converters proxy() {
        if (convertersCache != null) {
            return convertersCache;
        }

        ImmutableMap.Builder<Class<?>, MarshallerItem> mip = new ImmutableMap.Builder<>();
        ImmutableMap.Builder<Class<?>, UnMarshallerItem> uip = new ImmutableMap.Builder<>();
        ImmutableMap.Builder<Class<?>, MarshallerAttrVal> map = new ImmutableMap.Builder<>();
        ImmutableMap.Builder<Class<?>, UnMarshallerAttrVal> uap = new ImmutableMap.Builder<>();
        ImmutableMap.Builder<Class<?>, CollectionMarshallerItem> mic = new ImmutableMap.Builder<>();
        ImmutableMap.Builder<Class<?>, CollectionUnMarshallerItem> uic = new ImmutableMap.Builder<>();
        ImmutableMap.Builder<Class<?>, CollectionMarshallerAttrVal> mac = new ImmutableMap.Builder<>();
        ImmutableMap.Builder<Class<?>, CollectionUnMarshallerAttrVal> uac = new ImmutableMap.Builder<>();
        ImmutableMap.Builder<Class<?>, DefaultInstanceGetter> di = new ImmutableMap.Builder<>();

        map.put(Date.class, DateToStringMarshaller.instance()::marshall);
        mip.put(Date.class, (o, a, i) -> i.withString(a, DateUtils.formatISO8601Date((Date) o)));
        di.put(Date.class, () -> new Date(0L));
        map.put(Calendar.class, CalendarToStringMarshaller.instance()::marshall);
        mip.put(Calendar.class, (o, a, i) -> i.withString(a, DateUtils.formatISO8601Date(((Calendar) o).getTime())));
        di.put(Calendar.class, Calendar::getInstance);
        map.put(Boolean.class, BooleanToBooleanMarshaller.instance()::marshall);
        mip.put(Boolean.class, (o, a, i) -> i.withBoolean(a, (boolean) o));
        di.put(Boolean.class, () -> Boolean.FALSE);
        map.put(boolean.class, BooleanToBooleanMarshaller.instance()::marshall);
        mip.put(boolean.class, (o, a, i) -> i.withBoolean(a, (boolean) o));
        di.put(boolean.class, () -> false);
        map.put(Number.class, NumberToNumberMarshaller.instance()::marshall);
        mip.put(Number.class, (o, a, i) -> i.withNumber(a, (Number) o));
        di.put(Number.class, () -> 0L);
        map.put(byte.class, NumberToNumberMarshaller.instance()::marshall);
        mip.put(byte.class, (o, a, i) -> i.withNumber(a, (byte) o));
        di.put(byte.class, () -> 0);
        map.put(short.class, NumberToNumberMarshaller.instance()::marshall);
        mip.put(short.class, (o, a, i) -> i.withNumber(a, (short) o));
        di.put(short.class, () -> 0);
        map.put(int.class, NumberToNumberMarshaller.instance()::marshall);
        mip.put(int.class, (o, a, i) -> i.withInt(a, (int) o));
        di.put(int.class, () -> 0);
        map.put(Integer.class, o -> new AttributeValue().withN(o.toString()));
        mip.put(Integer.class, (o, a, i) -> i.withNumber(a, (Integer) o));
        di.put(Integer.class, () -> Integer.valueOf(0));
        map.put(long.class, NumberToNumberMarshaller.instance()::marshall);
        mip.put(long.class, (o, a, i) -> i.withNumber(a, (long) o));
        di.put(long.class, () -> 0L);
        map.put(float.class, NumberToNumberMarshaller.instance()::marshall);
        mip.put(float.class, (o, a, i) -> i.withNumber(a, (float) o));
        di.put(float.class, () -> 0f);
        map.put(double.class, NumberToNumberMarshaller.instance()::marshall);
        mip.put(double.class, (o, a, i) -> i.withDouble(a, (double) o));
        di.put(double.class, () -> 0d);
        map.put(BigDecimal.class, o -> new AttributeValue().withN(((BigDecimal) o).toPlainString()));
        mip.put(BigDecimal.class, (o, a, i) -> i.withNumber(a, (BigDecimal) o));
        di.put(BigDecimal.class, () -> BigInteger.ZERO);
        map.put(BigInteger.class, o -> new AttributeValue().withN(o.toString()));
        mip.put(BigInteger.class, (o, a, i) -> i.withBigInteger(a, (BigInteger) o));
        di.put(BigInteger.class, () -> BigInteger.ZERO);
        map.put(String.class, StringToStringMarshaller.instance()::marshall);
        mip.put(String.class, (o, a, i) -> {
            // Dynamo doesn't support empty strings, store empty as null
            if (o != null && !((String) o).isEmpty()) {
                i.withString(a, (String) o);
            }
        });
        di.put(String.class, () -> "");
        map.put(UUID.class, ObjectToStringMarshaller.instance()::marshall);
        mip.put(UUID.class, (o, a, i) -> i.withString(a, o.toString()));
        di.put(UUID.class, () -> new UUID(0, 0));
        map.put(ByteBuffer.class, ByteBufferToBinaryMarshaller.instance()::marshall);
        mip.put(ByteBuffer.class, (o, a, i) -> i.withBinary(a, (ByteBuffer) o));
        di.put(ByteBuffer.class, () -> ByteBuffer.allocate(0));
        map.put(byte[].class, ByteArrayToBinaryMarshaller.instance()::marshall);
        mip.put(byte[].class, (o, a, i) -> i.withBinary(a, (byte[]) o));
        di.put(byte[].class, () -> new byte[]{});
        map.put(Byte[].class, o -> ByteArrayToBinaryMarshaller.instance().marshall(ArrayUtils.toPrimitive((Byte[]) o)));
        mip.put(Byte[].class, (o, a, i) -> i.withBinary(a, ArrayUtils.toPrimitive((Byte[]) o)));
        di.put(Byte[].class, () -> new Byte[]{});
        map.put(Instant.class, o -> new AttributeValue().withS(((Instant) o).toString()));
        mip.put(Instant.class, (o, a, i) -> i.withString(a, ((Instant) o).toString()));
        di.put(Instant.class, () -> Instant.EPOCH);

        uap.put(double.class, DoubleUnmarshaller.instance()::unmarshall);
        uip.put(double.class, (a, i) -> i.getDouble(a));
        uap.put(Double.class, DoubleUnmarshaller.instance()::unmarshall);
        uip.put(Double.class, (a, i) -> i.getDouble(a));
        uap.put(BigDecimal.class, BigDecimalUnmarshaller.instance()::unmarshall);
        uip.put(BigDecimal.class, (a, i) -> i.getNumber(a));
        uap.put(BigInteger.class, BigIntegerUnmarshaller.instance()::unmarshall);
        uip.put(BigInteger.class, (a, i) -> i.getBigInteger(a));
        uap.put(int.class, IntegerUnmarshaller.instance()::unmarshall);
        uip.put(int.class, (a, i) -> i.getInt(a));
        uap.put(Integer.class, IntegerUnmarshaller.instance()::unmarshall);
        uip.put(Integer.class, (a, i) -> i.getInt(a));
        uap.put(float.class, FloatUnmarshaller.instance()::unmarshall);
        uip.put(float.class, (a, i) -> i.getFloat(a));
        uap.put(Float.class, FloatUnmarshaller.instance()::unmarshall);
        uip.put(Float.class, (a, i) -> i.getFloat(a));
        uap.put(byte.class, ByteUnmarshaller.instance()::unmarshall);
        uip.put(byte.class, (a, i) -> i.getNumber(a).byteValue());
        uap.put(Byte.class, ByteUnmarshaller.instance()::unmarshall);
        uip.put(Byte.class, (a, i) -> i.getNumber(a).byteValue());
        uap.put(long.class, LongUnmarshaller.instance()::unmarshall);
        uip.put(long.class, (a, i) -> i.getLong(a));
        uap.put(Long.class, LongUnmarshaller.instance()::unmarshall);
        uip.put(Long.class, (a, i) -> i.getLong(a));
        uap.put(short.class, ShortUnmarshaller.instance()::unmarshall);
        uip.put(short.class, (a, i) -> i.getShort(a));
        uap.put(Short.class, ShortUnmarshaller.instance()::unmarshall);
        uip.put(Short.class, (a, i) -> i.getShort(a));
        uap.put(boolean.class, BooleanUnmarshaller.instance()::unmarshall);
        uip.put(boolean.class, (a, i) -> i.getBoolean(a));
        uap.put(Boolean.class, BooleanUnmarshaller.instance()::unmarshall);
        uip.put(Boolean.class, (a, i) -> i.getBoolean(a));
        uap.put(Date.class, DateUnmarshaller.instance()::unmarshall);
        uip.put(Date.class, (a, i) -> DateUtils.parseISO8601Date(i.getString(a)));
        uap.put(Calendar.class, CalendarUnmarshaller.instance()::unmarshall);
        uip.put(Calendar.class, (a, i) -> {
            Calendar cal = GregorianCalendar.getInstance();
            cal.setTime(DateUtils.parseISO8601Date(i.getString(a)));
            return cal;
        });
        uap.put(ByteBuffer.class, ByteBufferUnmarshaller.instance()::unmarshall);
        uip.put(ByteBuffer.class, (a, i) -> i.getByteBuffer(a));
        uap.put(byte[].class, ByteArrayUnmarshaller.instance()::unmarshall);
        uip.put(byte[].class, (a, i) -> i.getBinary(a));
        uap.put(Byte[].class, v -> ArrayUtils.toObject((byte[]) ByteArrayUnmarshaller.instance().unmarshall(v)));
        uip.put(Byte[].class, (a, i) -> ArrayUtils.toObject(i.getBinary(a)));
        uap.put(UUID.class, UUIDUnmarshaller.instance()::unmarshall);
        uip.put(UUID.class, (a, i) -> UUID.fromString(i.getString(a)));
        uap.put(String.class, StringUnmarshaller.instance()::unmarshall);
        uip.put(String.class, (a, i) -> i.getString(a));
        uap.put(Instant.class, a -> Instant.parse(a.getS()));
        uip.put(Instant.class, (a, i) -> Instant.parse(i.getString(a)));

        mic.put(List.class, (o, a, i, m) -> {
            if (o == null) {
                return;
            }
            Item itemProxy = new Item();
            i.withList(a, ((List<?>) o).stream()
                    .map(i2 -> {
                        m.marshall(i2, "a", itemProxy);
                        return itemProxy.get("a");
                    })
                    .collect(ImmutableList.toImmutableList()));
        });
        uic.put(List.class, (a, i, u) -> {
            if (!i.isPresent(a) || i.isNull(a)) {
                return null;
            }
            Item itemProxy = new Item();
            return i.getList(a).stream()
                    .map(i2 -> {
                        itemProxy.with("a", i2);
                        return u.unmarshall("a", itemProxy);
                    })
                    .collect(ImmutableList.toImmutableList());

        });
        mac.put(List.class, (o, m) -> o == null ? null : new AttributeValue().withL(((List<?>) o).stream()
                .map(m::marshall)
                .collect(ImmutableList.toImmutableList())));
        uac.put(List.class, (a, u) -> a == null || a.getNULL() == Boolean.TRUE ? null : a.getL().stream()
                .map(u::unmarshall)
                .collect(ImmutableList.toImmutableList()));
        di.put(List.class, ImmutableList::of);

        mic.put(Map.class, (o, a, i, m) -> {
            if (o == null) {
                return;
            } else {
                Item itemProxy = new Item();
                i.withMap(a, ((Map<?, ?>) o).entrySet().stream()
                        .collect(ImmutableMap.toImmutableMap(
                                e -> (String) e.getKey(),
                                e -> {
                                    m.marshall(e.getValue(), "a", itemProxy);
                                    return itemProxy.get("a");
                                }
                        )));
            }
        });
        uic.put(Map.class, (a, i, u) -> {
            if (!i.isPresent(a) || i.isNull(a)) {
                return null;
            } else {
                Item itemProxy = new Item();
                return i.getMap(a).entrySet().stream()
                        .collect(ImmutableMap.toImmutableMap(
                                e -> (String) e.getKey(),
                                e -> {
                                    itemProxy.with("a", e.getValue());
                                    return u.unmarshall("a", itemProxy);
                                }
                        ));
            }
        });
        mac.put(Map.class, (o, m) -> o == null ? null : new AttributeValue().withM(((Map<?, ?>) o).entrySet().stream()
                .collect(ImmutableMap.toImmutableMap(
                        e -> (String) e.getKey(),
                        e -> m.marshall(e.getValue())
                ))));
        uac.put(Map.class, (a, u) -> a == null || a.getNULL() == Boolean.TRUE ? null : a.getM().entrySet().stream()
                .collect(ImmutableMap.toImmutableMap(
                        e -> (String) e.getKey(),
                        e -> u.unmarshall(e.getValue())
                )));
        di.put(Map.class, ImmutableMap::of);

        mic.put(Set.class, (o, a, i, m) -> {
            // Empty set not allowed by DynamoDB, also null value prevents from adding to set, so:
            // Missing in DB == empty set
            if (o == null || ((Set<?>) o).isEmpty()) {
                return;
            }
            Item itemProxy = new Item();
            i.with(a, ((Set<?>) o).stream()
                    .map(i2 -> {
                        m.marshall(i2, "a", itemProxy);
                        return itemProxy.get("a");
                    })
                    .collect(ImmutableSet.toImmutableSet()));
        });
        uic.put(Set.class, (a, i, u) -> {
            // Empty set not allowed by DynamoDB, also null value prevents from adding to set, so:
            // Missing in DB == empty set
            if (!i.isPresent(a) || i.isNull(a)) {
                return ImmutableSet.of();
            }
            Item itemProxy = new Item();
            return ((Set<?>) i.get(a)).stream()
                    .map(i2 -> {
                        itemProxy.with("a", i2);
                        return u.unmarshall("a", itemProxy);
                    })
                    .collect(ImmutableSet.toImmutableSet());
        });
        mac.put(Set.class, (o, m) -> {
            // Empty set not allowed by DynamoDB, also null value prevents from adding to set, so:
            // Missing in DB == empty set
            if (o == null || ((Set<?>) o).isEmpty()) {
                return null;
            }
            int[] setType = {0};
            ImmutableSet<?> set = ((Set<?>) o).stream()
                    .map(m::marshall)
                    .map(v -> {
                        if (!Strings.isNullOrEmpty(v.getS())) {
                            setType[0] = 0;
                            return v.getS();
                        } else if (!Strings.isNullOrEmpty(v.getN())) {
                            setType[0] = 1;
                            return v.getN();
                        } else if (v.getB() != null) {
                            setType[0] = 2;
                            return v.getB();
                        } else if (v.getNULL() != null) {
                            throw new IllegalStateException("Set cannot have null item");
                        } else {
                            throw new IllegalStateException("Set of unsupported type: " + v.toString());
                        }
                    })
                    .collect(ImmutableSet.toImmutableSet());
            if (setType[0] == 0) {
                return new AttributeValue().withSS((ImmutableSet<String>) set);
            } else if (setType[0] == 1) {
                return new AttributeValue().withNS((ImmutableSet<String>) set);
            } else {
                return new AttributeValue().withBS((ImmutableSet<ByteBuffer>) set);
            }
        });
        uac.put(Set.class, (a, u) -> {
            // Empty set not allowed by DynamoDB, also null value prevents from adding to set, so:
            // Missing in DB == empty set
            if (a == null || a.getNULL() == Boolean.TRUE) {
                return ImmutableSet.of();
            } else if (a.getL() != null && a.getL().isEmpty()) {
                return ImmutableSet.of();
            } else if (a.getSS() != null) {
                return a.getSS().stream().map(i -> u.unmarshall(new AttributeValue().withS(i))).collect(ImmutableSet.toImmutableSet());
            } else if (a.getNS() != null) {
                return a.getNS().stream().map(i -> u.unmarshall(new AttributeValue().withN(i))).collect(ImmutableSet.toImmutableSet());
            } else if (a.getBS() != null) {
                return a.getBS().stream().map(i -> u.unmarshall(new AttributeValue().withB(i))).collect(ImmutableSet.toImmutableSet());
            } else {
                return ImmutableSet.of();
            }
        });
        di.put(Set.class, ImmutableSet::of);

        convertersCache = new Converters(
                mip.build().entrySet(),
                uip.build().entrySet(),
                map.build().entrySet(),
                uap.build().entrySet(),
                mic.build().entrySet(),
                uic.build().entrySet(),
                mac.build().entrySet(),
                uac.build().entrySet(),
                di.build().entrySet());
        return convertersCache;
    }

    @FunctionalInterface
    public interface MarshallerAttrVal {
        AttributeValue marshall(Object object);
    }

    @FunctionalInterface
    public interface UnMarshallerAttrVal {
        Object unmarshall(AttributeValue attributeValue);
    }

    @FunctionalInterface
    public interface MarshallerItem {
        void marshall(Object object, String attrName, Item item);
    }

    @FunctionalInterface
    public interface UnMarshallerItem {
        Object unmarshall(String attrName, Item item);
    }

    @FunctionalInterface
    public interface CollectionMarshallerAttrVal {
        AttributeValue marshall(Object object, MarshallerAttrVal marshaller);
    }

    @FunctionalInterface
    public interface CollectionUnMarshallerAttrVal {
        Object unmarshall(AttributeValue attributeValue, UnMarshallerAttrVal unMarshaller);
    }

    @FunctionalInterface
    public interface CollectionMarshallerItem {
        void marshall(Object object, String attrName, Item item, MarshallerItem marshaller);
    }

    @FunctionalInterface
    public interface CollectionUnMarshallerItem {
        Object unmarshall(String attrName, Item item, UnMarshallerItem unMarshaller);
    }

    @FunctionalInterface
    public interface DefaultInstanceGetter {
        Object getDefaultInstance();
    }

}
