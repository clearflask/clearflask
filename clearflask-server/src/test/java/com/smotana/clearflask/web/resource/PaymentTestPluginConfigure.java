// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.web.resource;

import com.google.common.base.Preconditions;
import com.google.gson.annotations.SerializedName;
import lombok.Value;

import java.util.Optional;
import java.util.concurrent.TimeUnit;

/**
 * Based on https://github.com/killbill/killbill-payment-test-plugin/blob/master/src/main/java/org/killbill/billing/plugin/payment/model/Payload.java
 *
 * Copyright 2014-2020 The Billing Project, LLC
 *
 * The Billing Project licenses this file to you under the Apache License, version 2.0
 * (the "License"); you may not use this file except in compliance with the
 * License.  You may obtain a copy of the License at:
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.  See the
 * License for the specific language governing permissions and limitations
 * under the License.
 */
@Value
public class PaymentTestPluginConfigure {

    // From https://github.com/killbill/killbill-payment-test-plugin/blob/master/src/main/java/org/killbill/billing/plugin/payment/TestingStates.java
    public enum PaymentTestPluginAction {
        /**
         * This will make the plugin return a PaymentPluginStatus.PENDING on each payment call
         */
        ACTION_RETURN_PLUGIN_STATUS_PENDING,
        /**
         * This will make the plugin return a PaymentPluginStatus.ERROR on each payment call (e.g to simulate
         * Insuficient Fund type of errors).
         */
        ACTION_RETURN_PLUGIN_STATUS_ERROR,
        /**
         * This will make the plugin return a PaymentPluginStatus.CANCELED on each payment call (e.g. to simulate
         * Gateway Error type of errors).
         */
        ACTION_RETURN_PLUGIN_STATUS_CANCELED,
        /**
         * This will make the plugin throw RuntimeException exception on each call
         */
        ACTION_THROW_EXCEPTION,
        /**
         * This will make the plugin return a nil value on each call
         */
        RETURN_NIL,
        /**
         * This will make the plugin sleep sleep_time_sec on each call
         */
        ACTION_SLEEP,
        /**
         * Clear the state.
         */
        ACTION_CLEAR
    }

    @SerializedName("CONFIGURE_ACTION")
    private final String action;
    @SerializedName("METHODS")
    private final String methods;
    @SerializedName("SLEEP_TIME_SEC")
    private final Long sleepTime;


    public PaymentTestPluginConfigure(PaymentTestPluginAction configureAction, Optional<Long> sleepTimeInMillisOpt) {
        Preconditions.checkArgument(!sleepTimeInMillisOpt.isPresent() || configureAction == PaymentTestPluginAction.ACTION_SLEEP);
        this.action = configureAction.name();
        this.sleepTime = sleepTimeInMillisOpt.map(TimeUnit.MILLISECONDS::toSeconds).orElse(null);
        this.methods = null;
    }
}
