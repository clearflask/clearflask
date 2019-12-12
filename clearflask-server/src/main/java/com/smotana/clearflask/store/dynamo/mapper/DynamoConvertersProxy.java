package com.smotana.clearflask.store.dynamo.mapper;

import com.amazonaws.services.dynamodbv2.datamodeling.marshallers.BooleanToBooleanMarshaller;
import com.amazonaws.services.dynamodbv2.datamodeling.marshallers.ByteArraySetToBinarySetMarshaller;
import com.amazonaws.services.dynamodbv2.datamodeling.marshallers.ByteArrayToBinaryMarshaller;
import com.amazonaws.services.dynamodbv2.datamodeling.marshallers.ByteBufferSetToBinarySetMarshaller;
import com.amazonaws.services.dynamodbv2.datamodeling.marshallers.ByteBufferToBinaryMarshaller;
import com.amazonaws.services.dynamodbv2.datamodeling.marshallers.CalendarSetToStringSetMarshaller;
import com.amazonaws.services.dynamodbv2.datamodeling.marshallers.CalendarToStringMarshaller;
import com.amazonaws.services.dynamodbv2.datamodeling.marshallers.CollectionToListMarshaller;
import com.amazonaws.services.dynamodbv2.datamodeling.marshallers.DateSetToStringSetMarshaller;
import com.amazonaws.services.dynamodbv2.datamodeling.marshallers.DateToStringMarshaller;
import com.amazonaws.services.dynamodbv2.datamodeling.marshallers.MapToMapMarshaller;
import com.amazonaws.services.dynamodbv2.datamodeling.marshallers.NumberSetToNumberSetMarshaller;
import com.amazonaws.services.dynamodbv2.datamodeling.marshallers.NumberToNumberMarshaller;
import com.amazonaws.services.dynamodbv2.datamodeling.marshallers.ObjectToMapMarshaller;
import com.amazonaws.services.dynamodbv2.datamodeling.marshallers.ObjectToStringMarshaller;
import com.amazonaws.services.dynamodbv2.datamodeling.marshallers.StringSetToStringSetMarshaller;
import com.amazonaws.services.dynamodbv2.datamodeling.marshallers.StringToStringMarshaller;
import com.amazonaws.services.dynamodbv2.datamodeling.marshallers.UUIDSetToStringSetMarshaller;
import com.amazonaws.services.dynamodbv2.datamodeling.unmarshallers.BigDecimalSetUnmarshaller;
import com.amazonaws.services.dynamodbv2.datamodeling.unmarshallers.BigDecimalUnmarshaller;
import com.amazonaws.services.dynamodbv2.datamodeling.unmarshallers.BigIntegerSetUnmarshaller;
import com.amazonaws.services.dynamodbv2.datamodeling.unmarshallers.BigIntegerUnmarshaller;
import com.amazonaws.services.dynamodbv2.datamodeling.unmarshallers.BooleanUnmarshaller;
import com.amazonaws.services.dynamodbv2.datamodeling.unmarshallers.ByteArraySetUnmarshaller;
import com.amazonaws.services.dynamodbv2.datamodeling.unmarshallers.ByteArrayUnmarshaller;
import com.amazonaws.services.dynamodbv2.datamodeling.unmarshallers.ByteBufferSetUnmarshaller;
import com.amazonaws.services.dynamodbv2.datamodeling.unmarshallers.ByteBufferUnmarshaller;
import com.amazonaws.services.dynamodbv2.datamodeling.unmarshallers.ByteSetUnmarshaller;
import com.amazonaws.services.dynamodbv2.datamodeling.unmarshallers.ByteUnmarshaller;
import com.amazonaws.services.dynamodbv2.datamodeling.unmarshallers.CalendarSetUnmarshaller;
import com.amazonaws.services.dynamodbv2.datamodeling.unmarshallers.CalendarUnmarshaller;
import com.amazonaws.services.dynamodbv2.datamodeling.unmarshallers.DateSetUnmarshaller;
import com.amazonaws.services.dynamodbv2.datamodeling.unmarshallers.DateUnmarshaller;
import com.amazonaws.services.dynamodbv2.datamodeling.unmarshallers.DoubleSetUnmarshaller;
import com.amazonaws.services.dynamodbv2.datamodeling.unmarshallers.DoubleUnmarshaller;
import com.amazonaws.services.dynamodbv2.datamodeling.unmarshallers.FloatSetUnmarshaller;
import com.amazonaws.services.dynamodbv2.datamodeling.unmarshallers.FloatUnmarshaller;
import com.amazonaws.services.dynamodbv2.datamodeling.unmarshallers.IntegerSetUnmarshaller;
import com.amazonaws.services.dynamodbv2.datamodeling.unmarshallers.IntegerUnmarshaller;
import com.amazonaws.services.dynamodbv2.datamodeling.unmarshallers.ListUnmarshaller;
import com.amazonaws.services.dynamodbv2.datamodeling.unmarshallers.LongSetUnmarshaller;
import com.amazonaws.services.dynamodbv2.datamodeling.unmarshallers.LongUnmarshaller;
import com.amazonaws.services.dynamodbv2.datamodeling.unmarshallers.MapUnmarshaller;
import com.amazonaws.services.dynamodbv2.datamodeling.unmarshallers.ShortSetUnmarshaller;
import com.amazonaws.services.dynamodbv2.datamodeling.unmarshallers.ShortUnmarshaller;
import com.amazonaws.services.dynamodbv2.datamodeling.unmarshallers.StringSetUnmarshaller;
import com.amazonaws.services.dynamodbv2.datamodeling.unmarshallers.StringUnmarshaller;
import com.amazonaws.services.dynamodbv2.datamodeling.unmarshallers.UUIDSetUnmarshaller;
import com.amazonaws.services.dynamodbv2.datamodeling.unmarshallers.UUIDUnmarshaller;
import com.amazonaws.services.dynamodbv2.document.Item;
import com.amazonaws.services.dynamodbv2.model.AttributeValue;
import com.amazonaws.util.DateUtils;
import com.google.common.collect.ImmutableMap;
import com.google.common.collect.ImmutableSet;
import lombok.Value;

