// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.store;

import com.amazonaws.auth.AWSCredentials;
import com.amazonaws.auth.AWSCredentialsProvider;
import com.amazonaws.auth.AWSCredentialsProviderChain;
import com.amazonaws.auth.EC2ContainerCredentialsProviderWrapper;
import com.amazonaws.auth.EnvironmentVariableCredentialsProvider;
import com.amazonaws.auth.SystemPropertiesCredentialsProvider;
import com.amazonaws.auth.WebIdentityTokenCredentialsProvider;
import com.amazonaws.auth.profile.ProfileCredentialsProvider;
import com.google.common.base.Strings;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import lombok.extern.slf4j.Slf4j;

/**
 * Extends DefaultAWSCredentialsProviderChain to load access keys from configuration as well.
 */
@Slf4j
@Singleton
public class ConfigAwsCredentialsProvider extends AWSCredentialsProviderChain {

    public interface Config {
        @DefaultValue("")
        String awsAccessKeyId();

        @DefaultValue("")
        String awsSecretKey();
    }

    @Inject
    protected ConfigAwsCredentialsProvider(Config config) {
        super(new AWSCredentialsProvider() {
                  @Override
                  public AWSCredentials getCredentials() {
                      return new AWSCredentials() {
                          @Override
                          public String getAWSAccessKeyId() {
                              return Strings.emptyToNull(config.awsAccessKeyId());
                          }

                          @Override
                          public String getAWSSecretKey() {
                              return Strings.emptyToNull(config.awsSecretKey());
                          }
                      };
                  }

                  @Override
                  public void refresh() {
                      // No-op
                  }
              },
                new EnvironmentVariableCredentialsProvider(),
                new SystemPropertiesCredentialsProvider(),
                new ProfileCredentialsProvider(),
                WebIdentityTokenCredentialsProvider.create(),
                new EC2ContainerCredentialsProviderWrapper());
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(AWSCredentialsProvider.class).to(ConfigAwsCredentialsProvider.class);
                install(ConfigSystem.configModule(Config.class));
            }
        };
    }
}
