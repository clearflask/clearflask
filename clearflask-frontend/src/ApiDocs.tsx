// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import React from 'react';
import SwaggerUI from "swagger-ui-react";
import "swagger-ui-react/swagger-ui.css";
import windowIso from './common/windowIso';

const ApiDocs = () => {
  return (
    <SwaggerUI
      url={`${windowIso.location.protocol}//${windowIso.location.host}/api/openapi.yaml`}
    />
  );
}
export default ApiDocs;
