// SPDX-FileCopyrightText: 2019-2020 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
package com.smotana.clearflask.util;

import com.smotana.clearflask.proto.EncryptedData;

public interface ServerSecret {

    EncryptedData encryptBytes(byte[] plainText);

    String encryptString(String plainText);

    byte[] decryptBytes(EncryptedData encryptedData);

    String decryptString(String encryptedData);
}
