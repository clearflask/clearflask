-- SPDX-FileCopyrightText: 2025 Matus Faro <matus@smotana.com>
-- SPDX-License-Identifier: Apache-2.0

USE clearflask;

-- Add visibility column to idea table for private post support
-- Note: This migration is idempotent on MySQL 8.0+, but for MySQL 5.7 compatibility
-- (used in CI integration tests), we omit IF NOT EXISTS since the database is fresh.
-- For production upgrades, this should be applied manually with IF NOT EXISTS if needed.
ALTER TABLE idea ADD COLUMN visibility VARCHAR(20) DEFAULT NULL;
