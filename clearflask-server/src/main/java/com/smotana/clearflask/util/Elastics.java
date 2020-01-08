package com.smotana.clearflask.util;

import lombok.extern.slf4j.Slf4j;

@Slf4j
public class Elastics {

    public String getIndexName(String indexName, String projectId) {
        return indexName + "-" + projectId;
    }
}
