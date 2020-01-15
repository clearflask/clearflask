package com.smotana.clearflask.web.resource;

import com.smotana.clearflask.api.CreditAdminApi;
import com.smotana.clearflask.api.CreditApi;
import com.smotana.clearflask.api.model.Transaction;
import com.smotana.clearflask.api.model.TransactionCreateAdmin;
import com.smotana.clearflask.api.model.TransactionSearch;
import com.smotana.clearflask.api.model.TransactionSearchAdmin;
import com.smotana.clearflask.api.model.TransactionSearchAdminResponse;
import com.smotana.clearflask.api.model.TransactionSearchResponse;
import lombok.extern.slf4j.Slf4j;

import javax.inject.Singleton;
import javax.validation.Valid;
import javax.ws.rs.Path;

// TODO
@Slf4j
@Singleton
@Path("/v1")
public class CreditResource extends AbstractResource implements CreditApi, CreditAdminApi {

    @Override
    public Transaction transactionCreateAdmin(String projectId, String userId, @Valid TransactionCreateAdmin transactionCreateAdmin) {
        return null;
    }

    @Override
    public TransactionSearchAdminResponse transactionSearchAdmin(String projectId, @Valid TransactionSearchAdmin transactionSearchAdmin, String cursor) {
        return null;
    }

    @Override
    public TransactionSearchResponse transactionSearch(String projectId, String userId, @Valid TransactionSearch transactionSearch, String cursor) {
        return null;
    }
}
