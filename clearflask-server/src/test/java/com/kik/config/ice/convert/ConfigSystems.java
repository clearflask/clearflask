// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
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

import org.mockito.Mockito;

import java.util.Collection;
import java.util.stream.Collectors;

/**
 * Extends {@link ConfigValueConverters} with additional converters.
 */
public class ConfigSystems {

    /**
     * Due to the limitations of ICE's ConfigSystem.overrideModule, an overriden value is
     * given as an object which is converted to a string using toString and back again into
     * an object using a ConfigValueConverter. Objects that cannot be parsed from toString
     * methods fail including the built in List and Set which are parsed as CSV lines instead
     * of the "[<1>,<2>,...]" string generated. Use this method to override the default
     * collection's toString method to produce a CSV line compatible with built-in
     * value converters.
     *
     * Note: Collection implementations marked as final cannot be used including Guava's
     * ImmutableList, ImmutableSet.
     */
    public static <T extends Collection<?>> T configSafeCollection(T collection) {
        T collectionProxied = Mockito.spy(collection);
        Mockito.doReturn(collection.stream()
                        .map(Object::toString)
                        .map(str -> "\"" + str.replaceAll("\"", "\\\"") + "\"")
                        .collect(Collectors.joining(",")))
                .when(collectionProxied)
                .toString();
        return collectionProxied;
    }
}
