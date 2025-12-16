-- SPDX-FileCopyrightText: 2025 Matus Faro <matus@smotana.com>
-- SPDX-License-Identifier: Apache-2.0

USE clearflask;

-- Add visibility column to idea table for private post support (idempotent)
ALTER TABLE idea ADD COLUMN IF NOT EXISTS visibility VARCHAR(20) DEFAULT NULL;
