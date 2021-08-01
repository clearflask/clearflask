// SPDX-FileCopyrightText: 2019 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
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
