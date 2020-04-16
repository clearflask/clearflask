package com.smotana.clearflask.util;

import javax.crypto.SecretKey;
import java.util.Base64;

/**
 * Unfortunately OverrideModule works by calling toString method to serialize properties.
 * Adding toString method to SecretKey here so it can be deserialized with a ConfigValueConverter inside
 * MoreConfigValueConverters.
 */
public class StringableSecretKey implements SecretKey {
    private final SecretKey source;

    public StringableSecretKey(SecretKey source) {
        this.source = source;
    }

    @Override
    public String getAlgorithm() {
        return source.getAlgorithm();
    }

    @Override
    public String getFormat() {
        return source.getFormat();
    }

    @Override
    public byte[] getEncoded() {
        return source.getEncoded();
    }

    @Override
    public String toString() {
        return Base64.getEncoder().encodeToString(getEncoded());
    }
}
