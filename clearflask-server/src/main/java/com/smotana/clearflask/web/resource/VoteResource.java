package com.smotana.clearflask.web.resource;

import com.smotana.clearflask.api.VoteAdminApi;
import com.smotana.clearflask.api.VoteApi;
import com.smotana.clearflask.api.model.VoteGetOwn;
import com.smotana.clearflask.api.model.VoteGetOwnResponse;
import com.smotana.clearflask.api.model.VoteSearchAdmin;
import com.smotana.clearflask.api.model.VoteSearchResponse;
import com.smotana.clearflask.api.model.VoteUpdate;
import com.smotana.clearflask.api.model.VoteUpdateAdminResponse;
import com.smotana.clearflask.api.model.VoteUpdateResponse;
import lombok.extern.slf4j.Slf4j;

import javax.inject.Singleton;
import javax.validation.Valid;
import javax.ws.rs.Path;

// TODO
@Slf4j
@Singleton
@Path("/v1")
public class VoteResource extends AbstractResource implements VoteApi, VoteAdminApi {

    @Override
    public void voteDeleteAdmin(String projectId, String voteId) {

    }

    @Override
    public void voteDeleteBulkAdmin(String projectId, @Valid VoteSearchAdmin voteSearchAdmin) {

    }

    @Override
    public VoteSearchResponse voteSearchAdmin(String projectId, @Valid VoteSearchAdmin voteSearchAdmin, String cursor) {
        return null;
    }

    @Override
    public VoteUpdateAdminResponse voteUpdateAdmin(String projectId, @Valid VoteUpdate voteUpdate) {
        return null;
    }

    @Override
    public VoteGetOwnResponse voteGetOwn(String projectId, @Valid VoteGetOwn voteGetOwn) {
        return null;
    }

    @Override
    public VoteUpdateResponse voteUpdate(String projectId, @Valid VoteUpdate voteUpdate) {
        return null;
    }
}
