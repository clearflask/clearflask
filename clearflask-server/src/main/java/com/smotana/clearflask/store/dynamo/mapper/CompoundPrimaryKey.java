package com.smotana.clearflask.store.dynamo.mapper;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
public @interface CompoundPrimaryKey {

    /** Name of the compound primary key in DynamoDB */
    String key();

    /** Primary keys to be compounded together */
    String[] primaryKeys();
}
