// SPDX-FileCopyrightText: 2019 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
package com.smotana.clearflask.core;

import com.google.common.util.concurrent.Service;
import com.google.inject.AbstractModule;
import com.google.inject.Key;
import com.google.inject.multibindings.Multibinder;
import lombok.extern.slf4j.Slf4j;

@Slf4j
public abstract class ClearFlaskModule extends AbstractModule {

    protected void addService(Class<? extends Service> serviceKlazz) {
        log.trace("Adding service {}", serviceKlazz);
        Multibinder.newSetBinder(binder(), Service.class).addBinding().to(serviceKlazz);
    }

    protected void addService(Key<? extends Service> serviceKey) {
        log.trace("Adding service {}", serviceKey);
        Multibinder.newSetBinder(binder(), Service.class).addBinding().to(serviceKey);
    }
}