import java.math.BigDecimal;
import java.math.BigInteger;
import java.nio.ByteBuffer;
import java.text.ParseException;
import java.util.Calendar;
import java.util.Date;
import java.util.GregorianCalendar;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

public class DynamoConvertersProxy {

    @Value
    public static class Converters {
        /** Marshaller for Item Scalar */
        public final ImmutableSet<Map.Entry<Class<?>, MarshallerItem>> mic;
        /** UnMarshaller for Item Scalar */
        public final ImmutableSet<Map.Entry<Class<?>, UnMarshallerItem>> uic;
        /** Marshaller for Item Set */
        public final ImmutableSet<Map.Entry<Class<?>, MarshallerItem>> mis;
        /** UnMarshaller for Item Set */
        public final ImmutableSet<Map.Entry<Class<?>, UnMarshallerItem>> uis;
        /** Marshaller for AttributeValue Scalar */
        public final ImmutableSet<Map.Entry<Class<?>, MarshallerAttrVal>> mac;
        /** UnMarshaller for AttributeValue Scalar */
        public final ImmutableSet<Map.Entry<Class<?>, UnMarshallerAttrVal>> uac;
        /** Marshaller for AttributeValue Set */
        public final ImmutableSet<Map.Entry<Class<?>, MarshallerAttrVal>> mas;
        /** UnMarshaller for AttributeValue Set */
        public final ImmutableSet<Map.Entry<Class<?>, UnMarshallerAttrVal>> uas;
    }

