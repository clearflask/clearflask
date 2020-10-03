package com.smotana.clearflask.billing;

import lombok.Value;

/**
 * Mimics ReportConfigurationJson from org.kill-bill.billing.plugin.java:analytics-plugin
 */
@Value
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
