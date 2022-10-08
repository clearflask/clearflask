/*
 * This file is generated by jOOQ.
 */
package com.smotana.clearflask.store.mysql.model.routines;


import com.smotana.clearflask.store.mysql.model.DefaultSchema;

import org.jooq.Field;
import org.jooq.Parameter;
import org.jooq.impl.AbstractRoutine;
import org.jooq.impl.Internal;
import org.jooq.impl.SQLDataType;


/**
 * This class is generated by jOOQ.
 */
@SuppressWarnings({ "all", "unchecked", "rawtypes" })
public class JooqExpDecay extends AbstractRoutine<Double> {

    private static final long serialVersionUID = 1L;

    /**
     * The parameter <code>exp_decay.RETURN_VALUE</code>.
     */
    public static final Parameter<Double> RETURN_VALUE = Internal.createParameter("RETURN_VALUE", SQLDataType.DOUBLE, false, false);

    /**
     * The parameter <code>exp_decay.prevTrendScore</code>.
     */
    public static final Parameter<Double> PREVTRENDSCORE = Internal.createParameter("prevTrendScore", SQLDataType.DOUBLE, false, false);

    /**
     * The parameter <code>exp_decay.decayPeriodInMillis</code>.
     */
    public static final Parameter<Long> DECAYPERIODINMILLIS = Internal.createParameter("decayPeriodInMillis", SQLDataType.BIGINT, false, false);

    /**
     * The parameter <code>exp_decay.timeInMillis</code>.
     */
    public static final Parameter<Long> TIMEINMILLIS = Internal.createParameter("timeInMillis", SQLDataType.BIGINT, false, false);

    /**
     * Create a new routine call instance
     */
    public JooqExpDecay() {
        super("exp_decay", DefaultSchema.DEFAULT_SCHEMA, SQLDataType.DOUBLE);

        setReturnParameter(RETURN_VALUE);
        addInParameter(PREVTRENDSCORE);
        addInParameter(DECAYPERIODINMILLIS);
        addInParameter(TIMEINMILLIS);
    }

    /**
     * Set the <code>prevTrendScore</code> parameter IN value to the routine
     */
    public void setPrevtrendscore(Double value) {
        setValue(PREVTRENDSCORE, value);
    }

    /**
     * Set the <code>prevTrendScore</code> parameter to the function to be used
     * with a {@link org.jooq.Select} statement
     */
    public void setPrevtrendscore(Field<Double> field) {
        setField(PREVTRENDSCORE, field);
    }

    /**
     * Set the <code>decayPeriodInMillis</code> parameter IN value to the
     * routine
     */
    public void setDecayperiodinmillis(Long value) {
        setValue(DECAYPERIODINMILLIS, value);
    }

    /**
     * Set the <code>decayPeriodInMillis</code> parameter to the function to be
     * used with a {@link org.jooq.Select} statement
     */
    public void setDecayperiodinmillis(Field<Long> field) {
        setField(DECAYPERIODINMILLIS, field);
    }

    /**
     * Set the <code>timeInMillis</code> parameter IN value to the routine
     */
    public void setTimeinmillis(Long value) {
        setValue(TIMEINMILLIS, value);
    }

    /**
     * Set the <code>timeInMillis</code> parameter to the function to be used
     * with a {@link org.jooq.Select} statement
     */
    public void setTimeinmillis(Field<Long> field) {
        setField(TIMEINMILLIS, field);
    }
}
