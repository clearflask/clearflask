// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.store;

import com.google.common.collect.ImmutableSet;
import com.google.inject.Inject;
import com.smotana.clearflask.store.LlmHistoryStore.Convo;
import com.smotana.clearflask.store.LlmHistoryStore.Message;
import com.smotana.clearflask.store.dynamo.InMemoryDynamoDbProvider;
import com.smotana.clearflask.store.dynamo.SingleTableProvider;
import com.smotana.clearflask.store.impl.DynamoLlmHistoryStore;
import com.smotana.clearflask.testutil.AbstractIT;
import lombok.extern.slf4j.Slf4j;
import org.junit.Test;

import java.util.Set;

import static com.smotana.clearflask.store.LlmHistoryStore.AuthorType.AI;
import static com.smotana.clearflask.store.LlmHistoryStore.AuthorType.USER;
import static org.junit.Assert.assertEquals;

@Slf4j
public class LlmHistoryStoreIT extends AbstractIT {

    @Inject
    private LlmHistoryStore store;

    @Override
    protected void configure() {
        super.configure();

        install(DynamoLlmHistoryStore.module());
        install(InMemoryDynamoDbProvider.module());
        install(SingleTableProvider.module());
    }

    @Test(timeout = 30_000L)
    public void testConvos() throws Exception {
        Convo convo1 = store.createConvo("p1", "u1", "t1");
        Convo convo2 = store.createConvo("p1", "u1", "t2");
        Convo convo3 = store.createConvo("p1", "u2", "t3");
        Convo convo4 = store.createConvo("p2", "u1", "t4");

        assertEquals(Set.of(convo1.getConvoId(), convo2.getConvoId()), store.getConvos("p1", "u1").stream().map(Convo::getConvoId).collect(ImmutableSet.toImmutableSet()));
        assertEquals(Set.of(convo3.getConvoId()), store.getConvos("p1", "u2").stream().map(Convo::getConvoId).collect(ImmutableSet.toImmutableSet()));
        assertEquals(Set.of(convo4.getConvoId()), store.getConvos("p2", "u1").stream().map(Convo::getConvoId).collect(ImmutableSet.toImmutableSet()));
        assertEquals(Set.of(), store.getConvos("p2", "u2").stream().map(Convo::getConvoId).collect(ImmutableSet.toImmutableSet()));
        assertEquals(Set.of(), store.getConvos("p3", "u2").stream().map(Convo::getConvoId).collect(ImmutableSet.toImmutableSet()));
        assertEquals(Set.of(), store.getConvos("p3", "u3").stream().map(Convo::getConvoId).collect(ImmutableSet.toImmutableSet()));

        store.deleteConvo("p1", "u1", convo1.getConvoId()); // hit
        store.deleteConvo("p2", "u1", convo2.getConvoId()); // wrong project
        store.deleteConvo("p1", "u2", convo2.getConvoId()); // wrong user
        store.deleteConvo("p1", "u1", convo3.getConvoId()); // wrong convo
        assertEquals(Set.of(convo2.getConvoId()), store.getConvos("p1", "u1").stream().map(Convo::getConvoId).collect(ImmutableSet.toImmutableSet()));
        assertEquals(Set.of(convo3.getConvoId()), store.getConvos("p1", "u2").stream().map(Convo::getConvoId).collect(ImmutableSet.toImmutableSet()));
        assertEquals(Set.of(convo4.getConvoId()), store.getConvos("p2", "u1").stream().map(Convo::getConvoId).collect(ImmutableSet.toImmutableSet()));

        store.deleteForProject("p1");
        assertEquals(Set.of(), store.getConvos("p1", "u1").stream().map(Convo::getConvoId).collect(ImmutableSet.toImmutableSet()));
        assertEquals(Set.of(), store.getConvos("p1", "u2").stream().map(Convo::getConvoId).collect(ImmutableSet.toImmutableSet()));
        assertEquals(Set.of(convo4.getConvoId()), store.getConvos("p2", "u1").stream().map(Convo::getConvoId).collect(ImmutableSet.toImmutableSet()));
    }

    @Test(timeout = 30_000L)
    public void testMessages() throws Exception {
        Convo convo1 = store.createConvo("p1", "u1", "t1");
        Convo convo2 = store.createConvo("p1", "u1", "t2");
        Convo convo3 = store.createConvo("p1", "u2", "t3");
        Convo convo4 = store.createConvo("p2", "u1", "t4");

        Message message1 = store.putMessage(convo1.getConvoId(), USER, "c1");
        Message message2 = store.putMessage(convo1.getConvoId(), AI, "c2");
        Message message3 = store.putMessage(convo2.getConvoId(), AI, "c3");
        Message message4 = store.putMessage(convo3.getConvoId(), AI, "c4");
        Message message5 = store.putMessage(convo4.getConvoId(), AI, "c5");
        Message message6 = store.putMessage("non-existent", AI, "c6");

        assertEquals(Set.of(message1.getMessageId(), message2.getMessageId()), store.getMessages(convo1.getConvoId()).stream().map(Message::getMessageId).collect(ImmutableSet.toImmutableSet()));
        assertEquals(Set.of(message3.getMessageId()), store.getMessages(convo2.getConvoId()).stream().map(Message::getMessageId).collect(ImmutableSet.toImmutableSet()));
        assertEquals(Set.of(message4.getMessageId()), store.getMessages(convo3.getConvoId()).stream().map(Message::getMessageId).collect(ImmutableSet.toImmutableSet()));
        assertEquals(Set.of(message5.getMessageId()), store.getMessages(convo4.getConvoId()).stream().map(Message::getMessageId).collect(ImmutableSet.toImmutableSet()));
        assertEquals(Set.of(), store.getMessages("non-existent-2").stream().map(Message::getMessageId).collect(ImmutableSet.toImmutableSet()));

        store.deleteForProject("p1");
        assertEquals(Set.of(), store.getMessages(convo1.getConvoId()).stream().map(Message::getMessageId).collect(ImmutableSet.toImmutableSet()));
        assertEquals(Set.of(), store.getMessages(convo2.getConvoId()).stream().map(Message::getMessageId).collect(ImmutableSet.toImmutableSet()));
        assertEquals(Set.of(), store.getMessages(convo3.getConvoId()).stream().map(Message::getMessageId).collect(ImmutableSet.toImmutableSet()));
        assertEquals(Set.of(message5.getMessageId()), store.getMessages(convo4.getConvoId()).stream().map(Message::getMessageId).collect(ImmutableSet.toImmutableSet()));
        assertEquals(Set.of(), store.getMessages("non-existent-2").stream().map(Message::getMessageId).collect(ImmutableSet.toImmutableSet()));
    }
}
