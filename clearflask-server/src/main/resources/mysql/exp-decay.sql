-- SPDX-FileCopyrightText: 2022-2022 Matus Faro <matussmotana.com>
-- SPDX-License-Identifier: Apache-2.0

DELIMITER //

CREATE FUNCTION exp_decay(
        prevTrendScore DOUBLE,
        decayPeriodInMillis BIGINT,
        timeInMillis BIGINT)
    RETURNS DOUBLE DETERMINISTIC
    BEGIN
        DECLARE rate DOUBLE;
        DECLARE u DOUBLE;
        DECLARE v DOUBLE;
        -- See ExpDecayScore.java
        SET prevTrendScore = IFNULL(prevTrendScore, 0);
        SET rate = 1 / decayPeriodInMillis;
        SET u = GREATEST(prevTrendScore, rate * timeInMillis);
        SET v = LEAST(prevTrendScore, rate * timeInMillis);
        RETURN u + LN(EXP(v - u) + 1);
    END //

DELIMITER ;
