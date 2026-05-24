// SPDX-FileCopyrightText: 2019-2026 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.store;

import java.util.Optional;

public interface DnsStore {

    Optional<String> getTxtRecord(String host);

    void upsertTxtRecord(String host, String value);

    void deleteTxtRecord(String host, String value);
}
