// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import { shallowEqual, useSelector } from 'react-redux';
import SwaggerUI from "swagger-ui-react";
import "swagger-ui-react/swagger-ui.css";
import { ReduxStateAdmin } from './api/serverAdmin';
import windowIso from './common/windowIso';

const ApiDocs = () => {
  const apiKey = useSelector<ReduxStateAdmin, string | undefined>(state => state.account.account.account?.apiKey, shallowEqual);
  return (
    <SwaggerUI
      url={`${windowIso.location.protocol}//${windowIso.location.host}/api/openapi.yaml`}
      onComplete={(instance) => {
        !!apiKey && instance.preauthorizeApiKey('ApiKeyAuth', apiKey);
      }}
      tryItOutEnabled
    />
  );
}
export default ApiDocs;
