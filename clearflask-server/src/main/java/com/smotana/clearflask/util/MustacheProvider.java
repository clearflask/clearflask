// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.util;

import com.google.inject.AbstractModule;
import com.google.inject.Module;
import com.google.inject.Provider;
import com.google.inject.Singleton;
import com.samskivert.mustache.Mustache;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Singleton
public class MustacheProvider implements Provider<Mustache.Compiler> {

    @Override
    public Mustache.Compiler get() {
        return Mustache.compiler()
                .standardsMode(false)
                .strictSections(false)
                .escapeHTML(false)
                .zeroIsFalse(true)
                .emptyStringIsFalse(true);
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(Mustache.Compiler.class).toProvider(MustacheProvider.class).asEagerSingleton();
            }
        };
    }
}
