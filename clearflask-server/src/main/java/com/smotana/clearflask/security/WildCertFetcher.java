package com.smotana.clearflask.security;

import com.smotana.clearflask.store.CertStore.CertModel;

import java.util.Optional;

public interface WildCertFetcher {
    Optional<CertModel> getOrCreateCert(String domain);
}
