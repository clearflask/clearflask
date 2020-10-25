package com.smotana.clearflask.core.push.provider;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.NonNull;
import lombok.Value;

public interface EmailService {

    void send(Email email);

    @Value
    @Builder(toBuilder = true)
    @AllArgsConstructor
    class Email {
        @NonNull
        private final String toAddress;
        @NonNull
        private final String subject;
        @NonNull
        private final String contentHtml;
        @NonNull
        private final String contentText;
        @NonNull
        private final String projectOrAccountId;
        @NonNull
        private final String typeTag;
    }
}
