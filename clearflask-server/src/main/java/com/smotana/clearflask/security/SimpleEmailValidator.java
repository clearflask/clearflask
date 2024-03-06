// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.security;

import com.google.inject.AbstractModule;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.smotana.clearflask.web.ApiException;
import jakarta.mail.internet.AddressException;
import jakarta.mail.internet.InternetAddress;
import lombok.extern.slf4j.Slf4j;

import javax.ws.rs.core.Response;

@Slf4j
@Singleton
public class SimpleEmailValidator implements EmailValidator {

    @Override
    public void assertValid(String email) throws ApiException {
        if (!checkValidInternal(email)) {
            throw new ApiException(Response.Status.BAD_REQUEST, "Email is invalid! Please contact support if this is a mistake");
        }
    }

    @Override
    public EmailValidResult checkValid(String email) {
        return checkValidInternal(email)
                ? EmailValidResult.VALID
                : EmailValidResult.INVALID;
    }

    public boolean checkValidInternal(String email) {
        try {
            new InternetAddress(email).validate();
            return true;
        } catch (AddressException ex) {
            log.info("Denying email as invalid at position {} given email {}",
                    ex.getPos(), email);
            return false;
        }
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(EmailValidator.class).to(SimpleEmailValidator.class).asEagerSingleton();
            }
        };
    }
}
