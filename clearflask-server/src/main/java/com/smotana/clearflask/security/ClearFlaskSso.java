package com.smotana.clearflask.security;

import com.google.common.base.Charsets;
import com.google.common.collect.ImmutableMap;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.kik.config.ice.annotations.NoDefaultValue;
import com.smotana.clearflask.store.AccountStore.Account;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.impl.compression.GzipCompressionCodec;
import lombok.extern.slf4j.Slf4j;

import javax.crypto.spec.SecretKeySpec;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;

@Slf4j
@Singleton
public class ClearFlaskSso {

    public interface Config {
        @NoDefaultValue
        String secretKey();

        @DefaultValue("P90D")
        Duration tokenTtl();
    }

    @Inject
    private Config config;

    public String generateToken(Account account) {
        Instant now = Instant.now();
        return Jwts.builder()
                .setIssuedAt(new Date(now.toEpochMilli()))
                .setExpiration(new Date(now.plus(config.tokenTtl()).toEpochMilli()))
                .addClaims(ImmutableMap.of(
                        "guid", account.getClearFlaskGuid(),
                        "email", account.getEmail(),
                        "name", account.getName()))
                .signWith(new SecretKeySpec(config.secretKey().getBytes(Charsets.UTF_8), SignatureAlgorithm.HS256.getJcaName()))
                .compressWith(new GzipCompressionCodec())
                .compact();
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(ClearFlaskSso.class).asEagerSingleton();
                install(ConfigSystem.configModule(Config.class));
            }
        };
    }
}
