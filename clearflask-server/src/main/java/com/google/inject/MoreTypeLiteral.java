package com.google.inject;

import com.google.inject.internal.MoreTypes;

import java.util.Optional;

public class MoreTypeLiteral {
    public static <T> TypeLiteral<Optional<T>> optionalOf(Class<T> type) {
        return new TypeLiteral<>(new MoreTypes.ParameterizedTypeImpl(null, Optional.class, type));
    }
}
