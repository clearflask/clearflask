import * as ConfigEditor from "./configEditor";
import * as Admin from "../../api/admin";
import randomUuid from "../util/uuid";

export default class Templater {
  editor:ConfigEditor.Editor;

  constructor(editor:ConfigEditor.Editor) {
    this.editor = editor;
  }

  static get(editor:ConfigEditor.Editor):Templater {
    return new Templater(editor);
  }

  workflowFeatures() {
    const closed = Admin.IdeaStatusToJSON({name: 'Closed', nextStatusIds: [], color: 'darkred', statusId: randomUuid(), disableFunding:true, disableSupport:false, disableComments:false, disableIdeaEdits:false});
    const completed = Admin.IdeaStatusToJSON({name: 'Completed', nextStatusIds: [], color: 'darkgreen', statusId: randomUuid(), disableFunding:true, disableSupport:false, disableComments:false, disableIdeaEdits:true});
    const inProgress = Admin.IdeaStatusToJSON({name: 'In progress', nextStatusIds: [closed.statusId, completed.statusId], color: 'darkblue', statusId: randomUuid(), disableFunding:true, disableSupport:false, disableComments:false, disableIdeaEdits:true});
    const planned = Admin.IdeaStatusToJSON({name: 'Planned', nextStatusIds: [closed.statusId, inProgress.statusId], color: 'blue', statusId: randomUuid(), disableFunding:false, disableSupport:false, disableComments:false, disableIdeaEdits:true});
    const funding = Admin.IdeaStatusToJSON({name: 'Funding', nextStatusIds: [closed.statusId, planned.statusId], color: 'green', statusId: randomUuid(), disableFunding:false, disableSupport:false, disableComments:false, disableIdeaEdits:true});
    const underReview = Admin.IdeaStatusToJSON({name: 'Under review', nextStatusIds: [funding.statusId, closed.statusId, planned.statusId], color: 'lightblue', statusId: randomUuid(), disableFunding:false, disableSupport:false, disableComments:false, disableIdeaEdits:false});
    this._get<ConfigEditor.PageGroup>(['workflows', 'workflow']).insert().setRaw(Admin.WorkflowToJSON({
      workflowId: randomUuid(), name: 'Features', entryStatus: underReview.statusId,
      statuses: [closed, completed, inProgress, planned, funding, underReview],
    }));
  }
  workflowBug() {
    const notReproducible = Admin.IdeaStatusToJSON({name: 'Not reproducible', nextStatusIds: [], color: 'darkred', statusId: randomUuid(), disableFunding:true, disableSupport:false, disableComments:false, disableIdeaEdits:false});
    const wontFix = Admin.IdeaStatusToJSON({name: 'Won\'t fix', nextStatusIds: [], color: 'darkred', statusId: randomUuid(), disableFunding:true, disableSupport:false, disableComments:false, disableIdeaEdits:false});
    const fixed = Admin.IdeaStatusToJSON({name: 'Fixed', nextStatusIds: [], color: 'darkgreen', statusId: randomUuid(), disableFunding:true, disableSupport:false, disableComments:false, disableIdeaEdits:true});
    const inProgress = Admin.IdeaStatusToJSON({name: 'In progress', nextStatusIds: [wontFix.statusId, notReproducible.statusId, fixed.statusId], color: 'darkblue', statusId: randomUuid(), disableFunding:true, disableSupport:false, disableComments:false, disableIdeaEdits:true});
    const underReview = Admin.IdeaStatusToJSON({name: 'Under review', nextStatusIds: [inProgress.statusId, wontFix.statusId, notReproducible.statusId], color: 'lightblue', statusId: randomUuid(), disableFunding:false, disableSupport:false, disableComments:false, disableIdeaEdits:false});
    this._get<ConfigEditor.PageGroup>(['workflows', 'workflow']).insert().setRaw(Admin.WorkflowToJSON({
      workflowId: randomUuid(), name: 'Bugs', entryStatus: underReview.statusId,
      statuses: [notReproducible, wontFix, fixed, inProgress, underReview],
    }));
  }

