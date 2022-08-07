package com.smotana.clearflask.util;

import com.google.common.collect.ImmutableList;

import java.io.PrintStream;
import java.util.Collection;

class CompositeException extends Exception {
    private final ImmutableList<Exception> exes;

    public CompositeException(String message, Exception... exes) {
        super(message);
        this.exes = ImmutableList.copyOf(exes);
    }

    public CompositeException(String message, Collection<Exception> exes) {
        super(message);
        this.exes = ImmutableList.copyOf(exes);
    }

    public ImmutableList<Exception> getCauses() {
        return exes;
    }

    @Override
    public void printStackTrace(PrintStream s) {
        for (Throwable ex : exes) {
            ex.printStackTrace(s);
        }
    }
}