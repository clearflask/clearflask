package com.smotana.clearflask.web.resource;

import com.google.common.base.Strings;
import com.google.common.collect.ImmutableList;
import com.smotana.clearflask.api.CreditAdminApi;
import com.smotana.clearflask.api.CreditApi;
import com.smotana.clearflask.api.model.*;
import com.smotana.clearflask.security.limiter.Limit;
import com.smotana.clearflask.store.UserStore;
import com.smotana.clearflask.store.UserStore.UserModel;
import com.smotana.clearflask.store.VoteStore;
import com.smotana.clearflask.store.VoteStore.ListResponse;
import com.smotana.clearflask.web.Application;
import com.smotana.clearflask.web.ErrorWithMessageException;
import com.smotana.clearflask.web.NotImplementedException;
import com.smotana.clearflask.web.security.Role;
import lombok.extern.slf4j.Slf4j;

import javax.annotation.security.RolesAllowed;
import javax.inject.Inject;
import javax.inject.Singleton;
import javax.ws.rs.Path;
import javax.ws.rs.core.Response;
import java.util.Optional;

@Slf4j
@Singleton
@Path(Application.RESOURCE_VERSION)
public class CreditResource extends AbstractResource implements CreditApi, CreditAdminApi {

    @Inject
    private VoteStore voteStore;
    @Inject
    private UserStore userStore;

    @RolesAllowed({Role.PROJECT_OWNER_ACTIVE})
    @Limit(requiredPermits = 1)
    @Override
    public TransactionSearchAdminResponse transactionSearchAdmin(String projectId, TransactionSearchAdmin transactionSearchAdmin, String cursor) {
        throw new NotImplementedException();
    }

    @RolesAllowed({Role.PROJECT_USER})
    @Limit(requiredPermits = 1)
    @Override
    public TransactionSearchResponse transactionSearch(String projectId, String userId, TransactionSearch transactionSearch, String cursor) {
        ListResponse<VoteStore.TransactionModel> transactionModelListResponse = voteStore.transactionList(projectId, userId, Optional.ofNullable(Strings.emptyToNull(cursor)));
        UserModel user = userStore.getUser(projectId, userId).orElseThrow(() -> new ErrorWithMessageException(Response.Status.FORBIDDEN, "User not found"));
        return new TransactionSearchResponse(
                transactionModelListResponse.getCursorOpt().orElse(null),
                transactionModelListResponse.getItems().stream().map(VoteStore.TransactionModel::toTransaction).collect(ImmutableList.toImmutableList()),
                new Balance(user.getBalance()));
    }
}
