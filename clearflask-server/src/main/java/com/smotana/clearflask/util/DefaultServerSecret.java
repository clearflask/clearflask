package com.smotana.clearflask.util;

import com.google.common.base.Charsets;
import com.google.inject.AbstractModule;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.google.inject.name.Named;
import com.google.protobuf.ByteString;
import com.google.protobuf.InvalidProtocolBufferException;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.NoDefaultValue;
import com.smotana.clearflask.proto.EncryptedData;
import lombok.extern.slf4j.Slf4j;

import javax.crypto.BadPaddingException;
import javax.crypto.Cipher;
import javax.crypto.IllegalBlockSizeException;
import javax.crypto.NoSuchPaddingException;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.security.InvalidAlgorithmParameterException;
import java.security.InvalidKeyException;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;

import static com.google.common.base.Preconditions.checkArgument;

/**
 * DO NOT OPEN SOURCE
 */
@Slf4j
@Singleton
public final class DefaultServerSecret implements ServerSecret {

    static final String KEY_SPEC = "AES";
    static final String KEY_SIZE = "256";
    static final String ENCRYPTION_ALGORITHM = "AES/GCM/NoPadding";
    static final int AUTH_TAG_LENGTH = 16 * Byte.SIZE;

    public interface Config {
        @NoDefaultValue
        String sharedKey();
    }

    @InjectNamed
    private Config config;

    private final SecureRandom random = new SecureRandom();

    protected DefaultServerSecret() {
        super();
    }

    @Override
    public EncryptedData encryptBytes(byte[] plainText) {
        checkArgument(plainText != null);
        try {
            byte[] initVector = getRandomInitVector();
            Cipher encryptCipher = getEncryptionCipher(getSharedKey(), initVector);
            return EncryptedData.newBuilder()
                    .setCipherText(ByteString.copyFrom(encryptCipher.doFinal(plainText)))
                    .setInitVector(ByteString.copyFrom(initVector))
                    .build();
        } catch (IllegalBlockSizeException | BadPaddingException ex) {
            throw new RuntimeException("Failed to encrypt.", ex);
        }
    }

    @Override
    public String encryptString(String plainText) {
        checkArgument(plainText != null);
        return Base64.getEncoder().encodeToString(encryptBytes(plainText.getBytes(Charsets.UTF_8)).toByteArray());
    }

    @Override
    public byte[] decryptBytes(EncryptedData encryptedData) {
        checkArgument(encryptedData != null);
        try {
            Cipher decryptCipher = getDecryptionCipher(getSharedKey(), encryptedData.getInitVector().toByteArray());
            return decryptCipher.doFinal(encryptedData.getCipherText().toByteArray());
        } catch (IllegalBlockSizeException | BadPaddingException ex) {
            throw new RuntimeException(ex);
        }
    }

    @Override
    public String decryptString(String encryptedData) {
        checkArgument(encryptedData != null);
        try {
            return new String(decryptBytes(EncryptedData.parseFrom(Base64.getDecoder().decode(encryptedData))), Charsets.UTF_8);
        } catch (InvalidProtocolBufferException ex) {
            throw new RuntimeException(ex);
        }
    }

    private byte[] getRandomInitVector() {
        byte[] bytes = new byte[16];
        this.random.nextBytes(bytes);
        return bytes;
    }

    private Cipher getEncryptionCipher(byte[] key, byte[] initVector) {
        try {
            Cipher encryptCipher = Cipher.getInstance(ENCRYPTION_ALGORITHM);
            SecretKeySpec keySpec = new SecretKeySpec(key, KEY_SPEC);
            encryptCipher.init(Cipher.ENCRYPT_MODE, keySpec, new GCMParameterSpec(AUTH_TAG_LENGTH, initVector));
            return encryptCipher;
        } catch (NoSuchAlgorithmException | NoSuchPaddingException | InvalidKeyException | InvalidAlgorithmParameterException ex) {
            throw new RuntimeException("Unable to create cipher for key", ex);
        }
    }

    private Cipher getDecryptionCipher(byte[] key, byte[] initVector) {
        try {
            Cipher decryptCipher = Cipher.getInstance(ENCRYPTION_ALGORITHM);
            SecretKeySpec keySpec = new SecretKeySpec(key, KEY_SPEC);
            decryptCipher.init(Cipher.DECRYPT_MODE, keySpec, new GCMParameterSpec(AUTH_TAG_LENGTH, initVector));
            return decryptCipher;
        } catch (NoSuchAlgorithmException | NoSuchPaddingException | InvalidKeyException | InvalidAlgorithmParameterException ex) {
            throw new RuntimeException("Unable to create cipher for key", ex);
        }
    }

    private byte[] getSharedKey() {
        return Base64.getDecoder().decode(config.sharedKey());
    }

    public static Module module(Named name) {
        return new AbstractModule() {
            @Override
            protected void configure() {
                install(ConfigSystem.configModule(Config.class, name));
                install(NamedProviderBinding.namedModule(name, DefaultServerSecret.class, ServerSecret.class));
            }
        };
    }
}
