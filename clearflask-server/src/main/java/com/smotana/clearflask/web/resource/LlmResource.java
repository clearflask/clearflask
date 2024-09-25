// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.web.resource;

import com.google.common.collect.ImmutableList;
import com.google.inject.AbstractModule;
import com.google.inject.Module;
import com.google.inject.multibindings.Multibinder;
import com.google.inject.name.Names;
import com.smotana.clearflask.api.LlmApi;
import com.smotana.clearflask.api.model.ConvoDetailsResponse;
import com.smotana.clearflask.api.model.ConvoListResponse;
import com.smotana.clearflask.api.model.ConvoMessage.AuthorTypeEnum;
import com.smotana.clearflask.api.model.ConvoMessageCreate;
import com.smotana.clearflask.api.model.CreateMessageResponse;
import com.smotana.clearflask.security.limiter.Limit;
import com.smotana.clearflask.store.LlmHistoryStore;
import com.smotana.clearflask.store.LlmHistoryStore.ConvoModel;
import com.smotana.clearflask.store.LlmHistoryStore.MessageModel;
import com.smotana.clearflask.store.UserStore;
import com.smotana.clearflask.web.ApiException;
import com.smotana.clearflask.web.Application;
import com.smotana.clearflask.web.security.ExtendedSecurityContext;
import com.smotana.clearflask.web.security.Role;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang.StringUtils;
import org.jetbrains.annotations.Nullable;

import javax.annotation.security.RolesAllowed;
import javax.inject.Inject;
import javax.inject.Singleton;
import javax.ws.rs.Path;
import javax.ws.rs.core.Response;

@Slf4j
@Singleton
@Path(Application.RESOURCE_VERSION)
public class LlmResource extends AbstractResource implements LlmApi {

    @Inject
    private LlmHistoryStore llmHistoryStore;

    @RolesAllowed({Role.ADMINISTRATOR_ACTIVE})
    @Limit(requiredPermits = 1)
    @Override
    public void convoDelete(String projectId, String convoId) {
        String userId = getExtendedPrincipal().flatMap(ExtendedSecurityContext.ExtendedPrincipal::getAuthenticatedUserSessionOpt).map(UserStore.UserSession::getUserId).get();
        llmHistoryStore.deleteConvo(
                projectId,
                userId,
                convoId);
    }

    @RolesAllowed({Role.ADMINISTRATOR_ACTIVE})
    @Limit(requiredPermits = 1)
    @Override
    public ConvoDetailsResponse convoDetails(String projectId, String convoId) {
        String userId = getExtendedPrincipal().flatMap(ExtendedSecurityContext.ExtendedPrincipal::getAuthenticatedUserSessionOpt).map(UserStore.UserSession::getUserId).get();

        // Ensure this convo is owned by the requestor
        llmHistoryStore.getConvo(
                        projectId,
                        userId,
                        convoId)
                .orElseThrow(() -> new ApiException(Response.Status.NOT_FOUND, "Convo not found"));

        // Fetch messages
        ImmutableList<MessageModel> messageModels = llmHistoryStore.getMessages(
                convoId);

        return new ConvoDetailsResponse(messageModels.stream()
                .map(MessageModel::toConvoMessage)
                .collect(ImmutableList.toImmutableList()));
    }

    @RolesAllowed({Role.ADMINISTRATOR_ACTIVE})
    @Limit(requiredPermits = 1)
    @Override
    public ConvoListResponse convoList(String projectId) {
        String userId = getExtendedPrincipal().flatMap(ExtendedSecurityContext.ExtendedPrincipal::getAuthenticatedUserSessionOpt).map(UserStore.UserSession::getUserId).get();

        ImmutableList<ConvoModel> convoModels = llmHistoryStore.listConvos(
                projectId,
                userId);

        return new ConvoListResponse(convoModels.stream()
                .map(ConvoModel::toConvo)
                .collect(ImmutableList.toImmutableList()));
    }

    @RolesAllowed({Role.ADMINISTRATOR_ACTIVE})
    @Limit(requiredPermits = 100, challengeAfter = 30)
    @Override
    public CreateMessageResponse messageCreate(String projectId, ConvoMessageCreate convoMessageCreate, @Nullable String convoId) {
        String userId = getExtendedPrincipal().flatMap(ExtendedSecurityContext.ExtendedPrincipal::getAuthenticatedUserSessionOpt).map(UserStore.UserSession::getUserId).get();

        final ConvoModel convoModel;
        if (convoId == null) {
            convoModel = llmHistoryStore.createConvo(
                    projectId,
                    userId,
                    StringUtils.abbreviate(convoMessageCreate.getContent(), 300));
        } else {
            convoModel = llmHistoryStore.getConvo(
                            projectId,
                            userId,
                            convoId)
                    .orElseThrow(() -> new ApiException(Response.Status.NOT_FOUND, "Convo not found"));
        }

        MessageModel messageModel = llmHistoryStore.putMessage(
                convoModel.getConvoId(),
                AuthorTypeEnum.USER,
                convoMessageCreate.getContent());
        MessageModel responseModel = llmHistoryStore.putMessage(
                convoModel.getConvoId(),
                AuthorTypeEnum.AI,
                "This is a sample message from the AI. This will eventually be text generated by the AI.");

        return new CreateMessageResponse(
                convoModel.getConvoId(),
                messageModel.toConvoMessage(),
                responseModel.toConvoMessage());
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