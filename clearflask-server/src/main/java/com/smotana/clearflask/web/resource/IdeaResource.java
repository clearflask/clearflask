package com.smotana.clearflask.web.resource;

import com.google.common.base.Strings;
import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableMap;
import com.google.common.collect.ImmutableSet;
import com.google.inject.AbstractModule;
import com.google.inject.Module;
import com.smotana.clearflask.api.IdeaAdminApi;
import com.smotana.clearflask.api.IdeaApi;
import com.smotana.clearflask.api.model.Idea;
import com.smotana.clearflask.api.model.IdeaCreate;
import com.smotana.clearflask.api.model.IdeaCreateAdmin;
import com.smotana.clearflask.api.model.IdeaSearch;
import com.smotana.clearflask.api.model.IdeaSearchAdmin;
import com.smotana.clearflask.api.model.IdeaSearchResponse;
import com.smotana.clearflask.api.model.IdeaUpdate;
import com.smotana.clearflask.api.model.IdeaUpdateAdmin;
import com.smotana.clearflask.api.model.IdeaWithAuthorAndVote;
import com.smotana.clearflask.security.limiter.Limit;
import com.smotana.clearflask.store.IdeaStore;
import com.smotana.clearflask.store.IdeaStore.SearchResponse;
import com.smotana.clearflask.store.UserStore.UserSession;
import com.smotana.clearflask.store.dynamo.DefaultDynamoDbProvider;
import com.smotana.clearflask.util.IdUtil;
import com.smotana.clearflask.web.ErrorWithMessageException;
import com.smotana.clearflask.web.security.ExtendedSecurityContext;
import com.smotana.clearflask.web.security.Role;
import lombok.extern.slf4j.Slf4j;

import javax.annotation.security.PermitAll;
import javax.annotation.security.RolesAllowed;
import javax.inject.Inject;
import javax.inject.Singleton;
import javax.ws.rs.Path;
import javax.ws.rs.core.Response;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.Optional;

@Slf4j
@Singleton
@Path("/v1")
public class IdeaResource extends AbstractResource implements IdeaApi, IdeaAdminApi {

    @Inject
    private IdeaStore ideaStore;

    @RolesAllowed({Role.PROJECT_USER})
    @Limit(requiredPermits = 30)
    @Override
    public Idea ideaCreate(String projectId, IdeaCreate ideaCreate) {
        UserSession session = getExtendedPrincipal().get().getUserSessionOpt().get();
        IdeaStore.IdeaModel ideaModel = ideaStore.createIdea(new IdeaStore.IdeaModel(
                projectId,
                IdUtil.randomId(),
                session.getUserId(),
                Instant.now(),
                ideaCreate.getTitle(),
                Strings.emptyToNull(ideaCreate.getDescription()),
                ideaCreate.getCategoryId(),
                null,
                ImmutableList.copyOf(ideaCreate.getTagIds()),
                0L,
                BigDecimal.ZERO,
                BigDecimal.ZERO,
                ImmutableSet.of(),
                0L,
                0L,
                BigDecimal.ZERO,
                ImmutableMap.of()))
                .getIdea();
        return ideaModel.toIdea();
    }

    @RolesAllowed({Role.PROJECT_OWNER})
    @Limit(requiredPermits = 1)
    @Override
    public Idea ideaCreateAdmin(String projectId, IdeaCreateAdmin ideaCreateAdmin) {
        IdeaStore.IdeaModel ideaModel = ideaStore.createIdea(new IdeaStore.IdeaModel(
                projectId,
                IdUtil.randomId(),
                ideaCreateAdmin.getAuthorUserId(),
                ideaCreateAdmin.getCreated(),
                ideaCreateAdmin.getTitle(),
                Strings.emptyToNull(ideaCreateAdmin.getDescription()),
                ideaCreateAdmin.getCategoryId(),
                ideaCreateAdmin.getStatusId(),
                ImmutableList.copyOf(ideaCreateAdmin.getTagIds()),
                0L,
                BigDecimal.ZERO,
                ideaCreateAdmin.getFundGoal(),
                ImmutableSet.of(),
                0L,
                0L,
                BigDecimal.ZERO,
                ImmutableMap.of()))
                .getIdea();
        return ideaModel.toIdea();
    }

    @PermitAll
    @Limit(requiredPermits = 1)
    @Override
    public IdeaWithAuthorAndVote ideaGet(String projectId, String ideaId) {
        return ideaStore.getIdea(projectId, ideaId)
                .map(IdeaStore.IdeaModel::toIdeaWithAuthorAndVote)
                .orElseThrow(() -> new ErrorWithMessageException(Response.Status.NOT_FOUND, "Idea not found"));
    }

