// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.web.resource;

import com.google.common.base.Strings;
import com.google.common.collect.ImmutableList;
import com.google.gson.Gson;
import com.google.inject.AbstractModule;
import com.google.inject.Module;
import com.google.inject.multibindings.Multibinder;
import com.google.inject.name.Names;
import com.smotana.clearflask.api.LlmAdminApi;
import com.smotana.clearflask.api.LlmSuperAdminApi;
import com.smotana.clearflask.api.model.*;
import com.smotana.clearflask.billing.KillBillPlanStore;
import com.smotana.clearflask.core.ServiceInjector.Environment;
import com.smotana.clearflask.security.limiter.Limit;
import com.smotana.clearflask.store.AccountStore;
import com.smotana.clearflask.store.AccountStore.Account;
import com.smotana.clearflask.store.LlmAgentStore;
import com.smotana.clearflask.store.LlmHistoryStore;
import com.smotana.clearflask.store.LlmHistoryStore.ConvoModel;
import com.smotana.clearflask.store.LlmHistoryStore.MessageModel;
import com.smotana.clearflask.store.LlmPromptStore;
import com.smotana.clearflask.web.ApiException;
import com.smotana.clearflask.web.Application;
import com.smotana.clearflask.web.security.ExtendedSecurityContext;
import com.smotana.clearflask.web.security.Role;
import com.smotana.clearflask.web.security.SuperAdminPredicate;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang.StringUtils;

import javax.annotation.security.RolesAllowed;
import javax.inject.Inject;
import javax.inject.Singleton;
import javax.validation.constraints.NotNull;
import javax.ws.rs.GET;
import javax.ws.rs.Path;
import javax.ws.rs.PathParam;
import javax.ws.rs.Produces;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.Response;
import javax.ws.rs.sse.Sse;
import javax.ws.rs.sse.SseEventSink;
import java.util.Optional;

@Slf4j
@Singleton
@Path(Application.RESOURCE_VERSION)
public class LlmResource extends AbstractResource implements LlmAdminApi, LlmSuperAdminApi {

    @Context
    private Sse sse;
    @Inject
    private LlmHistoryStore llmHistoryStore;
    @Inject
    private LlmAgentStore llmAgentStore;
    @Inject
    private LlmPromptStore llmPromptStore;
    @Inject
    private AccountStore accountStore;
    @Inject
    private SuperAdminPredicate superAdminPredicate;
    @Inject
    private Environment env;
    @Inject
    private Gson gson;

    @RolesAllowed({Role.ADMINISTRATOR})
    @Limit(requiredPermits = 1)
    @Override
    public void convoDeleteAdmin(String projectId, String convoId) {
        String accountId = getAuthenticatedAccountId();

        llmHistoryStore.deleteConvo(
                projectId,
                accountId,
                convoId);
    }

    @RolesAllowed({Role.ADMINISTRATOR})
    @Limit(requiredPermits = 1)
    @Override
    public ConvoDetailsResponse convoDetailsAdmin(String projectId, String convoId) {
        String accountId = getAuthenticatedAccountId();

        // Ensure this convo is owned by the requestor
        llmHistoryStore.getConvo(
                        projectId,
                        accountId,
                        convoId)
                .orElseThrow(() -> new ApiException(Response.Status.NOT_FOUND, "Convo not found"));

        // Fetch messages
        ImmutableList<MessageModel> messageModels = llmHistoryStore.getMessages(
                convoId);

        return new ConvoDetailsResponse(messageModels.stream()
                .map(MessageModel::toConvoMessage)
                .collect(ImmutableList.toImmutableList()));
    }

    @RolesAllowed({Role.ADMINISTRATOR})
    @Limit(requiredPermits = 1)
    @Override
    public ConvoListResponse convoListAdmin(String projectId) {
        String accountId = getAuthenticatedAccountId();

        ImmutableList<ConvoModel> convoModels = llmHistoryStore.listConvos(
                projectId,
                accountId);

        return new ConvoListResponse(convoModels.stream()
                .map(ConvoModel::toConvo)
                .collect(ImmutableList.toImmutableList()));
    }

