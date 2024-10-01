// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.store;

import com.google.inject.Inject;
import com.kik.config.ice.ConfigSystem;
import com.smotana.clearflask.store.dynamo.InMemoryDynamoDbProvider;
import com.smotana.clearflask.store.dynamo.SingleTableProvider;
import com.smotana.clearflask.testutil.AbstractTest;
import dev.langchain4j.data.message.AiMessage;
import dev.langchain4j.data.message.ChatMessage;
import dev.langchain4j.data.message.UserMessage;
import lombok.extern.slf4j.Slf4j;
import org.junit.Test;

import java.util.List;

import static org.junit.Assert.assertEquals;

@Slf4j
public class LlmMemoryStoreTest extends AbstractTest {

    @Inject
    private LlmMemoryStore store;

    @Override
    protected void configure() {
        super.configure();

        install(DynamoLlmMemoryStore.module());
        install(InMemoryDynamoDbProvider.module());
        install(SingleTableProvider.module());
        install(ConfigSystem.configModule(LangChainLlmAgentStore.Config.class));
    }

    @Test(timeout = 30_000L)
    public void test() throws Exception {
        ChatMessage m1 = new AiMessage("some ai text");
        ChatMessage m2 = new UserMessage("some user text");
        ChatMessage m3 = new UserMessage("some other user text");
        store.add("c1", m1);
        store.add("c1", m2);
        store.add("c2", m3);

        assertEquals(List.of(m1, m2), store.messages("c1"));
        assertEquals(List.of(m3), store.messages("c2"));
        assertEquals(List.of(), store.messages("c3"));
    }
}
