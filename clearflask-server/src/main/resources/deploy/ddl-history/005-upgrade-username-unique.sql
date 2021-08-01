 -- SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
 -- SPDX-License-Identifier: AGPL-3.0-only

-- Upgrade schema for KillBill 0.22.14

DROP INDEX users_username ON users;
CREATE UNIQUE INDEX users_username ON users(username);
