package com.smotana.clearflask.util;

import com.smotana.clearflask.proto.EncryptedData;

public interface ServerSecret {

    EncryptedData encryptBytes(byte[] plainText);

    String encryptString(String plainText);

    byte[] decryptBytes(EncryptedData encryptedData);

    String decryptString(String encryptedData);
}
