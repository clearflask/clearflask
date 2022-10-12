package com.smotana.clearflask.store.mysql;

import org.jooq.codegen.JavaGenerator;

public class CfJavaGenerator extends JavaGenerator {

    @Override
    public boolean generateGeneratedAnnotation() {
        return true;
    }
}
