// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.store;

import com.google.common.collect.ImmutableSet;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.util.Modules;
import com.kik.config.ice.ConfigSystem;
import com.smotana.clearflask.store.impl.DiskLlmMemoryStore;
import com.smotana.clearflask.testutil.AbstractIT;
import dev.langchain4j.data.message.ChatMessage;
import dev.langchain4j.data.message.UserMessage;
import lombok.extern.slf4j.Slf4j;
import org.junit.Test;

import java.util.List;
import java.util.Set;

import static org.junit.Assert.assertEquals;

@Slf4j
public class LlmMemoryStoreIT extends AbstractIT {

    @Inject
    private LlmMemoryStore store;

    @Override
    protected void configure() {
        super.configure();

        install(Modules.override(
                DiskLlmMemoryStore.module()
        ).with(new AbstractModule() {
            @Override
            protected void configure() {
                install(ConfigSystem.overrideModule(DiskLlmMemoryStore.Config.class, om -> {
                    om.override(om.id().persistent()).withValue(false);
                }));
            }
        }));
    }

    @Test(timeout = 30_000L)
    public void test() throws Exception {
        ChatMessage m1 = new UserMessage("c1");
        ChatMessage m2 = new UserMessage("c2");
        store.updateMessages(0, List.of(m1, m2));
        store.updateMessages(1, List.of());

        assertEquals(Set.of("c1", "c2"), store.getMessages(0).stream().map(ChatMessage::text).collect(ImmutableSet.toImmutableSet()));
        assertEquals(Set.of(), store.getMessages(1).stream().map(ChatMessage::text).collect(ImmutableSet.toImmutableSet()));
        assertEquals(Set.of(), store.getMessages(2).stream().map(ChatMessage::text).collect(ImmutableSet.toImmutableSet()));

        ChatMessage m3 = new UserMessage("c3");
        store.updateMessages(0, List.of(m2, m3));

        assertEquals(Set.of("c2", "c3"), store.getMessages(0).stream().map(ChatMessage::text).collect(ImmutableSet.toImmutableSet()));
        assertEquals(Set.of(), store.getMessages(1).stream().map(ChatMessage::text).collect(ImmutableSet.toImmutableSet()));
        assertEquals(Set.of(), store.getMessages(2).stream().map(ChatMessage::text).collect(ImmutableSet.toImmutableSet()));

        store.deleteMessages(1);
        assertEquals(Set.of("c2", "c3"), store.getMessages(0).stream().map(ChatMessage::text).collect(ImmutableSet.toImmutableSet()));

        store.deleteMessages(0);
        assertEquals(Set.of(), store.getMessages(0).stream().map(ChatMessage::text).collect(ImmutableSet.toImmutableSet()));
    }
}
