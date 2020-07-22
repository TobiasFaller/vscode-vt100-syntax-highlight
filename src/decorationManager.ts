import * as vscode from 'vscode';

import { ConfigurationManager } from './configurationManager';
import { VT100Parser } from './vt100Parser';

export class DecorationManager implements vscode.Disposable {

	private _configuration: ConfigurationManager;
	private _disposables: vscode.Disposable[] = [];
	private _decorations: Map<string, vscode.TextEditorDecorationType>;

	constructor(configuration: ConfigurationManager) {
		this._configuration = configuration;
		this._decorations = new Map();

		this._configuration.onReload(() => {
			this._reloadDecorations();
			this._updateTextEditors(vscode.window.visibleTextEditors);
		}, null, this._disposables);

		vscode.window.onDidChangeActiveTextEditor(editor => {
			if (editor != null) {
				this._updateTextEditors([ editor ]);
			}
		}, null, this._disposables);

		// Todo: Debounce since there might be a lot of small changes during writing
		vscode.workspace.onDidChangeTextDocument(event => {
			const editors = vscode.window.visibleTextEditors.filter(editor => editor.document == event.document);
			this._updateTextEditors(editors);
		}, null, this._disposables);

		this._registerDecorations();
		this._updateTextEditors(vscode.window.visibleTextEditors);
	}

	public dispose(): void {
		for (let disposable of this._disposables) {
			disposable.dispose();
		}
		this._disposables = [];
	}

	private _updateTextEditors(editors: vscode.TextEditor[]): void {
		for (let editor of editors) {
			if (editor != null && editor.document.languageId === 'vt100') {
				this._decorateEditor(editor);
			}
		}
	}

	private _registerDecorations() {
		for (let [key, value] of this._configuration.getSettings()) {
			const decoration = vscode.window.createTextEditorDecorationType(value.editorStyle);
			this._decorations.set(key, decoration);
		}
	}

	private _reloadDecorations() {
		for (let [key, value] of this._decorations) {
			value.dispose();
		}
		this._decorations.clear();

		this._registerDecorations();
	}

	private _decorateEditor(editor: vscode.TextEditor) {
		const decorator = new Decorator(this._decorations);
		decorator.apply(editor);
	}

}

class Decorator {

	private _parser: VT100Parser;
	private _decorations: Map<string, vscode.TextEditorDecorationType>;

	constructor(decorations: Map<string, vscode.TextEditorDecorationType>) {
		this._decorations = decorations;
		this._parser = new VT100Parser();
	}

	public apply(editor: vscode.TextEditor): void {
		const appliedDecorations: Map<string, vscode.Range[]> = new Map();
		for (let decorationName of this._decorations.keys()) {
			appliedDecorations.set(decorationName, []);
		}

		this._parser.parse(editor.document, (range, modifiers, _lineEnd) => {
			this._applyDecoration(range, modifiers, appliedDecorations);
		});

		for (let [key, value] of appliedDecorations) {
			editor.setDecorations(this._decorations.get(key)!, value);
		}
	}

	private _applyDecoration(range: vscode.Range, tokenModifiers: Map<string, string>, appliedDecorations: Map<string, vscode.Range[]>) {
		let foregroundColor;
		let backgroundColor;

		if (tokenModifiers.get('inverted') === 'yes') {
			foregroundColor = tokenModifiers.get('background-color');
			backgroundColor = tokenModifiers.get('foreground-color');

			if (foregroundColor === 'default') {
				foregroundColor = 'inverted';
			}
			if (backgroundColor === 'default') {
				backgroundColor = 'inverted';
			}
		} else {
			foregroundColor = tokenModifiers.get('foreground-color');
			backgroundColor = tokenModifiers.get('background-color');
		}

		appliedDecorations.get('background-color-' + backgroundColor)!.push(range);
		appliedDecorations.get('foreground-color-' + foregroundColor)!.push(range);

		for (let attribute of ['bold', 'dim', 'underlined', 'blink', 'inverted', 'hidden']) {
			if (tokenModifiers.get(attribute) === 'yes') {
				appliedDecorations.get('attribute-' + attribute)!.push(range);
			}
		}

		switch (tokenModifiers.get('type')) {
			case 'escape-sequence':
				appliedDecorations.get('escape-sequence')!.push(range);
				break;
			case 'text':
				appliedDecorations.get('text')!.push(range);
			default:
				break;
		}
	}

}