    public static Converters proxy() {
        ImmutableMap.Builder<Class<?>, MarshallerItem> mic = new ImmutableMap.Builder<>();
        ImmutableMap.Builder<Class<?>, UnMarshallerItem> uic = new ImmutableMap.Builder<>();
        ImmutableMap.Builder<Class<?>, MarshallerItem> mis = new ImmutableMap.Builder<>();
        ImmutableMap.Builder<Class<?>, UnMarshallerItem> uis = new ImmutableMap.Builder<>();
        ImmutableMap.Builder<Class<?>, MarshallerAttrVal> mac = new ImmutableMap.Builder<>();
        ImmutableMap.Builder<Class<?>, UnMarshallerAttrVal> uac = new ImmutableMap.Builder<>();
        ImmutableMap.Builder<Class<?>, MarshallerAttrVal> mas = new ImmutableMap.Builder<>();
        ImmutableMap.Builder<Class<?>, UnMarshallerAttrVal> uas = new ImmutableMap.Builder<>();

        mac.put(Date.class, DateToStringMarshaller.instance()::marshall);
        mic.put(Date.class, (o, a, i) -> i.withString(a, DateUtils.formatISO8601Date((Date) o)));
        mac.put(Calendar.class, CalendarToStringMarshaller.instance()::marshall);
        mic.put(Calendar.class, (o, a, i) -> i.withString(a, DateUtils.formatISO8601Date(((Calendar) o).getTime())));
        mac.put(Boolean.class, BooleanToBooleanMarshaller.instance()::marshall);
        mic.put(Boolean.class, (o, a, i) -> i.withBoolean(a, (boolean) o));
        mac.put(boolean.class, BooleanToBooleanMarshaller.instance()::marshall);
        mic.put(boolean.class, (o, a, i) -> i.withBoolean(a, (boolean) o));
        mac.put(Number.class, NumberToNumberMarshaller.instance()::marshall);
        mic.put(Number.class, (o, a, i) -> i.withNumber(a, (Number) o));
        mac.put(byte.class, NumberToNumberMarshaller.instance()::marshall);
        mic.put(byte.class, (o, a, i) -> i.withNumber(a, (byte) o));
        mac.put(short.class, NumberToNumberMarshaller.instance()::marshall);
        mic.put(short.class, (o, a, i) -> i.withNumber(a, (short) o));
        mac.put(int.class, NumberToNumberMarshaller.instance()::marshall);
        mic.put(int.class, (o, a, i) -> i.withNumber(a, (int) o));
        mac.put(long.class, NumberToNumberMarshaller.instance()::marshall);
        mic.put(long.class, (o, a, i) -> i.withNumber(a, (long) o));
        mac.put(float.class, NumberToNumberMarshaller.instance()::marshall);
        mic.put(float.class, (o, a, i) -> i.withNumber(a, (float) o));
        mac.put(double.class, NumberToNumberMarshaller.instance()::marshall);
        mic.put(double.class, (o, a, i) -> i.withDouble(a, (double) o));
        mac.put(String.class, StringToStringMarshaller.instance()::marshall);
        mic.put(String.class, (o, a, i) -> i.withString(a, (String) o));
        mac.put(UUID.class, ObjectToStringMarshaller.instance()::marshall);
        mic.put(UUID.class, (o, a, i) -> i.withString(a, o.toString()));
        mac.put(ByteBuffer.class, ByteBufferToBinaryMarshaller.instance()::marshall);
        mic.put(ByteBuffer.class, (o, a, i) -> i.withBinary(a, (ByteBuffer) o));
        mac.put(byte[].class, ByteArrayToBinaryMarshaller.instance()::marshall);
        mic.put(byte[].class, (o, a, i) -> i.withBinary(a, (byte[]) o));
        mac.put(List.class, CollectionToListMarshaller.instance()::marshall);
        mic.put(List.class, (o, a, i) -> i.withList(a, (List) o));
        mac.put(Map.class, MapToMapMarshaller.instance()::marshall);
        mic.put(Map.class, (o, a, i) -> i.withMap(a, (Map) o));
        mac.put(Object.class, ObjectToMapMarshaller.instance()::marshall);
        mic.put(Object.class, (o, a, i) -> i.with(a, o));

        mas.put(Date.class, DateSetToStringSetMarshaller.instance()::marshall);
        mis.put(Date.class, (o, a, i) -> i.withStringSet(a, ((Set<Date>) o).stream().map(DateUtils::formatISO8601Date).collect(Collectors.toSet())));
        mas.put(Calendar.class, CalendarSetToStringSetMarshaller.instance()::marshall);
        mis.put(Calendar.class, (o, a, i) -> i.withStringSet(a, ((Set<Calendar>) o).stream().map(Calendar::getTime).map(DateUtils::formatISO8601Date).collect(Collectors.toSet())));
        mas.put(Number.class, NumberSetToNumberSetMarshaller.instance()::marshall);
        mis.put(Date.class, (o, a, i) -> i.withStringSet(a, ((Set<Date>) o).stream().map(DateUtils::formatISO8601Date).collect(Collectors.toSet())));
        mas.put(byte.class, NumberSetToNumberSetMarshaller.instance()::marshall);
        mis.put(byte.class, (o, a, i) -> i.withStringSet(a, ((Set<? extends Number>) o).stream().map(Number::toString).collect(Collectors.toSet())));
        mas.put(short.class, NumberSetToNumberSetMarshaller.instance()::marshall);
        mis.put(short.class, (o, a, i) -> i.withStringSet(a, ((Set<? extends Number>) o).stream().map(Number::toString).collect(Collectors.toSet())));
        mas.put(int.class, NumberSetToNumberSetMarshaller.instance()::marshall);
        mis.put(int.class, (o, a, i) -> i.withStringSet(a, ((Set<? extends Number>) o).stream().map(Number::toString).collect(Collectors.toSet())));
        mas.put(long.class, NumberSetToNumberSetMarshaller.instance()::marshall);
        mis.put(long.class, (o, a, i) -> i.withStringSet(a, ((Set<? extends Number>) o).stream().map(Number::toString).collect(Collectors.toSet())));
        mas.put(float.class, NumberSetToNumberSetMarshaller.instance()::marshall);
        mis.put(float.class, (o, a, i) -> i.withStringSet(a, ((Set<? extends Number>) o).stream().map(Number::toString).collect(Collectors.toSet())));
        mas.put(double.class, NumberSetToNumberSetMarshaller.instance()::marshall);
        mis.put(double.class, (o, a, i) -> i.withStringSet(a, ((Set<? extends Number>) o).stream().map(Number::toString).collect(Collectors.toSet())));
        mas.put(String.class, StringSetToStringSetMarshaller.instance()::marshall);
        mis.put(String.class, (o, a, i) -> i.withStringSet(a, (Set<String>) o));
        mas.put(UUID.class, UUIDSetToStringSetMarshaller.instance()::marshall);
        mis.put(UUID.class, (o, a, i) -> i.withStringSet(a, ((Set<? extends UUID>) o).stream().map(UUID::toString).collect(Collectors.toSet())));
        mas.put(ByteBuffer.class, ByteBufferSetToBinarySetMarshaller.instance()::marshall);
        mis.put(ByteBuffer.class, (o, a, i) -> i.withByteBufferSet(a, ((Set<ByteBuffer>) o)));
        mas.put(byte[].class, ByteArraySetToBinarySetMarshaller.instance()::marshall);
        mis.put(byte[].class, (o, a, i) -> i.withBinarySet(a, (Set<byte[]>) o));
        mas.put(Object.class, CollectionToListMarshaller.instance()::marshall);
        mis.put(Object.class, (o, a, i) -> i.with(a, o));

        uac.put(double.class, DoubleUnmarshaller.instance()::unmarshall);
        uic.put(double.class, (a, i) -> i.getDouble(a));
        uac.put(Double.class, DoubleUnmarshaller.instance()::unmarshall);
        uic.put(Double.class, (a, i) -> i.getDouble(a));
        uac.put(BigDecimal.class, BigDecimalUnmarshaller.instance()::unmarshall);
        uic.put(BigDecimal.class, (a, i) -> i.getDouble(a));
        uac.put(BigInteger.class, BigIntegerUnmarshaller.instance()::unmarshall);
        uic.put(BigInteger.class, (a, i) -> i.getBigInteger(a));
        uac.put(int.class, IntegerUnmarshaller.instance()::unmarshall);
        uic.put(int.class, (a, i) -> i.getInt(a));
        uac.put(Integer.class, IntegerUnmarshaller.instance()::unmarshall);
        uic.put(Integer.class, (a, i) -> i.getInt(a));
        uac.put(float.class, FloatUnmarshaller.instance()::unmarshall);
        uic.put(float.class, (a, i) -> i.getFloat(a));
        uac.put(Float.class, FloatUnmarshaller.instance()::unmarshall);
        uic.put(Float.class, (a, i) -> i.getFloat(a));
        uac.put(byte.class, ByteUnmarshaller.instance()::unmarshall);
        uic.put(byte.class, (a, i) -> i.getNumber(a));
        uac.put(Byte.class, ByteUnmarshaller.instance()::unmarshall);
        uic.put(Byte.class, (a, i) -> i.getNumber(a));
        uac.put(long.class, LongUnmarshaller.instance()::unmarshall);
        uic.put(long.class, (a, i) -> i.getLong(a));
        uac.put(Long.class, LongUnmarshaller.instance()::unmarshall);
        uic.put(Long.class, (a, i) -> i.getLong(a));
        uac.put(short.class, ShortUnmarshaller.instance()::unmarshall);
        uic.put(short.class, (a, i) -> i.getShort(a));
        uac.put(Short.class, ShortUnmarshaller.instance()::unmarshall);
        uic.put(Short.class, (a, i) -> i.getShort(a));
        uac.put(boolean.class, BooleanUnmarshaller.instance()::unmarshall);
        uic.put(boolean.class, (a, i) -> i.getBoolean(a));
        uac.put(Boolean.class, BooleanUnmarshaller.instance()::unmarshall);
        uic.put(Boolean.class, (a, i) -> i.getBoolean(a));
        uac.put(Date.class, DateUnmarshaller.instance()::unmarshall);
        uic.put(Date.class, (a, i) -> DateUtils.parseISO8601Date(i.getString(a)));
        uac.put(Calendar.class, CalendarUnmarshaller.instance()::unmarshall);
        uic.put(Calendar.class, (a, i) -> {
            Calendar cal = GregorianCalendar.getInstance();
            cal.setTime(DateUtils.parseISO8601Date(i.getString(a)));
            return cal;
        });
        uac.put(ByteBuffer.class, ByteBufferUnmarshaller.instance()::unmarshall);
        uic.put(ByteBuffer.class, (a, i) -> i.getByteBuffer(a));
        uac.put(byte[].class, ByteArrayUnmarshaller.instance()::unmarshall);
        uic.put(byte[].class, (a, i) -> i.getBinary(a));
        uac.put(UUID.class, UUIDUnmarshaller.instance()::unmarshall);
        uic.put(UUID.class, (a, i) -> UUID.fromString(i.getString(a)));
        uac.put(String.class, StringUnmarshaller.instance()::unmarshall);
        uic.put(String.class, (a, i) -> i.getString(a));
        uac.put(List.class, value -> {
            try {
                return ListUnmarshaller.instance().unmarshall(value);
            } catch (ParseException ex) {
                throw new RuntimeException(ex);
            }
        });
        uic.put(List.class, (a, i) -> i.getList(a));
        uac.put(Map.class, value -> {
            try {
                return MapUnmarshaller.instance().unmarshall(value);
            } catch (ParseException ex) {
                throw new RuntimeException(ex);
            }
        });
        uic.put(Map.class, (a, i) -> i.getMap(a));

        uas.put(double.class, DoubleSetUnmarshaller.instance()::unmarshall);
        uis.put(double.class, (a, i) -> i.getStringSet(a).stream().map(Double::valueOf).collect(Collectors.toSet()));
        uas.put(Double.class, DoubleSetUnmarshaller.instance()::unmarshall);
        uis.put(Double.class, (a, i) -> i.getStringSet(a).stream().map(Double::valueOf).collect(Collectors.toSet()));
        uas.put(BigDecimal.class, BigDecimalSetUnmarshaller.instance()::unmarshall);
        uis.put(BigDecimal.class, (a, i) -> i.getStringSet(a).stream().map(BigDecimal::new).collect(Collectors.toSet()));
        uas.put(BigInteger.class, BigIntegerSetUnmarshaller.instance()::unmarshall);
        uis.put(BigInteger.class, (a, i) -> i.getStringSet(a).stream().map(BigInteger::new).collect(Collectors.toSet()));
        uas.put(int.class, IntegerSetUnmarshaller.instance()::unmarshall);
        uis.put(int.class, (a, i) -> i.getStringSet(a).stream().map(Integer::valueOf).collect(Collectors.toSet()));
        uas.put(Integer.class, IntegerSetUnmarshaller.instance()::unmarshall);
        uis.put(Integer.class, (a, i) -> i.getStringSet(a).stream().map(Integer::valueOf).collect(Collectors.toSet()));
        uas.put(float.class, FloatSetUnmarshaller.instance()::unmarshall);
        uis.put(float.class, (a, i) -> i.getStringSet(a).stream().map(Float::valueOf).collect(Collectors.toSet()));
        uas.put(Float.class, FloatSetUnmarshaller.instance()::unmarshall);
        uis.put(Float.class, (a, i) -> i.getStringSet(a).stream().map(Float::valueOf).collect(Collectors.toSet()));
        uas.put(byte.class, ByteSetUnmarshaller.instance()::unmarshall);
        uis.put(byte.class, (a, i) -> i.getStringSet(a).stream().map(Byte::valueOf).collect(Collectors.toSet()));
        uas.put(Byte.class, ByteSetUnmarshaller.instance()::unmarshall);
        uis.put(Byte.class, (a, i) -> i.getStringSet(a).stream().map(Byte::valueOf).collect(Collectors.toSet()));
        uas.put(long.class, LongSetUnmarshaller.instance()::unmarshall);
        uis.put(long.class, (a, i) -> i.getStringSet(a).stream().map(Long::valueOf).collect(Collectors.toSet()));
        uas.put(Long.class, LongSetUnmarshaller.instance()::unmarshall);
        uis.put(Long.class, (a, i) -> i.getStringSet(a).stream().map(Long::valueOf).collect(Collectors.toSet()));
        uas.put(short.class, ShortSetUnmarshaller.instance()::unmarshall);
        uis.put(short.class, (a, i) -> i.getStringSet(a).stream().map(Short::valueOf).collect(Collectors.toSet()));
        uas.put(Short.class, ShortSetUnmarshaller.instance()::unmarshall);
        uis.put(Short.class, (a, i) -> i.getStringSet(a).stream().map(Short::valueOf).collect(Collectors.toSet()));
        uas.put(Date.class, DateSetUnmarshaller.instance()::unmarshall);
        uis.put(Date.class, (a, i) -> i.getStringSet(a).stream().map(DateUtils::parseISO8601Date).collect(Collectors.toSet()));
        uas.put(Calendar.class, CalendarSetUnmarshaller.instance()::unmarshall);
        uis.put(Calendar.class, (a, i) -> i.getStringSet(a).stream().map(DateUtils::parseISO8601Date).map(date -> {
            Calendar cal = GregorianCalendar.getInstance();
            cal.setTime(date);
            return cal;
        }).collect(Collectors.toSet()));
        uas.put(ByteBuffer.class, ByteBufferSetUnmarshaller.instance()::unmarshall);
        uis.put(ByteBuffer.class, (a, i) -> i.getByteBufferSet(a));
        uas.put(byte[].class, ByteArraySetUnmarshaller.instance()::unmarshall);
        uis.put(byte[].class, (a, i) -> i.getBinarySet(a));
        uas.put(UUID.class, UUIDSetUnmarshaller.instance()::unmarshall);
        uis.put(UUID.class, (a, i) -> i.getStringSet(a).stream().map(UUID::fromString).collect(Collectors.toSet()));
        uas.put(String.class, StringSetUnmarshaller.instance()::unmarshall);
        uis.put(String.class, (a, i) -> i.getStringSet(a));

        return new Converters(
                mic.build().entrySet(),
                uic.build().entrySet(),
                mis.build().entrySet(),
                uis.build().entrySet(),
                mac.build().entrySet(),
                uac.build().entrySet(),
                mas.build().entrySet(),
                uas.build().entrySet());
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
}
