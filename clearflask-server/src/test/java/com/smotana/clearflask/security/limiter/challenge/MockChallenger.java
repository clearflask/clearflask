// SPDX-FileCopyrightText: 2019-2020 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
package com.smotana.clearflask.security.limiter.challenge;

import com.google.common.collect.ImmutableMap;
import com.google.gson.Gson;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Singleton;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Singleton
public class MockChallenger implements Challenger {

    @Inject
    private Gson gson;

    @Override
    public String issue(String remoteIp, String target) {
        return gson.toJson(ImmutableMap.of(
                "remoteIp", remoteIp,
                "target", target));
    }

    @Override
    public boolean verify(String remoteIp, String target, String solution) {
        return gson.fromJson(solution, Boolean.class);
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(Challenger.class).to(MockChallenger.class).asEagerSingleton();
            }
        };
    }
}
