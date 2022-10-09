// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import { VersionedConfigAdmin } from './api/admin';
import DataMock from './api/dataMock';
import ServerAdmin from './api/serverAdmin';
import ServerMock, { SSO_SECRET_KEY } from './api/serverMock';
import * as ConfigEditor from './common/config/configEditor';
import Templater, { createTemplateV2OptionsDefault } from './common/config/configTemplater';
import windowIso from './common/windowIso';

export async function mock(slug: string = 'product'): Promise<VersionedConfigAdmin> {
  const editor = new ConfigEditor.EditorImpl(ServerAdmin.get().isSuperAdminLoggedIn());
  editor.getProperty<ConfigEditor.StringProperty>(['slug']).set(slug);
  const templater = Templater.get(editor);
  const isGreatProduct = slug === 'greatproduct';
  const templateResult = await templater.createTemplateV2({
    ...createTemplateV2OptionsDefault,
    // templateFeedbackIsClassic: true,
    infoName: isGreatProduct ? 'GreatProduct' : 'Sandbox',
    infoLogo: isGreatProduct ? `${windowIso.location.origin}/img/landing/GreatProductLogo.png` : 'https://clearflask.com/img/clearflask-logo.png',
    infoWebsite: `https://${windowIso.parentDomain}`,
    infoSlug: 'product',
    cookieConsent: true,
  });
  if (templateResult.roadmap) {
    templater.taggingIdeaBug(templateResult.roadmap.categoryAndIndex.index);
    templater.taggingOsPlatform(templateResult.roadmap.categoryAndIndex.index);
  }
  templater.usersOnboardingAnonymous(true, true);
  templater.usersOnboardingBrowserPush(true);
  templater.usersOnboardingSso(true, SSO_SECRET_KEY, `${windowIso.location.protocol}//${windowIso.location.host.substr(windowIso.location.host.indexOf('.') + 1)}/login?cfr=<return_uri>`, 'Existing customer');
  templater.usersOnboardingOAuthAddBathtub();

  await DataMock.getOrMockAccountCreate();
  const dispatcher = await ServerAdmin.get().dispatchAdmin({ ssr: true });
  const project = await dispatcher.projectCreateAdmin({
    configAdmin: editor.getConfig(),
  });
  const config = await dispatcher.configSetAdmin({
    projectId: project.projectId,
    versionLast: project.config.version,
    configAdmin: editor.getConfig(),
  });

  const dataMock = DataMock.get(project.projectId);
  const userMe = await dataMock.mockLoggedIn(1000, true);
  await dataMock.mockItems(userMe);
  await dataMock.mockNotification(userMe);
  await dataMock.mockNotification(userMe, 'Second one');
  // ServerMock.get().accountLogoutAdmin();

  if (windowIso.location.hash && windowIso.location.hash.substring(1) === 'latency') {
    ServerMock.get().setLatency(true);
  }
  return config;
}

export async function mockIdea(projectId: string, postId: string) {
  return await DataMock.get(projectId).mockFakeIdeaWithComments(postId, config => ({
    statusId: config.content.categories[0]?.workflow.statuses[3]?.statusId,
  }));
}
