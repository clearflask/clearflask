// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.store.elastic;

import com.google.common.base.Charsets;
import com.google.common.collect.ImmutableMap;
import com.google.common.io.Resources;
import com.google.gson.Gson;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.io.FilenameUtils;
import org.elasticsearch.action.admin.cluster.storedscripts.PutStoredScriptRequest;
import org.elasticsearch.common.bytes.BytesArray;
import org.elasticsearch.common.xcontent.XContentType;
import org.elasticsearch.script.Script;
import org.elasticsearch.script.ScriptType;

import java.io.File;
import java.net.URL;
import java.nio.file.Files;
import java.util.Map;

import static com.google.common.base.Preconditions.checkState;

@Slf4j
@Getter
public enum ElasticScript {
    WILSON("elastic/comment-vote-wilson.painless", 1),
    EXP_DECAY("elastic/exp-decay.painless", 2);

    private final String name;
    private final int version;
    private final String lang;
    private final String source;

    ElasticScript(String pathStr, int version) {
        try {
            this.version = version;
            this.name = FilenameUtils.getBaseName(pathStr);
            this.lang = FilenameUtils.getExtension(pathStr);
            URL fileUrl = Resources.getResource(pathStr);
            File file = new File(fileUrl.getPath());
            checkState(file.isFile());
            this.source = Files.readString(file.toPath(), Charsets.UTF_8);
        } catch (Exception ex) {
            throw new RuntimeException(ex);
        }
    }

    public PutStoredScriptRequest toPutStoredScriptRequest(Gson gson) {
        PutStoredScriptRequest request = new PutStoredScriptRequest();
        request.id(getScriptName());
        request.content(new BytesArray(gson.toJson(ImmutableMap.of(
                        "script", ImmutableMap.of(
                                "lang", lang,
                                "source", source)))),
                XContentType.JSON);
        return request;
    }

    public Script toScript(Map<String, Object> params) {
        return new Script(
                ScriptType.STORED,
                null,
                getScriptName(),
                null,
                params);
    }

    private String getScriptName() {
        return this.name + "-" + this.version;
    }
}