    @RolesAllowed({Role.PROJECT_OWNER})
    @Limit(requiredPermits = 1)
    @Override
    public IdeaWithAuthorAndVote ideaGetAdmin(String projectId, String ideaId) {
        return ideaStore.getIdea(projectId, ideaId)
                .map(IdeaStore.IdeaModel::toIdeaWithAuthorAndVote)
                .orElseThrow(() -> new ErrorWithMessageException(Response.Status.NOT_FOUND, "Idea not found"));
    }

    @PermitAll
    @Limit(requiredPermits = 10)
    @Override
    public IdeaSearchResponse ideaSearch(String projectId, IdeaSearch ideaSearch, String cursor) {
        Optional<String> userIdOpt = getExtendedPrincipal()
                .flatMap(ExtendedSecurityContext.ExtendedPrincipal::getUserSessionOpt)
                .map(UserSession::getUserId);
        SearchResponse searchResponse = ideaStore.searchIdeas(
                projectId,
                ideaSearch,
                userIdOpt,
                Optional.ofNullable(Strings.emptyToNull(cursor)));

        ImmutableList<IdeaStore.IdeaModel> ideas = ideaStore.getIdeas(projectId, searchResponse.getIdeaIds());

        return new IdeaSearchResponse(
                searchResponse.getCursorOpt().orElse(null),
                ideas.stream()
                        .map(IdeaStore.IdeaModel::toIdeaWithAuthorAndVote)
                        .collect(ImmutableList.toImmutableList()));
    }

    @RolesAllowed({Role.PROJECT_OWNER})
    @Limit(requiredPermits = 10)
    @Override
    public IdeaSearchResponse ideaSearchAdmin(String projectId, IdeaSearchAdmin ideaSearchAdmin, String cursor) {
        SearchResponse searchResponse = ideaStore.searchIdeas(
                projectId,
                ideaSearchAdmin,
                false,
                Optional.ofNullable(Strings.emptyToNull(cursor)));

        ImmutableList<IdeaStore.IdeaModel> ideas = ideaStore.getIdeas(projectId, searchResponse.getIdeaIds());

        return new IdeaSearchResponse(
                searchResponse.getCursorOpt().orElse(null),
                ideas.stream()
                        .map(IdeaStore.IdeaModel::toIdeaWithAuthorAndVote)
                        .collect(ImmutableList.toImmutableList()));
    }

    @RolesAllowed({Role.IDEA_OWNER})
    @Limit(requiredPermits = 1)
    @Override
    public Idea ideaUpdate(String projectId, String ideaId, IdeaUpdate ideaUpdate) {
        return ideaStore.updateIdea(projectId, ideaId, ideaUpdate).getIdea().toIdea();
    }

    @RolesAllowed({Role.PROJECT_OWNER})
    @Limit(requiredPermits = 1)
    @Override
    public Idea ideaUpdateAdmin(String projectId, String ideaId, IdeaUpdateAdmin ideaUpdateAdmin) {
        return ideaStore.updateIdea(projectId, ideaId, ideaUpdateAdmin).getIdea().toIdea();
    }

    @RolesAllowed({Role.IDEA_OWNER})
    @Limit(requiredPermits = 1)
    @Override
    public void ideaDelete(String projectId, String ideaId) {
        ideaStore.deleteIdea(projectId, ideaId);
    }

    @RolesAllowed({Role.PROJECT_OWNER})
    @Limit(requiredPermits = 1)
    @Override
    public void ideaDeleteAdmin(String projectId, String ideaId) {
        ideaStore.deleteIdea(projectId, ideaId);
    }

    @RolesAllowed({Role.PROJECT_OWNER})
    @Limit(requiredPermits = 1)
    @Override
    public void ideaDeleteBulkAdmin(String projectId, IdeaSearchAdmin ideaSearchAdmin) {
        SearchResponse searchResponse = null;
        do {
            searchResponse = ideaStore.searchIdeas(
                    projectId,
                    ideaSearchAdmin.toBuilder().limit(DefaultDynamoDbProvider.DYNAMO_BATCH_MAX_SIZE).build(),
                    true,
                    searchResponse == null ? Optional.empty() : searchResponse.getCursorOpt());
            ideaStore.deleteIdeas(projectId, searchResponse.getIdeaIds());
        } while (!searchResponse.getCursorOpt().isPresent());
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(IdeaResource.class);
            }
        };
    }
}
