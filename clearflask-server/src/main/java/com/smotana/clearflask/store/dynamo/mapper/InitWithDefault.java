// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.store.dynamo.mapper;

import java.lang.annotation.Retention;
import java.lang.annotation.Target;

import static java.lang.annotation.ElementType.FIELD;
import static java.lang.annotation.RetentionPolicy.RUNTIME;

/**
 * For fields that were previously Nullable, you can make them NonNull
 * by also annotating them with this InitWithDefault which will cause
 * any fetch from the database to convert a null value to be inited
 * with a default instance from DynamoConvertersProxy.
 */
@Target(FIELD)
@Retention(RUNTIME)
public @interface InitWithDefault {
}
