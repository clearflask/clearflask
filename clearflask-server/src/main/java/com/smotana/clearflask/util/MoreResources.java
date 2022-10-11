// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.util;

import lombok.extern.slf4j.Slf4j;

import java.net.URL;
import java.util.Objects;
import java.util.Optional;
import java.util.stream.Stream;

@Slf4j
public class MoreResources {
    public static Optional<URL> tryGetResource(String resourceName, ClassLoader... extraClassloaders) {
        return Stream.concat(
                        Stream.of(
                                Thread.currentThread().getContextClassLoader(),
                                MoreResources.class.getClassLoader()),
                        Stream.of(extraClassloaders))
                .filter(Objects::nonNull)
                .flatMap(loader -> {
                    Optional<URL> resourceOpt = Optional.ofNullable(loader.getResource(resourceName));
                    resourceOpt.ifPresentOrElse(
                            rs -> log.trace("Resource {} found using classLoader {}", resourceName, loader.getName()),
                            () -> log.trace("Resource {} not found using classLoader {}", resourceName, loader.getName()));
                    return resourceOpt.stream();
                })
                .findFirst();
    }

    public static URL getResource(String resourceName, ClassLoader... extraClassloaders) {
        return tryGetResource(resourceName, extraClassloaders)
                .orElseThrow(() -> new IllegalArgumentException("resource " + resourceName + " not found."));
    }
}
