 -- SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
 -- SPDX-License-Identifier: Apache-2.0
-- Upgrade schema for KillBill 0.22.14

DROP INDEX users_username ON users;
CREATE UNIQUE INDEX users_username ON users(username);
