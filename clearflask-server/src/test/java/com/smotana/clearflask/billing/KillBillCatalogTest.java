package com.smotana.clearflask.billing;

import org.junit.Test;
import org.killbill.billing.catalog.StandaloneCatalog;
import org.killbill.xmlloader.XMLLoader;

import java.net.URI;

import static org.junit.Assert.assertNotNull;

public class KillBillCatalogTest {

    @Test(timeout = 10_000L)
    public void test() throws Exception {
        for (String fileName : KillBillSync.CATALOG_FILENAMES) {
            String filePath = KillBillSync.CATALOG_PREFIX + fileName;
            StandaloneCatalog catalog = XMLLoader.getObjectFromUri(URI.create(filePath), StandaloneCatalog.class);
            assertNotNull("catalog failed to load: " + filePath, catalog);
        }
    }
}