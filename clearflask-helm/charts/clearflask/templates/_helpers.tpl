{{/*
Expand the name of the chart.
*/}}
{{- define "clearflask.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "clearflask.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "clearflask.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "clearflask.labels" -}}
helm.sh/chart: {{ include "clearflask.chart" . }}
{{ include "clearflask.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: clearflask
{{- end }}

{{/*
Selector labels
*/}}
{{- define "clearflask.selectorLabels" -}}
app.kubernetes.io/name: {{ include "clearflask.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Server fullname
*/}}
{{- define "clearflask.server.fullname" -}}
{{- printf "%s-server" (include "clearflask.fullname" .) | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Server labels
*/}}
{{- define "clearflask.server.labels" -}}
{{ include "clearflask.labels" . }}
app.kubernetes.io/component: server
{{- end }}

{{/*
Server selector labels
*/}}
{{- define "clearflask.server.selectorLabels" -}}
{{ include "clearflask.selectorLabels" . }}
app.kubernetes.io/component: server
{{- end }}

{{/*
Server service account name
*/}}
{{- define "clearflask.server.serviceAccountName" -}}
{{- if .Values.server.serviceAccount.create }}
{{- default (include "clearflask.server.fullname" .) .Values.server.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.server.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Connect fullname
*/}}
{{- define "clearflask.connect.fullname" -}}
{{- printf "%s-connect" (include "clearflask.fullname" .) | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Connect labels
*/}}
{{- define "clearflask.connect.labels" -}}
{{ include "clearflask.labels" . }}
app.kubernetes.io/component: connect
{{- end }}

{{/*
Connect selector labels
*/}}
{{- define "clearflask.connect.selectorLabels" -}}
{{ include "clearflask.selectorLabels" . }}
app.kubernetes.io/component: connect
{{- end }}

{{/*
Connect service account name
*/}}
{{- define "clearflask.connect.serviceAccountName" -}}
{{- if .Values.connect.serviceAccount.create }}
{{- default (include "clearflask.connect.fullname" .) .Values.connect.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.connect.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Get the domain
*/}}
{{- define "clearflask.domain" -}}
{{- .Values.global.domain }}
{{- end }}

{{/*
Get the server API base path for connect
*/}}
{{- define "clearflask.server.apiBasePath" -}}
{{- printf "http://%s:%d" (include "clearflask.server.fullname" .) (int .Values.server.service.port) }}
{{- end }}
