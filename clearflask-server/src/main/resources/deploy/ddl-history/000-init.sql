 -- SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
 -- SPDX-License-Identifier: Apache-2.0
-- DATABASE & USER CREATE

CREATE DATABASE killbill CHARACTER SET utf8 COLLATE utf8_bin;
CREATE USER 'killbill'@'%' IDENTIFIED BY 'REDACTED';
