package com.smotana.clearflask.util;

import com.google.common.hash.BloomFilter;
import com.google.common.hash.Funnel;
import lombok.extern.slf4j.Slf4j;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;

/**
 * Used for intercepting registration of already registered beans. Handles it by re-registering instead of throwing.
 */
@Slf4j
public class BloomFilters {
    public static <T> byte[] toByteArray(BloomFilter<T> bloomFilter) {
        try (ByteArrayOutputStream baos = new ByteArrayOutputStream()) {
            bloomFilter.writeTo(baos);
            return baos.toByteArray();
        } catch (IOException ex) {
            throw new RuntimeException(ex);
        }
    }

    public static <T> BloomFilter<T> fromByteArray(byte[] bloomFilterBytes, Funnel<T> funnel) {
        try (ByteArrayInputStream baos = new ByteArrayInputStream(bloomFilterBytes)) {
            return BloomFilter.readFrom(baos, funnel);
        } catch (IOException ex) {
            throw new RuntimeException(ex);
        }
    }
}
