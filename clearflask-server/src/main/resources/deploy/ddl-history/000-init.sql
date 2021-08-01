 -- SPDX-FileCopyrightText: 2019-2020 Matus Faro <matus@smotana.com>
 -- SPDX-License-Identifier: AGPL-3.0-only

-- DATABASE & USER CREATE

CREATE DATABASE killbill CHARACTER SET utf8 COLLATE utf8_bin;
CREATE USER 'killbill'@'%' IDENTIFIED BY 'REDACTED';
