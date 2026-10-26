// SPDX-FileCopyrightText: 2026 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.web.resource;

import com.google.common.collect.ImmutableSet;
import com.smotana.clearflask.api.model.AccountDeleteSuperAdmin;
import com.smotana.clearflask.billing.Billing;
import com.smotana.clearflask.store.AccountStore;
import com.smotana.clearflask.store.ProjectStore;
import org.junit.Test;
import org.mockito.InOrder;

import java.lang.reflect.Field;
import java.util.List;
import java.util.Optional;

import static org.mockito.Mockito.*;

public class AccountDeletionTest {

    @Test
    public void closesBillingBeforeDeletingAccountRecord() throws Exception {
        AccountResource resource = new AccountResource();
        AccountStore accounts = mock(AccountStore.class);
        Billing billing = mock(Billing.class);
        ProjectResource projects = mock(ProjectResource.class);
        ProjectStore projectStore = mock(ProjectStore.class);
        AccountStore.Account account = mock(AccountStore.Account.class);
        when(account.getAccountId()).thenReturn("target");
        when(account.getProjectIds()).thenReturn(ImmutableSet.of("owned"));
        when(account.getExternalProjectIds()).thenReturn(ImmutableSet.of("shared"));
        when(accounts.getAccount("target", true)).thenReturn(Optional.of(account));
        inject(resource, "accountStore", accounts);
        inject(resource, "billing", billing);
        inject(resource, "projectResource", projects);
        inject(resource, "projectStore", projectStore);

        resource.accountDeleteSuperAdmin(new AccountDeleteSuperAdmin(List.of("target")));

        InOrder order = inOrder(projects, projectStore, billing, accounts);
        order.verify(projects).projectDeleteAdmin(account, "owned");
        order.verify(projectStore).removeAdmin("shared", "target");
        order.verify(billing).closeAccount("target");
        order.verify(accounts).deleteAccount("target");
    }

    private static void inject(AccountResource resource, String name, Object value) throws Exception {
        Field field = AccountResource.class.getDeclaredField(name);
        field.setAccessible(true);
        field.set(resource, value);
    }
}
