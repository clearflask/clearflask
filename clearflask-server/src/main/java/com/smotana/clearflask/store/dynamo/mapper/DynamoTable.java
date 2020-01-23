package com.smotana.clearflask.store.dynamo.mapper;

import com.smotana.clearflask.store.dynamo.mapper.DynamoMapper.TableType;

import java.lang.annotation.Repeatable;
import java.lang.annotation.Retention;
import java.lang.annotation.Target;

import static java.lang.annotation.ElementType.TYPE;
import static java.lang.annotation.RetentionPolicy.RUNTIME;

@Target(TYPE)
@Retention(RUNTIME)
@Repeatable(DynamoTable.DynamoTables.class)
public @interface DynamoTable {

    TableType type() default TableType.Primary;

    /** For GSI and LSI type only, specify which index starting with 1 */
    int indexNumber() default -1;

    /** Partition keys to be compounded together. Lsi should match Primary's keys */
    String[] partitionKeys();

    /** Sort keys to be compounded together */
    String[] sortKeys() default {};

    /** Static sort name to use */
    String sortStaticName() default "";

    @Target(TYPE)
    @Retention(RUNTIME)
    @interface DynamoTables {
        DynamoTable[] value();
    }
}
