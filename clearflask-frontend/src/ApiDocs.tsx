// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import { shallowEqual, useSelector } from 'react-redux';
import SwaggerUI from "swagger-ui-react";
import "swagger-ui-react/swagger-ui.css";
import { ReduxStateAdmin } from './api/serverAdmin';
import UpgradeWrapper, { Action } from './common/config/settings/UpgradeWrapper';
import windowIso from './common/windowIso';

const ApiDocs = (props: {
  projectId?: string;
}) => {
  const apiKey = useSelector<ReduxStateAdmin, string | undefined>(state => state.account.account.account?.apiKey, shallowEqual);
  return (
    <UpgradeWrapper action={Action.API_KEY}>
      <SwaggerUI
        url={`${windowIso.location.protocol}//${windowIso.location.host}/api/openapi.yaml`}
        onComplete={(instance) => {
          !!apiKey && instance.preauthorizeApiKey('ApiKeyAuth', apiKey);
        }}
        docExpansion='none'
        tryItOutEnabled
        parameterMacro={(operation: any, parameter: any) => {
          if (parameter.name === 'projectId' && !!props.projectId) {
            parameter.default = props.projectId;
            parameter.example = props.projectId;
          }
        }}
      />
    </UpgradeWrapper>
  );
}
export default ApiDocs;
