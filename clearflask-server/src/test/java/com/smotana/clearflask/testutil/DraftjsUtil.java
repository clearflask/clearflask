package com.smotana.clearflask.testutil;

import com.smotana.clearflask.util.GsonProvider;
import lombok.NonNull;
import lombok.Value;

public class DraftjsUtil {

    public static String textToMockDraftjs(String text) {
        return GsonProvider.GSON.toJson(new MockDraftjsFormat(new MockDraftjsFormat.MockRawDraftContentBlock[]{
                new MockDraftjsFormat.MockRawDraftContentBlock(text)
        }));
    }

    @Value
    private static class MockDraftjsFormat {
        @NonNull
        private final MockRawDraftContentBlock[] blocks;

        @Value
        private static class MockRawDraftContentBlock {
            @NonNull
            private final String text;
        }
    }
}
