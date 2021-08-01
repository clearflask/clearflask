// SPDX-FileCopyrightText: 2019-2020 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
/*
 * Copyright 2016 Kik Interactive, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package com.kik.config.ice.convert;

import com.google.common.base.Strings;
import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableSet;
import com.google.inject.AbstractModule;
import com.google.inject.Module;
import com.google.inject.TypeLiteral;
import com.google.inject.multibindings.MapBinder;
import com.google.inject.util.Types;
import io.jsonwebtoken.SignatureAlgorithm;
import nl.martijndwars.webpush.Urgency;

import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import java.time.DateTimeException;
import java.time.Duration;
import java.util.Base64;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static io.jsonwebtoken.SignatureAlgorithm.HS512;

/**
 * Extends {@link com.kik.config.ice.convert.ConfigValueConverters} with additional converters.
 */
public class MoreConfigValueConverters {

    public static final SignatureAlgorithm TOKEN_ALGO = HS512;

    public static <T extends Enum<T>> T toGenericEnum(Class<T> enumClazz, String input) {
        if (Strings.isNullOrEmpty(input)) {
            return null;
        }
        return Enum.valueOf(enumClazz, input);
    }

    public static List<Duration> toDurationList(String input) {
        if (Strings.isNullOrEmpty(input)) {
            return null;
        }
        try {
            return ConfigValueConverters.parseCsvLine(input).stream()
                    .map(ConfigValueConverters::toDuration)
                    .collect(ImmutableList.toImmutableList());
        } catch (DateTimeException ex) {
            throw new RuntimeException("Cannot parse Duration from: " + input, ex);
        }
    }

    public static Set<Duration> toDurationSet(String input) {
        if (Strings.isNullOrEmpty(input)) {
            return null;
        }
        try {
            return ConfigValueConverters.parseCsvLine(input).stream()
                    .map(ConfigValueConverters::toDuration)
                    .collect(ImmutableSet.toImmutableSet());
        } catch (DateTimeException ex) {
            throw new RuntimeException("Cannot parse Duration from: " + input, ex);
        }
    }

    public static SecretKeySpec toSecretKey(String input) {
        if (Strings.isNullOrEmpty(input)) {
            return null;
        }
        byte[] keyBytes = Base64.getDecoder().decode(input);
        return new SecretKeySpec(keyBytes, 0, keyBytes.length, TOKEN_ALGO.getJcaName());
    }

    public static Module module() {
        return module(ImmutableSet.of(
                Urgency.class
        ));
    }

    public static Module module(ImmutableSet<Class<? extends Enum<?>>> enumClazzes) {
        return new AbstractModule() {
            @Override
            protected void configure() {
                TypeLiteral<TypeLiteral<?>> typeType = new TypeLiteral<TypeLiteral<?>>() {
                };
                TypeLiteral<ConfigValueConverter<?>> converterType = new TypeLiteral<ConfigValueConverter<?>>() {
                };

                MapBinder<TypeLiteral<?>, ConfigValueConverter<?>> mapBinder = MapBinder.newMapBinder(binder(), typeType, converterType);

                for (Class<? extends Enum> enumClazz : enumClazzes) {
                    bindEnum(enumClazz, mapBinder);
                }

                bindConverter(new TypeLiteral<List<Duration>>() {
                }, mapBinder, MoreConfigValueConverters::toDurationList);

                bindConverter(new TypeLiteral<Set<Duration>>() {
                }, mapBinder, MoreConfigValueConverters::toDurationSet);

                bindConverter(new TypeLiteral<SecretKey>() {
                }, mapBinder, MoreConfigValueConverters::toSecretKey);
            }

            private <T> void bindConverter(
                    Class<T> convertToType,
                    MapBinder<TypeLiteral<?>, ConfigValueConverter<?>> mapBinder,
                    ConfigValueConverter<T> converterInstance) {
                // Bind into map binder
                mapBinder.addBinding(TypeLiteral.get(convertToType)).toInstance(converterInstance);

                // Bind for individual injection
                bind((TypeLiteral<ConfigValueConverter<T>>) TypeLiteral.get(Types.newParameterizedType(ConfigValueConverter.class, convertToType))).toInstance(converterInstance);
            }

            private <T, I> void bindOptionalConverter(
                    TypeLiteral<T> convertToType,
                    Class<I> innerConverterType,
                    MapBinder<TypeLiteral<?>, ConfigValueConverter<?>> mapBinder,
                    ConfigValueConverter<T> converterInstance) {
                // Bind into map binder
                mapBinder.addBinding(convertToType).toInstance(converterInstance);

                // Bind for individual injection
                bind((TypeLiteral<ConfigValueConverter<T>>) TypeLiteral.get(
                        Types.newParameterizedType(ConfigValueConverter.class,
                                Types.newParameterizedType(Optional.class, innerConverterType)))).toInstance(converterInstance);
            }

            private <T> void bindConverter(
                    TypeLiteral<T> convertToType,
                    MapBinder<TypeLiteral<?>, ConfigValueConverter<?>> mapBinder,
                    ConfigValueConverter<T> converterInstance) {
                // Bind into map binder
                mapBinder.addBinding(convertToType).toInstance(converterInstance);

                // Bind for individual injection
                bind((TypeLiteral<ConfigValueConverter<T>>) TypeLiteral.get(Types.newParameterizedType(ConfigValueConverter.class, convertToType.getType()))).toInstance(converterInstance);
            }

            private <T extends Enum<T>> void bindEnum(
                    Class<T> enumClazz,
                    MapBinder<TypeLiteral<?>, ConfigValueConverter<?>> mapBinder) {
                ConfigValueConverter<T> converterInstance = s -> MoreConfigValueConverters.toGenericEnum(enumClazz, s);
                bindConverter(enumClazz, mapBinder, converterInstance);
            }

        };
    }
}
