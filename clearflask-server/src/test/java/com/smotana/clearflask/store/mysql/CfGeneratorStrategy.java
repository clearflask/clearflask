package com.smotana.clearflask.store.mysql;

import org.jooq.codegen.DefaultGeneratorStrategy;
import org.jooq.meta.Definition;

public class CfGeneratorStrategy extends DefaultGeneratorStrategy {
    private static final String CLASSNAME_PREFIX = "Jooq";

    @Override
    public String getGlobalReferencesJavaClassName(Definition container, Class<? extends Definition> objectType) {
        return CLASSNAME_PREFIX + super.getGlobalReferencesJavaClassName(container, objectType);
    }

    @Override
    public String getJavaClassName(Definition definition, Mode mode) {
        return CLASSNAME_PREFIX + super.getJavaClassName(definition, mode);
    }
}
