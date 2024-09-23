package com.smotana.clearflask.store;

import lombok.Value;

public interface LlmPromptStore {

    Prompt getPrompt(String projectId, String promptId) throws PromptNotReadyException, ProjectNotEligibleException;

    @Value
    class Prompt {
        String promptId;
        String projectId;
        String prompt;
        String response;
    }

    class PromptNotReadyException extends Exception {
        public PromptNotReadyException(String projectId, String promptId) {
            super("Prompt " + promptId + " not ready for project " + projectId);
        }
    }

    class ProjectNotEligibleException extends Exception {
        public ProjectNotEligibleException(String projectId) {
            super("Project " + projectId + " is not eligible for AI");
        }
    }
}
