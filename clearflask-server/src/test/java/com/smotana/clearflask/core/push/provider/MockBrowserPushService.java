// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.core.push.provider;

import com.google.common.collect.Queues;
import com.google.inject.AbstractModule;
import com.google.inject.Module;
import com.google.inject.Singleton;
import lombok.extern.slf4j.Slf4j;

import java.util.concurrent.BlockingQueue;

@Slf4j
@Singleton
public class MockBrowserPushService implements BrowserPushService {

    public final BlockingQueue<BrowserPush> sent = Queues.newLinkedBlockingDeque();

    @Override
    public void send(BrowserPush browserPush) {
        log.info("Send {}", browserPush);
        this.sent.add(browserPush);
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(BrowserPushService.class).to(MockBrowserPushService.class).asEagerSingleton();
            }
        };
    }
}
