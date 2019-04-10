import * as ConfigEditor from "./configEditor";
import * as Admin from "../../api/admin";

export default class Templater {
  editor:ConfigEditor.Editor;

  constructor(editor:ConfigEditor.Editor) {
    this.editor = editor;
  }

  static get(editor:ConfigEditor.Editor):Templater {
    return new Templater(editor);
  }

  creditsCurrency() {
    this._get<ConfigEditor.NumberProperty>(['credits', 'minUnit']).set(0.01);
    this._get<ConfigEditor.NumberProperty>(['credits', 'increments']).set(0.01);
    this._get<ConfigEditor.ArrayProperty>(['credits', 'formats']).setRaw([
      Admin.CreditFormatterEntryToJSON({prefix: '$', greaterOrEqual: 1}),
      Admin.CreditFormatterEntryToJSON({prefix: '¢', multiplier: 100}),
    ]);
  }
  creditsTime() {
    this._get<ConfigEditor.NumberProperty>(['credits', 'minUnit']).set(1);
    this._get<ConfigEditor.NumberProperty>(['credits', 'increments']).set(1);
    this._get<ConfigEditor.ArrayProperty>(['credits', 'formats']).setRaw([
      Admin.CreditFormatterEntryToJSON({suffix: ' Weeks', multiplier: 0.025, greaterOrEqual: 41, insignificant: 1}),
      Admin.CreditFormatterEntryToJSON({suffix: ' Week', multiplier: 0.025, greaterOrEqual: 40, lessOrEqual: 40}),
      Admin.CreditFormatterEntryToJSON({suffix: ' Days', multiplier: 0.125, greaterOrEqual: 9, lessOrEqual: 39, insignificant: 1}),
      Admin.CreditFormatterEntryToJSON({suffix: ' Day', multiplier: 0.125, greaterOrEqual: 8, lessOrEqual: 8}),
      Admin.CreditFormatterEntryToJSON({suffix: ' Hrs', greaterOrEqual: 2}),
      Admin.CreditFormatterEntryToJSON({suffix: ' Hr', lessOrEqual: 1}),
    ]);
  }
  creditsUnitless() {
    this._get<ConfigEditor.NumberProperty>(['credits', 'minUnit']).set(1);
    this._get<ConfigEditor.NumberProperty>(['credits', 'increments']).set(1);
    this._get<ConfigEditor.ArrayProperty>(['credits', 'formats']).setRaw([
      Admin.CreditFormatterEntryToJSON({suffix: 'b', multiplier: 0.000000001, greaterOrEqual: 100000000000, insignificant: 0}),
      Admin.CreditFormatterEntryToJSON({suffix: 'b', multiplier: 0.000000001, greaterOrEqual: 10000000000, insignificant: 1}),
      Admin.CreditFormatterEntryToJSON({suffix: 'b', multiplier: 0.000000001, greaterOrEqual: 1000000000, insignificant: 2}),
      Admin.CreditFormatterEntryToJSON({suffix: 'm', multiplier: 0.000001, greaterOrEqual: 100000000, insignificant: 0}),
      Admin.CreditFormatterEntryToJSON({suffix: 'm', multiplier: 0.000001, greaterOrEqual: 10000000, insignificant: 1}),
      Admin.CreditFormatterEntryToJSON({suffix: 'm', multiplier: 0.000001, greaterOrEqual: 1000000, insignificant: 2}),
      Admin.CreditFormatterEntryToJSON({suffix: 'k', multiplier: 0.001, greaterOrEqual: 100000, insignificant: 0}),
      Admin.CreditFormatterEntryToJSON({suffix: 'k', multiplier: 0.001, greaterOrEqual: 10000, insignificant: 1}),
      Admin.CreditFormatterEntryToJSON({suffix: 'k', multiplier: 0.001, greaterOrEqual: 1000, insignificant: 2}),
      Admin.CreditFormatterEntryToJSON({lessOrEqual: 1}),
    ]);
  }
  creditsBeer() {
    this._get<ConfigEditor.NumberProperty>(['credits', 'minUnit']).set(1);
    this._get<ConfigEditor.NumberProperty>(['credits', 'increments']).set(1);
    this._get<ConfigEditor.ArrayProperty>(['credits', 'formats']).setRaw([
      Admin.CreditFormatterEntryToJSON({suffix: 'm Beers', multiplier: 0.000001, greaterOrEqual: 100000000, insignificant: 0}),
      Admin.CreditFormatterEntryToJSON({suffix: 'm Beers', multiplier: 0.000001, greaterOrEqual: 10000000, insignificant: 1}),
      Admin.CreditFormatterEntryToJSON({suffix: 'm Beers', multiplier: 0.000001, greaterOrEqual: 1000000, insignificant: 2}),
      Admin.CreditFormatterEntryToJSON({suffix: 'k Beers', multiplier: 0.001, greaterOrEqual: 100000, insignificant: 0}),
      Admin.CreditFormatterEntryToJSON({suffix: 'k Beers', multiplier: 0.001, greaterOrEqual: 10000, insignificant: 1}),
      Admin.CreditFormatterEntryToJSON({suffix: 'k Beers', multiplier: 0.001, greaterOrEqual: 1000, insignificant: 2}),
      Admin.CreditFormatterEntryToJSON({suffix: ' Beers', greaterOrEqual: 2}),
      Admin.CreditFormatterEntryToJSON({suffix: ' Beer', lessOrEqual: 1}),
    ]);
  }

  _get<T extends ConfigEditor.Setting<any, any>>(path:ConfigEditor.Path):T {
    return this.editor.get(path) as any as T;
  }
}
