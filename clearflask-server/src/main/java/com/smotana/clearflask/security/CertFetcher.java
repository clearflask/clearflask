package com.smotana.clearflask.security;

import com.smotana.clearflask.store.CertStore.CertModel;

import java.util.Optional;

public interface CertFetcher {
    Optional<CertModel> getOrCreateCert(String domain);
}
