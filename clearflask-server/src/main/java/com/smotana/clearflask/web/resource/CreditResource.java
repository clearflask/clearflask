// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.web.resource;

import com.google.common.base.Strings;
import com.google.common.collect.ImmutableList;
import com.google.inject.AbstractModule;
import com.google.inject.Module;
import com.google.inject.multibindings.Multibinder;
import com.google.inject.name.Names;
import com.smotana.clearflask.api.CreditAdminApi;
import com.smotana.clearflask.api.CreditApi;
import com.smotana.clearflask.api.model.Balance;
import com.smotana.clearflask.api.model.ConfigAdmin;
import com.smotana.clearflask.api.model.CreditIncome;
import com.smotana.clearflask.api.model.TransactionSearch;
import com.smotana.clearflask.api.model.TransactionSearchAdmin;
import com.smotana.clearflask.api.model.TransactionSearchAdminResponse;
import com.smotana.clearflask.api.model.TransactionSearchResponse;
import com.smotana.clearflask.billing.Billing;
import com.smotana.clearflask.core.push.NotificationService;
import com.smotana.clearflask.security.limiter.Limit;
import com.smotana.clearflask.store.ProjectStore;
import com.smotana.clearflask.store.UserStore;
import com.smotana.clearflask.store.UserStore.UserModel;
import com.smotana.clearflask.store.VoteStore;
import com.smotana.clearflask.store.VoteStore.ListResponse;
import com.smotana.clearflask.store.VoteStore.TransactionModel;
import com.smotana.clearflask.web.ApiException;
import com.smotana.clearflask.web.Application;
import com.smotana.clearflask.web.security.Role;
import lombok.extern.slf4j.Slf4j;

import javax.annotation.security.RolesAllowed;
import javax.inject.Inject;
import javax.inject.Singleton;
import javax.validation.Valid;
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
    @Inject
    private ProjectStore projectStore;
    @Inject
    private Billing billing;
    @Inject
    private NotificationService notificationService;

    @RolesAllowed({Role.PROJECT_ADMIN})
    @Limit(requiredPermits = 1)
    @Override
    public void creditIncome(String projectId, @Valid CreditIncome creditIncome) {
        sanitizer.email(creditIncome.getEmail());

        UserModel user = userStore.getUserByIdentifier(projectId, UserStore.IdentifierType.GUID, creditIncome.getGuid())
                .orElseGet(() -> userStore.createOrGet(
                        projectId,
                        creditIncome.getGuid(),
                        Optional.ofNullable(Strings.emptyToNull(creditIncome.getEmail())),
                        Optional.ofNullable(Strings.emptyToNull(creditIncome.getName())),
                        false));
        TransactionModel transaction = voteStore.balanceAdjustTransaction(
                projectId,
                user.getUserId(),
                creditIncome.getAmount(),
                Optional.ofNullable(Strings.emptyToNull(creditIncome.getSummary())).orElse("Automatic income"),
                Optional.of(creditIncome.getTransactionId()));
        userStore.updateUserBalance(projectId, user.getUserId(), creditIncome.getAmount(), Optional.empty());
        ConfigAdmin configAdmin = projectStore.getProject(projectId, true).get().getVersionedConfigAdmin().getConfig();
        notificationService.onCreditChanged(configAdmin, user, transaction);
    }

    @RolesAllowed({Role.PROJECT_ADMIN_ACTIVE})
    @Limit(requiredPermits = 1)
    @Override
    public TransactionSearchAdminResponse transactionSearchAdmin(String projectId, TransactionSearchAdmin transactionSearchAdmin, String cursor) {
        throw new ApiException(Response.Status.NOT_IMPLEMENTED);
    }

    @RolesAllowed({Role.PROJECT_USER})
    @Limit(requiredPermits = 1)
    @Override
    public TransactionSearchResponse transactionSearch(String projectId, String userId, TransactionSearch transactionSearch, String cursor) {
        ListResponse<TransactionModel> transactionModelListResponse = voteStore.transactionList(projectId, userId, Optional.ofNullable(Strings.emptyToNull(cursor)));
        UserModel user = userStore.getUser(projectId, userId).orElseThrow(() -> new ApiException(Response.Status.UNAUTHORIZED, "User not found"));
        return new TransactionSearchResponse(
                transactionModelListResponse.getCursorOpt().orElse(null),
                transactionModelListResponse.getItems().stream().map(TransactionModel::toTransaction).collect(ImmutableList.toImmutableList()),
                new Balance(user.getBalance()));
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(CreditResource.class);
                Multibinder.newSetBinder(binder(), Object.class, Names.named(Application.RESOURCE_NAME)).addBinding()
                        .to(CreditResource.class);
            }
        };
    }
}
