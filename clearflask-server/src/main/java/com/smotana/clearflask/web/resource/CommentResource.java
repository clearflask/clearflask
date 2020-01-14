package com.smotana.clearflask.web.resource;

import com.smotana.clearflask.api.CommentAdminApi;
import com.smotana.clearflask.api.CommentApi;
import com.smotana.clearflask.api.model.Comment;
import com.smotana.clearflask.api.model.CommentCreate;
import com.smotana.clearflask.api.model.CommentCreateAdmin;
import com.smotana.clearflask.api.model.CommentSearchAdmin;
import com.smotana.clearflask.api.model.CommentSearchResponse;
import com.smotana.clearflask.api.model.CommentUpdate;
import com.smotana.clearflask.security.limiter.Limit;
import com.smotana.clearflask.web.security.Role;
import lombok.extern.slf4j.Slf4j;

import javax.annotation.security.PermitAll;
import javax.annotation.security.RolesAllowed;
import javax.inject.Singleton;
import javax.ws.rs.Path;

@Slf4j
@Singleton
@Path("/v1")
public class CommentResource extends AbstractResource implements CommentAdminApi, CommentApi {

    @RolesAllowed({Role.PROJECT_OWNER})
    @Limit(requiredPermits = 1)
    @Override
    public Comment commentCreateAdmin(String projectId, String ideaId, CommentCreateAdmin create) {
        return null;
    }

    @RolesAllowed({Role.PROJECT_OWNER})
    @Limit(requiredPermits = 1)
    @Override
    public Comment commentDeleteAdmin(String projectId, String commentId) {
        return null;
    }

    @RolesAllowed({Role.PROJECT_OWNER})
    @Limit(requiredPermits = 1)
    @Override
    public void commentDeleteBulkAdmin(String projectId, CommentSearchAdmin search) {

    }

    @RolesAllowed({Role.PROJECT_OWNER})
    @Limit(requiredPermits = 10)
    @Override
    public CommentSearchResponse commentSearchAdmin(String projectId, CommentSearchAdmin search, String cursor) {
        return null;
    }

    @RolesAllowed({Role.PROJECT_OWNER})
    @Limit(requiredPermits = 1)
    @Override
    public Comment commentUpdateAdmin(String projectId, String ideaId, String commentId, CommentUpdate update) {
        return null;
    }

    @RolesAllowed({Role.PROJECT_OWNER, Role.PROJECT_USER})
    @Limit(requiredPermits = 10)
    @Override
    public Comment commentCreate(String projectId, String ideaId, CommentCreate create) {
        return null;
    }

    @RolesAllowed({Role.PROJECT_OWNER, Role.COMMENT_OWNER})
    @Limit(requiredPermits = 1)
    @Override
    public Comment commentDelete(String projectId, String ideaId, String commentId) {
        return null;
    }

    @PermitAll
    @Limit(requiredPermits = 1)
    @Override
    public CommentSearchResponse commentList(String projectId, String ideaId, String cursor) {
        return null;
    }

    @RolesAllowed({Role.COMMENT_OWNER})
    @Limit(requiredPermits = 1)
    @Override
    public Comment commentUpdate(String projectId, String ideaId, String commentId, CommentUpdate update) {
        return null;
    }
}
