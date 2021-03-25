package com.smotana.clearflask.core.image;

import com.smotana.clearflask.web.ApiException;
import lombok.Value;

import java.io.InputStream;

public interface ImageNormalization {

    /**
     * Operations:
     * - Remove EXIF data from image
     * - Max dimensions
     * - Scale down quality
     * - Common format
     */
    Image normalize(InputStream in) throws ApiException;

    @Value
    class Image {
        String mediaType;
        byte[] data;
    }
}
