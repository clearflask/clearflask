package io.dataspray.singletable;

public class SingleTableTestUtil {
    public static void clearDuplicateSchemaDetection(SingleTable singleTable) {
        singleTable.mapper.rangePrefixToDynamoTable.clear();
    }
}
