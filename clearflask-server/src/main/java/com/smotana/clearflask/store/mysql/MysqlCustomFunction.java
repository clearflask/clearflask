// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.store.mysql;

import com.google.common.base.Charsets;
import com.smotana.clearflask.store.elastic.ElasticScript;
import com.smotana.clearflask.util.MoreResources;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.io.FilenameUtils;

import java.io.File;
import java.net.URL;
import java.nio.file.Files;

import static com.google.common.base.Preconditions.checkState;

@Slf4j
@Getter
public enum MysqlCustomFunction {
    WILSON("mysql/comment-vote-wilson.sql"),
    EXP_DECAY("mysql/exp-decay.sql");

    private final String name;
    private final String source;

    MysqlCustomFunction(String pathStr) {
        try {
            this.name = FilenameUtils.getBaseName(pathStr);
            URL fileUrl = MoreResources.getResource(pathStr,
                    // For some weird reason, need to use ElasticScript classloader
                    // since this class is not referenced on startup it somehow cannot
                    // find the resource. I blame the Guice classloader blindly and my inexperience
                    ElasticScript.class.getClassLoader());
            File file = new File(fileUrl.getPath());
            checkState(file.isFile());
            source = Files.readString(file.toPath(), Charsets.UTF_8);
        } catch (Exception ex) {
            throw new RuntimeException(ex);
        }
    }

    public String getSource() {
        return this.source;
    }
}
