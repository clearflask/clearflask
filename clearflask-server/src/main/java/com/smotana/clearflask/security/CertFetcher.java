// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.security;

import com.smotana.clearflask.api.model.CertGetOrCreateResponse;
import com.smotana.clearflask.store.CertStore.CertModel;
import com.smotana.clearflask.store.CertStore.KeypairModel;
import lombok.NonNull;
import lombok.Value;

import java.util.Optional;

public interface CertFetcher {
    Optional<CertGetOrCreateResponse> getOrCreateCertAndKeypair(String domain);

    @Value
    class CertAndKeypair {
        @NonNull
        CertModel cert;
        @NonNull
        KeypairModel keypair;

        public CertGetOrCreateResponse toCertGetOrCreateResponse() {
            return new CertGetOrCreateResponse(
                    cert.toCert(), keypair.toApiKeypair());
        }
    }
}
