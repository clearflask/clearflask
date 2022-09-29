// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package io.dataspray.singletable;

public class SingleTableTestUtil {
    public static void clearDuplicateSchemaDetection(SingleTable singleTable) {
        singleTable.mapper.rangePrefixToDynamoTable.clear();
    }
}
