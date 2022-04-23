// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.util;

import com.google.common.collect.ImmutableMap;

import java.util.Arrays;

public interface SerializableEnum {
    int getId();

    static <E extends SerializableEnum> ImmutableMap<Integer, E> getMapper(Class<E> clazz) {
        return Arrays.stream(clazz.getEnumConstants())
                .collect(ImmutableMap.toImmutableMap(E::getId, e -> e));
    }
}
