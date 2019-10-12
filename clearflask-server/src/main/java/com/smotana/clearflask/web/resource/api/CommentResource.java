package com.smotana.clearflask.web.resource.api;

import com.smotana.clearflask.api.CommentAdminApi;
import com.smotana.clearflask.api.CommentApi;
import com.smotana.clearflask.api.model.Comment;
import com.smotana.clearflask.api.model.CommentCreate;
import com.smotana.clearflask.api.model.CommentCreateAdmin;
import com.smotana.clearflask.api.model.CommentSearchAdmin;
import com.smotana.clearflask.api.model.CommentSearchResponse;
import com.smotana.clearflask.api.model.CommentUpdate;
import com.smotana.clearflask.web.resource.AbstractClearflaskResource;
import lombok.extern.slf4j.Slf4j;

import javax.inject.Singleton;
import javax.validation.constraints.NotNull;
import javax.ws.rs.Path;

@Slf4j
@Singleton
@Path("/v1")
public class CommentResource extends AbstractClearflaskResource implements CommentAdminApi, CommentApi {

    @Override
    public Comment commentCreateAdmin(String projectId, String ideaId, @NotNull CommentCreateAdmin create) {
        return null;
    }

    @Override
    public Comment commentDeleteAdmin(String projectId, String commentId) {
        return null;
    }

    @Override
    public void commentDeleteBulkAdmin(String projectId, @NotNull CommentSearchAdmin search) {

    }

    @Override
    public CommentSearchResponse commentSearchAdmin(String projectId, @NotNull CommentSearchAdmin search, String cursor) {
        return null;
    }

    @Override
    public Comment commentUpdateAdmin(String projectId, String ideaId, String commentId, @NotNull CommentUpdate update) {
        return null;
    }

    @Override
    public Comment commentCreate(String projectId, String ideaId, @NotNull CommentCreate create) {
        return null;
    }

    @Override
    public Comment commentDelete(String projectId, String ideaId, String commentId) {
        return null;
    }

    @Override
    public CommentSearchResponse commentList(String projectId, String ideaId, String cursor) {
        return null;
    }

    @Override
    public Comment commentUpdate(String projectId, String ideaId, String commentId, @NotNull CommentUpdate update) {
        return null;
    }
}
