// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.billing;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.Value;
import org.killbill.billing.client.model.gen.AuditLog;

import java.util.ArrayList;
import java.util.List;

/**
 * Mimics ReportConfigurationJson from org.kill-bill.billing.plugin.java:analytics-plugin
 */

@Value
@EqualsAndHashCode(exclude = {"recordId", "schema"})
public class ReportConfigurationJson {
    private final Integer recordId;
    private final String reportName;
    private final String reportPrettyName;
    private final ReportType reportType;
    private final String sourceTableName;
    private final String refreshProcedureName;
    private final Frequency refreshFrequency;
    private final Integer refreshHourOfDayGmt;
    private final Object schema;

    public ReportConfigurationJson(@JsonProperty("recordId") final Integer recordId,
                                   @JsonProperty("reportName") final String reportName,
                                   @JsonProperty("reportPrettyName") final String reportPrettyName,
                                   @JsonProperty("reportType") final ReportType reportType,
                                   @JsonProperty("sourceTableName") final String sourceTableName,
                                   @JsonProperty("refreshProcedureName") final String refreshProcedureName,
                                   @JsonProperty("refreshFrequency") final Frequency refreshFrequency,
                                   @JsonProperty("refreshHourOfDayGmt") final Integer refreshHourOfDayGmt,
                                   @JsonProperty("schema") final Object schema) {
        this.recordId = recordId;
        this.reportName = reportName;
        this.reportPrettyName = reportPrettyName;
        this.reportType = reportType;
        this.sourceTableName = sourceTableName;
        this.refreshProcedureName = refreshProcedureName;
        this.refreshFrequency = refreshFrequency;
        this.refreshHourOfDayGmt = refreshHourOfDayGmt;
        this.schema = schema;
    }

    public static class ReportConfigurationJsonList extends ArrayList<ReportConfigurationJson> {
    }

    public enum ReportType {
        TIMELINE,
        COUNTERS,
        TABLE;
    }

    public enum Frequency {
        HOURLY,
        DAILY;
    }
}