  creditsCurrency() {
    this._get<ConfigEditor.NumberProperty>(['credits', 'increment']).set(0.01);
    this._get<ConfigEditor.ArrayProperty>(['credits', 'formats']).setRaw([
      Admin.CreditFormatterEntryToJSON({prefix: '$', greaterOrEqual: 100, minimumFractionDigits: 0}),
      Admin.CreditFormatterEntryToJSON({prefix: '$', greaterOrEqual: 1, minimumFractionDigits: 2}),
      Admin.CreditFormatterEntryToJSON({prefix: '¢', multiplier: 100}),
    ]);
  }
  creditsTime() {
    this._get<ConfigEditor.NumberProperty>(['credits', 'increment']).set(1);
    this._get<ConfigEditor.ArrayProperty>(['credits', 'formats']).setRaw([
      Admin.CreditFormatterEntryToJSON({suffix: ' Weeks', multiplier: 0.025, greaterOrEqual: 41, maximumFractionDigits: 1}),
      Admin.CreditFormatterEntryToJSON({suffix: ' Week', multiplier: 0.025, greaterOrEqual: 40, lessOrEqual: 40}),
      Admin.CreditFormatterEntryToJSON({suffix: ' Days', multiplier: 0.125, greaterOrEqual: 9, lessOrEqual: 39, maximumFractionDigits: 1}),
      Admin.CreditFormatterEntryToJSON({suffix: ' Day', multiplier: 0.125, greaterOrEqual: 8, lessOrEqual: 8}),
      Admin.CreditFormatterEntryToJSON({suffix: ' Hrs', greaterOrEqual: 2}),
      Admin.CreditFormatterEntryToJSON({suffix: ' Hr', lessOrEqual: 1}),
    ]);
  }
  creditsUnitless() {
    this._get<ConfigEditor.NumberProperty>(['credits', 'increment']).set(1);
    this._get<ConfigEditor.ArrayProperty>(['credits', 'formats']).setRaw([
      Admin.CreditFormatterEntryToJSON({suffix: 'm', multiplier: 0.000001, greaterOrEqual: 100000000, maximumFractionDigits: 0}),
      Admin.CreditFormatterEntryToJSON({suffix: 'm', multiplier: 0.000001, greaterOrEqual: 10000000, maximumFractionDigits: 1}),
      Admin.CreditFormatterEntryToJSON({suffix: 'm', multiplier: 0.000001, greaterOrEqual: 1000000, maximumFractionDigits: 2}),
      Admin.CreditFormatterEntryToJSON({suffix: 'k', multiplier: 0.001, greaterOrEqual: 100000, maximumFractionDigits: 0}),
      Admin.CreditFormatterEntryToJSON({suffix: 'k', multiplier: 0.001, greaterOrEqual: 10000, maximumFractionDigits: 1}),
      Admin.CreditFormatterEntryToJSON({suffix: 'k', multiplier: 0.001, greaterOrEqual: 1000, maximumFractionDigits: 2}),
    ]);
  }
  creditsBeer() {
    this._get<ConfigEditor.NumberProperty>(['credits', 'increment']).set(1);
    this._get<ConfigEditor.ArrayProperty>(['credits', 'formats']).setRaw([
      Admin.CreditFormatterEntryToJSON({suffix: 'm🍺', multiplier: 0.000001, greaterOrEqual: 100000000, maximumFractionDigits: 0}),
      Admin.CreditFormatterEntryToJSON({suffix: 'm🍺', multiplier: 0.000001, greaterOrEqual: 10000000, maximumFractionDigits: 1}),
      Admin.CreditFormatterEntryToJSON({suffix: 'm🍺', multiplier: 0.000001, greaterOrEqual: 1000000, maximumFractionDigits: 2}),
      Admin.CreditFormatterEntryToJSON({suffix: 'k🍺', multiplier: 0.001, greaterOrEqual: 100000, maximumFractionDigits: 0}),
      Admin.CreditFormatterEntryToJSON({suffix: 'k🍺', multiplier: 0.001, greaterOrEqual: 10000, maximumFractionDigits: 1}),
      Admin.CreditFormatterEntryToJSON({suffix: 'k🍺', multiplier: 0.001, greaterOrEqual: 1000, maximumFractionDigits: 2}),
      Admin.CreditFormatterEntryToJSON({suffix: '🍺', lessOrEqual: 999}),
    ]);
  }

  _get<T extends ConfigEditor.Setting<any, any>>(path:ConfigEditor.Path):T {
    return this.editor.get(path) as any as T;
  }
}
