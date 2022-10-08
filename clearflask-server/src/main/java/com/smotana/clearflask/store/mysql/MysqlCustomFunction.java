// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.store.mysql;

import com.google.common.base.Charsets;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;

import java.io.File;
import java.net.URL;
import java.nio.file.Files;

import static com.google.common.base.Preconditions.checkState;

@Slf4j
@Getter
@AllArgsConstructor
public enum MysqlCustomFunction {
    WILSON("comment-vote-wilson.sql"),
    EXP_DECAY("exp-decay.sql");

    String filename;

    public String getSource() {
        try {
            URL fileUrl = Thread.currentThread().getContextClassLoader().getResource("mysql/" + getFilename());
            checkState(fileUrl != null);
            File file = new File(fileUrl.getPath());
            checkState(file.isFile());
            return Files.readString(file.toPath(), Charsets.UTF_8);
        } catch (Exception ex) {
            ex.printStackTrace(System.err);
            throw new RuntimeException(ex);
        }
    }
}
