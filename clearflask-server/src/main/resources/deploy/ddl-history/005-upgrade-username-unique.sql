
-- Upgrade schema for KillBill 0.22.14

DROP INDEX users_username ON users;
CREATE UNIQUE INDEX users_username ON users(username);
