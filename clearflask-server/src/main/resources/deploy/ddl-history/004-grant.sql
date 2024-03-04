-- SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
-- SPDX-License-Identifier: Apache-2.0
-- USER ACCESS CONTROL

GRANT
SELECT,
UPDATE,
DELETE,
INSERT
,
EXECUTE
ON killbill.* TO 'killbill'@'%';

