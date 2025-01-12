package com.smotana.clearflask.store;

import com.google.common.collect.ImmutableSet;
import com.google.gson.Gson;
import com.google.inject.Inject;
import com.smotana.clearflask.api.model.ConfigAdmin;
import com.smotana.clearflask.api.model.SubscriptionStatus;
import com.smotana.clearflask.api.model.VersionedConfigAdmin;
import com.smotana.clearflask.store.AccountStore.Account;
import com.smotana.clearflask.store.dynamo.InMemoryDynamoDbProvider;
import com.smotana.clearflask.store.dynamo.SingleTableProvider;
import com.smotana.clearflask.store.impl.ConfigurableLlmPromptStore;
import com.smotana.clearflask.store.impl.DynamoProjectStore;
import com.smotana.clearflask.testutil.AbstractTest;
import com.smotana.clearflask.util.ChatwootUtil;
import com.smotana.clearflask.util.IntercomUtil;
import com.smotana.clearflask.util.MustacheProvider;
import com.smotana.clearflask.util.ProjectUpgrader;
import com.smotana.clearflask.web.security.Sanitizer;
import lombok.extern.slf4j.Slf4j;
import org.junit.Test;
import org.mockito.MockedStatic;
import org.mockito.invocation.InvocationOnMock;

import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.Optional;

import static org.junit.Assert.assertEquals;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

@Slf4j
public class LlmPromptStoreTest extends AbstractTest {

    @Inject
    private LlmPromptStore store;
    @Inject
    private Gson gson;
    @Inject
    private AccountStore mockAccountStore;
    @Inject
    private ProjectStore projectStore;

    @Override
    protected void configure() {
        super.configure();

        install(ConfigurableLlmPromptStore.module());

        bindMock(AccountStore.class);
        install(MustacheProvider.module());

        // For project store
        bindMock(ContentStore.class);
        bindMock(ProjectUpgrader.class);
        install(DynamoProjectStore.module());
        install(InMemoryDynamoDbProvider.module());
        install(SingleTableProvider.module());
        install(Sanitizer.module());
        install(IntercomUtil.module());
        install(ChatwootUtil.module());
    }

    @Test(timeout = 30_000L)
    public void test() throws Exception {
        String projectId = "aitestexample-nsun";
        String accountId = "matus-faro-h3bq";

        // This config was taken from a newly created project in prod
        ConfigAdmin config = gson.fromJson(getTestResource("model-example.json"), ConfigAdmin.class);
        when(this.mockAccountStore.getAccount(anyString(), anyBoolean())).thenReturn(Optional.of(new Account(
                accountId,
                "my@email.com",
                SubscriptionStatus.ACTIVE,
                null,
                "planId1",
                Instant.now(),
                "Matus Faro",
                "password",
                ImmutableSet.of(),
                ImmutableSet.of(),
                null,
                null,
                null,
                null,
                ImmutableSet.of(),
                null)));
        projectStore.createProject(accountId, projectId, new VersionedConfigAdmin(config, "0"));

        ZonedDateTime now = ZonedDateTime.parse("2024-10-05T01:30:09.146844-04:00[America/Toronto]");
        String promptActual;
        try (MockedStatic<ZonedDateTime> mockedZonedDateTime = mockStatic(ZonedDateTime.class, InvocationOnMock::callRealMethod)) {
            mockedZonedDateTime.when(() -> ZonedDateTime.now(any(ZoneId.class))).thenReturn(now);

            promptActual = store.getPrompt(projectId, accountId).text();
        }

        assertEquals(getTestResource("prompt-expected.txt"), promptActual);
    }
}