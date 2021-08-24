// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
package com.smotana.clearflask.util;

import com.amazonaws.services.dynamodbv2.document.spec.GetItemSpec;
import com.amazonaws.services.dynamodbv2.document.spec.UpdateItemSpec;
import com.google.common.collect.ImmutableMap;
import com.google.inject.Inject;
import com.smotana.clearflask.store.ProjectStore;
import com.smotana.clearflask.store.ProjectStore.ProjectModel;
import com.smotana.clearflask.store.dynamo.mapper.DynamoMapper;
import com.smotana.clearflask.store.impl.DynamoElasticIdeaStore;
import com.smotana.clearflask.web.resource.AbstractBlackboxIT;
import lombok.extern.slf4j.Slf4j;
import org.elasticsearch.client.RequestOptions;
import org.elasticsearch.client.indices.GetMappingsRequest;
import org.elasticsearch.client.indices.GetMappingsResponse;
import org.elasticsearch.client.indices.PutMappingRequest;
import org.elasticsearch.common.xcontent.XContentType;
import org.junit.Test;

import java.io.IOException;
import java.util.Map;
import java.util.Optional;

import static com.smotana.clearflask.util.ProjectUpgraderImpl.PROJECT_VERSION_LATEST;
import static org.junit.Assert.*;

@Slf4j
public class ProjectUpgraderIT extends AbstractBlackboxIT {

    @Inject
    private ElasticUtil elasticUtil;
    @Inject
    private ProjectStore projectStore;

    @Test(timeout = 300_000L)
    public void testUpgrade() throws Exception {
        AccountAndProject accountAndProject = getTrialAccount();

        setProjectVersion(accountAndProject.getProject().getProjectId(), 0L);

        // Undo version 1 -> 0
        updateElasticSearchMapping(accountAndProject.getProject().getProjectId(), DynamoElasticIdeaStore.IDEA_INDEX, ImmutableMap.of(
                "order", ImmutableMap.of(
                        "type", "double",
                        // This should be deleted as part of the upgrade
                        "meta", ImmutableMap.of("expect_this", "to_be_deleted"))));

        // Perform upgrade
        assertTrue(projectStore.getProject(accountAndProject.getProject().getProjectId(), false).isPresent());
        assertProjectVersion(accountAndProject.getProject().getProjectId(), Optional.of(PROJECT_VERSION_LATEST));

        // Assert version 0 -> 1
        assertElasticSearchMapping(accountAndProject.getProject().getProjectId(), DynamoElasticIdeaStore.IDEA_INDEX, ImmutableMap.of(
                "order", ImmutableMap.of(
                        "type", "double")));
    }

    private void updateElasticSearchMapping(String projectId, String index, ImmutableMap<String, Object> properties) throws IOException {
        elastic.indices().putMapping(new PutMappingRequest(elasticUtil.getIndexName(index, projectId)).source(gson.toJson(ImmutableMap.of(
                "properties", properties)), XContentType.JSON),
                RequestOptions.DEFAULT);
    }


    private void assertElasticSearchMapping(String projectId, String index, ImmutableMap<String, Map<String, Object>> properties) throws IOException {
        GetMappingsResponse mappings = elastic.indices().getMapping(new GetMappingsRequest()
                        .indices(elasticUtil.getIndexName(index, projectId)),
                RequestOptions.DEFAULT);
        Map<String, Object> indexMappings = (Map<String, Object>) mappings
                .mappings()
                .get(elasticUtil.getIndexName(index, projectId))
                .getSourceAsMap()
                .get("properties");
        properties.forEach((field, expectedProperties) -> {
            Object fieldMapping = indexMappings.get(field);
            assertNotNull("mapping missing for " + field, fieldMapping);
            assertEquals("Mapping differs for field" + field, expectedProperties, fieldMapping);
        });
    }

    private void setProjectVersion(String projectId, long projectVersion) {
        DynamoMapper.TableSchema<ProjectModel> projectSchema = dynamoMapper.parseTableSchema(ProjectModel.class);
        projectSchema.table().updateItem(new UpdateItemSpec()
                .withPrimaryKey(projectSchema.primaryKey(Map.of(
                        "projectId", projectId)))
                .withNameMap(Map.of("#projectVersion", "projectVersion"))
                .withValueMap(Map.of(":projectVersion", projectVersion))
                .withUpdateExpression("SET #projectVersion = :projectVersion"));
    }

    private void assertProjectVersion(String projectId, Optional<Long> projectVersionOpt) {
        DynamoMapper.TableSchema<ProjectModel> projectSchema = dynamoMapper.parseTableSchema(ProjectModel.class);
        Optional<ProjectModel> projectOpt = Optional.ofNullable(projectSchema.fromItem(projectSchema.table()
                .getItem(new GetItemSpec()
                        .withPrimaryKey(projectSchema
                                .primaryKey(Map.of("projectId", projectId))))));
        assertTrue(projectOpt.isPresent());
        assertEquals(projectVersionOpt, Optional.ofNullable(projectOpt.get().getProjectVersion()));
    }
}