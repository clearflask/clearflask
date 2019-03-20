import ServerMock from "./serverMock";
import {
  Conf,
  ConfFromJSON,
  ConfIdeaGroupFromJSON,
  ConfSupportType,
  ConfIdeaStatusFromJSON,
  ConfViewPageFromJSON,
  ConfViewIdeaExplorerFromJSON,
  ConfViewIdeaListFromJSON,
  SortBy,
  ConfViewPanelFromJSON,
  ConfViewBoardFromJSON,
} from "./client";
import randomUuid from "../util/uuid";
import { ConfIdeaVisibility } from "./client/models/ConfIdeaVisibility";
import { ConfIdeaStatusNextStatusIdsFromJSON } from "./client/models/ConfIdeaStatusNextStatusIds";

// TODO examples:
// Bug bounty group
// Question and answer group
// Knowledge base
class DataMock {
  conf:Conf;

  constructor() {
    this.conf = ConfFromJSON({
      name: 'Demo App',
      logoUrl: 'https://smotana.com/static/media/logo.3aab622d.svg',
      pages: [
        ConfViewPageFromJSON({
          urlName: '',
          name: 'Roadmap',
          board: ConfViewBoardFromJSON({
            titleOpt: 'Roadmap',
            panels: [
              ConfViewIdeaListFromJSON({
                sortBy: SortBy.New,
                filterIdeaStatusIds: ['statusPlanned'],
              }),
              ConfViewIdeaListFromJSON({
                sortBy: SortBy.New,
                filterIdeaStatusIds: ['statusInProgress'],
              }),
              ConfViewIdeaListFromJSON({
                sortBy: SortBy.New,
                filterIdeaStatusIds: ['statusResolved'],
              }),
            ],
          }),
        }),
        ConfViewPageFromJSON({
          urlName: 'feature-request',
          name: 'Feature Request',
          panels: [
            ConfViewPanelFromJSON({
              titleOpt: 'Support needed',
              hideIfEmpty: true,
              ideaList: ConfViewIdeaListFromJSON({
                sortBy: SortBy.Top,
                filterIdeaGroupIds: ['idea-group-feature-request'],
                filterIdeaStatusIds: ['statusGatherFeedback'],
              }),
            }),
          ],
          explorer: ConfViewIdeaExplorerFromJSON({
            ideaList: ConfViewIdeaListFromJSON({
              sortBy: SortBy.Trending,
              filterIdeaGroupIds: ['idea-group-feature-request'],
            }),
          }),
        }),
        ConfViewPageFromJSON({
          urlName: 'bug',
          name: 'Bug',
          explorer: ConfViewIdeaExplorerFromJSON({
            ideaList: ConfViewIdeaListFromJSON({
              sortBy: SortBy.Trending,
              filterIdeaGroupIds: ['idea-group-bug']
            }),
          }),
        }),
        ConfViewPageFromJSON({
          urlName: 'security-privacy',
          name: 'Security/Privacy',
          explorer: ConfViewIdeaExplorerFromJSON({
            ideaList: ConfViewIdeaListFromJSON({
              sortBy: SortBy.Trending,
              filterIdeaGroupIds: ['idea-group-security-privacy']
            }),
          }),
        }),
      ],
      ideaGroups: [
        ConfIdeaGroupFromJSON({
          id: 'idea-group-feature-request',
          name: 'Feature Request',
          supportType: ConfSupportType.FundingOnly,
          defaultIdeaStatusId: 'statusOpen',
          defaultIdeaTagIds: undefined,
          defaultIdeaVisibility: ConfIdeaVisibility.Public,
          settableIdeaVisibility: false,
          settableIdeaTagIdsOnCreate: [], // TODO
        }),
        ConfIdeaGroupFromJSON({
          id: 'idea-group-bug',
          name: 'Bug',
          supportType: ConfSupportType.FundingOnly,
          defaultIdeaStatusId: 'statusOpen',
          defaultIdeaTagIds: undefined,
          defaultIdeaVisibility: ConfIdeaVisibility.Public,
          settableIdeaVisibility: true,
          settableIdeaTagIdsOnCreate: [], // TODO
        }),
        ConfIdeaGroupFromJSON({
          id: 'idea-group-security-privacy',
          name: 'Security/Privacy',
          supportType: ConfSupportType.FundingOnly,
          defaultIdeaStatusId: 'statusOpen',
          defaultIdeaTagIds: undefined,
          defaultIdeaVisibility: ConfIdeaVisibility.Private,
          settableIdeaVisibility: false,
          settableIdeaTagIdsOnCreate: [], // TODO
        }),
      ],
      ideaStatuses: [
        ConfIdeaStatusFromJSON({
          id: 'statusOpen',
          nextTagIds: [
            ConfIdeaStatusNextStatusIdsFromJSON({nextStatusId: 'statusClosed', transitionText: 'Close'}),
            ConfIdeaStatusNextStatusIdsFromJSON({nextStatusId: 'statusResolved', transitionText: 'Resolve'}),
            ConfIdeaStatusNextStatusIdsFromJSON({nextStatusId: 'statusGatherFeedback', transitionText: 'Gathering more feedback'}),
            ConfIdeaStatusNextStatusIdsFromJSON({nextStatusId: 'statusInProgress', transitionText: 'Start progress'}),
            ConfIdeaStatusNextStatusIdsFromJSON({nextStatusId: 'statusPlanned', transitionText: 'Added to our plan'}),
          ],
          name: 'OPEN',
          color: 'grey',
        }),
        ConfIdeaStatusFromJSON({
          id: 'statusGatherFeedback',
          nextTagIds: [
            ConfIdeaStatusNextStatusIdsFromJSON({nextStatusId: 'statusClosed', transitionText: 'Close'}),
            ConfIdeaStatusNextStatusIdsFromJSON({nextStatusId: 'statusResolved', transitionText: 'Resolve'}),
            ConfIdeaStatusNextStatusIdsFromJSON({nextStatusId: 'statusPlanned', transitionText: 'Added to our plan'}),
            ConfIdeaStatusNextStatusIdsFromJSON({nextStatusId: 'statusInProgress', transitionText: 'Start progress'}),
          ],
          name: 'GATHERING SUPPORT',
          color: 'blue',
          allowIdeaEdits: false,
        }),
        ConfIdeaStatusFromJSON({
          id: 'statusPlanned',
          nextTagIds: [
            ConfIdeaStatusNextStatusIdsFromJSON({nextStatusId: 'statusClosed', transitionText: 'Close'}),
            ConfIdeaStatusNextStatusIdsFromJSON({nextStatusId: 'statusInProgress', transitionText: 'Start progress'}),
          ],
          name: 'PLANNED',
          color: 'yellow',
          allowIdeaEdits: false,
        }),
        ConfIdeaStatusFromJSON({
          id: 'statusInProgress',
          nextTagIds: [
            ConfIdeaStatusNextStatusIdsFromJSON({nextStatusId: 'statusClosed', transitionText: 'Close'}),
            ConfIdeaStatusNextStatusIdsFromJSON({nextStatusId: 'statusResolved', transitionText: 'Resolve'}),
          ],
          name: 'IN PROGRESS',
          color: 'yellow',
          allowFunding: false,
          allowVoting: false,
          allowIdeaEdits: false,
        }),
        ConfIdeaStatusFromJSON({
          id: 'statusResolved',
          nextTagIds: [
            ConfIdeaStatusNextStatusIdsFromJSON({nextStatusId: 'statusOpen', transitionText: 'Re-open'}),
          ],
          name: 'RESOLVED',
          color: 'green',
          allowFunding: false,
          allowVoting: false,
          allowIdeaEdits: false,
        }),
        ConfIdeaStatusFromJSON({
          id: 'statusClosed',
          nextTagIds: [
            ConfIdeaStatusNextStatusIdsFromJSON({nextStatusId: 'statusOpen', transitionText: 'Re-open'}),
          ],
          name: 'CLOSED',
          color: 'red',
          allowIdeaEdits: false,
        }),
        ConfIdeaStatusFromJSON({
          id: 'statusBugOpen',
          nextTagIds: [
            ConfIdeaStatusNextStatusIdsFromJSON({nextStatusId: 'statusClosed', transitionText: 'Close'}),
            ConfIdeaStatusNextStatusIdsFromJSON({nextStatusId: 'statusResolved', transitionText: 'Resolve'}),
            ConfIdeaStatusNextStatusIdsFromJSON({nextStatusId: 'statusGatherFeedback', transitionText: 'Gathering more feedback'}),
            ConfIdeaStatusNextStatusIdsFromJSON({nextStatusId: 'statusInProgress', transitionText: 'Start progress'}),
            ConfIdeaStatusNextStatusIdsFromJSON({nextStatusId: 'statusPlanned', transitionText: 'Added to our plan'}),
          ],
          name: 'OPEN',
          color: 'grey',
        }),
        ConfIdeaStatusFromJSON({
          id: 'statusOpen',
          nextTagIds: [
            ConfIdeaStatusNextStatusIdsFromJSON({nextStatusId: 'statusClosed', transitionText: 'Close'}),
            ConfIdeaStatusNextStatusIdsFromJSON({nextStatusId: 'statusResolved', transitionText: 'Resolve'}),
            ConfIdeaStatusNextStatusIdsFromJSON({nextStatusId: 'statusGatherFeedback', transitionText: 'Gathering more feedback'}),
            ConfIdeaStatusNextStatusIdsFromJSON({nextStatusId: 'statusInProgress', transitionText: 'Start progress'}),
            ConfIdeaStatusNextStatusIdsFromJSON({nextStatusId: 'statusPlanned', transitionText: 'Added to our plan'}),
          ],
          name: 'OPEN',
          color: 'grey',
        }),
      ],
      ideaTags: undefined, // TODO
      defaultIdeaStatusId: undefined, // TODO
      settableIdeaTagIdsOnCreate: undefined, // TODO
      supportType: undefined,
      defaultIdeaTagIds: undefined,
      defaultIdeaVisibility: ConfIdeaVisibility.Public,
      settableIdeaVisibility: true,
    });
  }

  mockServerData():ServerMock {
    return new ServerMock(this.conf);
  }
}

export default DataMock;
