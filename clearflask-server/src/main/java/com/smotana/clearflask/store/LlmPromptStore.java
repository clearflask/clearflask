package com.smotana.clearflask.store;

import dev.langchain4j.data.message.SystemMessage;

public interface LlmPromptStore {

    SystemMessage getPrompt(String projectId) throws PromptNotReadyException, ProjectNotEligibleException;

    class PromptNotReadyException extends RuntimeException {
        public PromptNotReadyException(String projectId, String promptId) {
            super("Prompt " + promptId + " not ready for project " + projectId);
        }
    }

    class ProjectNotEligibleException extends RuntimeException {
        public ProjectNotEligibleException(String projectId) {
            super("Project " + projectId + " is not eligible for AI");
        }
    }
}
