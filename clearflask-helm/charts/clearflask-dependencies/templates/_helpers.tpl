{{/*
Expand the name of the chart.
*/}}
{{- define "clearflask-dependencies.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "clearflask-dependencies.fullname" -}}
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
{{- define "clearflask-dependencies.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "clearflask-dependencies.labels" -}}
helm.sh/chart: {{ include "clearflask-dependencies.chart" . }}
{{ include "clearflask-dependencies.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "clearflask-dependencies.selectorLabels" -}}
app.kubernetes.io/name: {{ include "clearflask-dependencies.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
MySQL fullname
*/}}
{{- define "clearflask-dependencies.mysql.fullname" -}}
{{- printf "%s-mysql" (include "clearflask-dependencies.fullname" .) | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
MySQL labels
*/}}
{{- define "clearflask-dependencies.mysql.labels" -}}
{{ include "clearflask-dependencies.labels" . }}
app.kubernetes.io/component: mysql
{{- end }}

{{/*
MySQL selector labels
*/}}
{{- define "clearflask-dependencies.mysql.selectorLabels" -}}
{{ include "clearflask-dependencies.selectorLabels" . }}
app.kubernetes.io/component: mysql
{{- end }}

{{/*
LocalStack fullname
*/}}
{{- define "clearflask-dependencies.localstack.fullname" -}}
{{- printf "%s-localstack" (include "clearflask-dependencies.fullname" .) | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
LocalStack labels
*/}}
{{- define "clearflask-dependencies.localstack.labels" -}}
{{ include "clearflask-dependencies.labels" . }}
app.kubernetes.io/component: localstack
{{- end }}

{{/*
LocalStack selector labels
*/}}
{{- define "clearflask-dependencies.localstack.selectorLabels" -}}
{{ include "clearflask-dependencies.selectorLabels" . }}
app.kubernetes.io/component: localstack
{{- end }}

{{/*
ElasticSearch fullname
*/}}
{{- define "clearflask-dependencies.elasticsearch.fullname" -}}
{{- printf "%s-elasticsearch" (include "clearflask-dependencies.fullname" .) | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
ElasticSearch labels
*/}}
{{- define "clearflask-dependencies.elasticsearch.labels" -}}
{{ include "clearflask-dependencies.labels" . }}
app.kubernetes.io/component: elasticsearch
{{- end }}

{{/*
ElasticSearch selector labels
*/}}
{{- define "clearflask-dependencies.elasticsearch.selectorLabels" -}}
{{ include "clearflask-dependencies.selectorLabels" . }}
app.kubernetes.io/component: elasticsearch
{{- end }}
