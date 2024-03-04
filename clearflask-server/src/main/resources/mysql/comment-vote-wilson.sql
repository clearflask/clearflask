-- SPDX-FileCopyrightText: 2022-2022 Matus Faro <matussmotana.com>
-- SPDX-License-Identifier: Apache-2.0

DELIMITER
//

CREATE FUNCTION vote_wilson(
    upvotes BIGINT,
    downvotes BIGINT,
    z DOUBLE,
    zSquared DOUBLE)
    RETURNS DOUBLE DETERMINISTIC
BEGIN
        DECLARE
numberOfSuccesses BIGINT;
        DECLARE
numberOfTrials BIGINT;
        DECLARE
zSquared DOUBLE;
        DECLARE
mean DOUBLE;
        DECLARE
factor DOUBLE;
        DECLARE
modifiedSuccessRatio DOUBLE;
        DECLARE
difference DOUBLE;
        DECLARE
lowerBound DOUBLE;
        -- See WilsonScoreInterval.java
        SET
numberOfSuccesses = IFNULL(upvotes, 0);
        SET
numberOfTrials = numberOfSuccesses + IFNULL(downvotes, 0);
        IF
numberOfTrials = 0 THEN
            RETURN 0;
END IF;
        SET
zSquared = z * z;
        SET
mean = numberOfSuccesses / numberOfTrials;
        SET
factor = 1 / (1 + (1 / numberOfTrials * zSquared));
        SET
modifiedSuccessRatio = mean + (1 / (2 * numberOfTrials) * zSquared);
        SET
difference = z * SQRT((1 / numberOfTrials * mean * (1 - mean)) + (1 / (4 * POW(numberOfTrials, 2)) * zSquared));
        SET
lowerBound = factor * (modifiedSuccessRatio - difference);
RETURN lowerBound;
END
//

DELIMITER ;
