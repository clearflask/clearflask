// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.core.image;

import com.smotana.clearflask.web.ApiException;
import lombok.Value;

public interface ImageNormalization {

    /**
     * Operations:
     * - Remove EXIF data from image
     * - Max dimensions
     * - Scale down quality
     * - Common format
     */
    Image normalize(byte[] imgBytes) throws ApiException;

    @Value
    class Image {
        String mediaType;
        byte[] data;
    }
}
