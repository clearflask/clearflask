// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.core.push.provider;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.NonNull;
import lombok.Value;

public interface BrowserPushService {

    void send(BrowserPush browserPush);

    @Value
    @Builder(toBuilder = true)
    @AllArgsConstructor
    class BrowserPush {
        @NonNull
        private final String subscription;
        @NonNull
        private final String title;
        @NonNull
        private final String body;
        @NonNull
        private final String projectId;
        @NonNull
        private final String userId;
        @NonNull
        private final String url;
    }
}