    @RolesAllowed({Role.ADMINISTRATOR_ACTIVE})
    @Limit(requiredPermits = 100, challengeAfter = 30)
    @Override
    public CreateMessageResponse messageCreateAdmin(String projectId, String convoId, ConvoMessageCreate convoMessageCreate) {
        String accountId = getAuthenticatedAccountId();
        Account account = accountStore.getAccount(accountId, true).orElseThrow();

        if (Environment.PRODUCTION_SELF_HOST.equals(env)
                || (!"true".equals(account.getAddons().get(KillBillPlanStore.ADDON_AI))
                && !superAdminPredicate.isEmailSuperAdmin(account.getEmail()))) {
            throw new ApiException(Response.Status.PAYMENT_REQUIRED, "AI not enabled");
        }

        Optional<String> promptOverrideOpt = Optional.ofNullable(Strings.emptyToNull(convoMessageCreate.getOverridePrompt()));
        if (promptOverrideOpt.isPresent() && !superAdminPredicate.isEmailSuperAdmin(account.getEmail())) {
            throw new ApiException(Response.Status.BAD_REQUEST, "Override prompt is only allowed for super admins");
        }

        final ConvoModel convoModel;
        if ("new".equalsIgnoreCase(convoId)) {
            convoModel = llmHistoryStore.createConvo(
                    projectId,
                    accountId,
                    StringUtils.abbreviate(convoMessageCreate.getContent(), 300));
        } else {
            convoModel = llmHistoryStore.getConvo(
                            projectId,
                            accountId,
                            convoId)
                    .orElseThrow(() -> new ApiException(Response.Status.NOT_FOUND, "Convo not found"));
        }

        return llmAgentStore.ask(projectId, accountId, convoModel.getConvoId(), convoMessageCreate.getContent(), promptOverrideOpt);
    }

    @RolesAllowed({Role.ADMINISTRATOR})
    @Limit(requiredPermits = 1)
    @Override
    // SSE for some reason requires re-stating annotations from the interface
    @GET
    @Path("/project/{projectId}/admin/llm/convo/{convoId}/message/{messageId}")
    @Produces({"text/event-stream"})
    public void messageStreamGetAdmin(@PathParam("projectId") @NotNull String projectId, @PathParam("convoId") @NotNull String convoId, @PathParam("messageId") @NotNull String messageId, @Context Sse sse, @Context SseEventSink eventSink) {
        try {
            llmAgentStore.awaitAnswer(projectId, convoId, messageId, new LlmAgentStore.AnswerSubscriber() {

                @Override
                public void onNext(String nextToken) {
                    log.trace("Sending token {}", nextToken);
                    if (eventSink.isClosed()) {
                        log.info("Event sink closed, not sending token {}", nextToken);
                        return;
                    }
                    eventSink.send(sse.newEventBuilder()
                            .name("token")
                            .data(nextToken)
                            .build());
                }

                @Override
                public void onComplete(MessageModel messageModel) {
                    if (eventSink.isClosed()) {
                        log.info("Event sink closed, not sending message {}", messageModel);
                        return;
                    }
                    log.trace("Message complete {}", messageModel);
                    eventSink.send(sse.newEventBuilder()
                                    .name("message")
                                    .data(gson.toJson(messageModel.toConvoMessage()))
                                    .build())
                            .thenRun(eventSink::close);
                }
            });
        } catch (Exception ex) {
            if (eventSink != null) {
                eventSink.close();
            }
            throw ex;
        }
    }

    @RolesAllowed({Role.SUPER_ADMIN})
    @Limit(requiredPermits = 1)
    @Override
    public PromptGetResponse promptGetSuperAdmin(String projectId) {
        String accountId = getAuthenticatedAccountId();

        String promptStr = llmPromptStore.getPrompt(projectId, accountId).text();

        return new PromptGetResponse(promptStr);
    }

    private String getAuthenticatedAccountId() {
        return getExtendedPrincipal()
                .flatMap(ExtendedSecurityContext.ExtendedPrincipal::getAuthenticatedSuperAccountIdOpt)
                .or(() -> getExtendedPrincipal()
                        .flatMap(ExtendedSecurityContext.ExtendedPrincipal::getAuthenticatedAccountIdOpt))
                .orElseThrow();
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(LlmResource.class);
                Multibinder.newSetBinder(binder(), Object.class, Names.named(Application.RESOURCE_NAME)).addBinding()
                        .to(LlmResource.class);
            }
        };
    }
}
