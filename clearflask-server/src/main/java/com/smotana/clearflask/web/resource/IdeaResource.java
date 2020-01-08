package com.smotana.clearflask.web.resource;

import com.google.inject.AbstractModule;
import com.google.inject.Module;
import com.kik.config.ice.ConfigSystem;
import com.smotana.clearflask.api.IdeaAdminApi;
import com.smotana.clearflask.api.IdeaApi;
import com.smotana.clearflask.api.model.Idea;
import com.smotana.clearflask.api.model.IdeaCreate;
import com.smotana.clearflask.api.model.IdeaCreateAdmin;
import com.smotana.clearflask.api.model.IdeaSearch;
import com.smotana.clearflask.api.model.IdeaSearchAdmin;
import com.smotana.clearflask.api.model.IdeaSearchResponse;
import com.smotana.clearflask.api.model.IdeaSearchResponse1;
import com.smotana.clearflask.api.model.IdeaUpdate;
import com.smotana.clearflask.api.model.IdeaUpdateAdmin;
import com.smotana.clearflask.api.model.IdeaWithAuthorAndVote;
import com.smotana.clearflask.api.model.IdeaWithAuthorAndVoteAdmin;
import com.smotana.clearflask.store.IdeaStore;
import com.smotana.clearflask.web.NotImplementedException;
import com.smotana.clearflask.web.security.Role;
import lombok.extern.slf4j.Slf4j;

import javax.annotation.security.PermitAll;
import javax.annotation.security.RolesAllowed;
import javax.inject.Inject;
import javax.inject.Singleton;
import javax.ws.rs.Path;

@Slf4j
@Singleton
@Path("/v1")
public class IdeaResource extends AbstractResource implements IdeaApi, IdeaAdminApi {

    public interface Config {
    }

    @Inject
    private Config config;
    @Inject
    private IdeaStore ideaStore;

    @RolesAllowed({Role.PROJECT_USER})
    @Override
    public Idea ideaCreate(String projectId, IdeaCreate ideaCreate) {
        throw new NotImplementedException();
    }

    @RolesAllowed({Role.PROJECT_OWNER})
    @Override
    public Idea ideaCreateAdmin(String projectId, IdeaCreateAdmin ideaCreateAdmin) {
        throw new NotImplementedException();
    }

    @PermitAll
    @Override
    public IdeaWithAuthorAndVote ideaGet(String projectId, String ideaId) {
        throw new NotImplementedException();
    }

    @RolesAllowed({Role.PROJECT_OWNER})
    @Override
    public IdeaWithAuthorAndVoteAdmin ideaGetAdmin(String projectId, String ideaId) {
        throw new NotImplementedException();
    }

    @PermitAll
    @Override
    public IdeaSearchResponse ideaSearch(String projectId, IdeaSearch ideaSearch, String cursor) {
        throw new NotImplementedException();
    }

    @RolesAllowed({Role.PROJECT_OWNER})
    @Override
    public IdeaSearchResponse1 ideaSearchAdmin(String projectId, IdeaSearchAdmin ideaSearchAdmin, String cursor) {
        throw new NotImplementedException();
    }

    @RolesAllowed({Role.IDEA_OWNER})
    @Override
    public Idea ideaUpdate(String projectId, String ideaId, IdeaUpdate ideaUpdate) {
        throw new NotImplementedException();
    }

    @RolesAllowed({Role.PROJECT_OWNER})
    @Override
    public Idea ideaUpdateAdmin(String projectId, String ideaId, IdeaUpdateAdmin ideaUpdateAdmin) {
        throw new NotImplementedException();
    }

    @RolesAllowed({Role.IDEA_OWNER})
    @Override
    public void ideaDelete(String projectId, String ideaId) {
        throw new NotImplementedException();
    }

    @RolesAllowed({Role.PROJECT_OWNER})
    @Override
    public void ideaDeleteAdmin(String projectId, String ideaId) {
        throw new NotImplementedException();
    }

    @RolesAllowed({Role.PROJECT_OWNER})
    @Override
    public void ideaDeleteBulkAdmin(String projectId, IdeaSearchAdmin ideaSearchAdmin) {
        throw new NotImplementedException();
    }


    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(IdeaResource.class);
                install(ConfigSystem.configModule(Config.class));
            }
        };
    }
}
