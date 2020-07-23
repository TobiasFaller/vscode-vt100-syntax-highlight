import * as vscode from 'vscode';

import { ConfigurationManager } from './configurationManager';
import { VT100Parser } from './vt100Parser';

export class DecorationManager implements vscode.Disposable {

	private _configuration: ConfigurationManager;
	private _disposables: vscode.Disposable[] = [];
	private _decorations: Map<string, vscode.TextEditorDecorationType>;
	private _decorator: EditorDecorator;

	constructor(configuration: ConfigurationManager) {
		this._configuration = configuration;
		this._decorations = new Map();
		this._decorator = new EditorDecorator(this._decorations);

		this._registerDecorations();

		this._configuration.onReload(() => {
			this._reloadDecorations();
			this._updateDecorations(vscode.window.visibleTextEditors);
		}, null, this._disposables);

		vscode.window.onDidChangeVisibleTextEditors(editors => {
			this._updateDecorations(editors);
		}, null, this._disposables);

		// Todo: Debounce since there might be a lot of small changes during writing
		vscode.workspace.onDidChangeTextDocument(event => {
			const editors = vscode.window.visibleTextEditors.filter(editor => editor.document == event.document);
			this._updateDecorations(editors);
		}, null, this._disposables);

		vscode.workspace.onDidOpenTextDocument(document => {
			const editors = vscode.window.visibleTextEditors.filter(editor => editor.document == document);
			this._applyDecorations(editors);
		}, null, this._disposables);

		vscode.workspace.onDidCloseTextDocument(document => {
			const editors = vscode.window.visibleTextEditors.filter(editor => editor.document == document);
			this._removeDecorations(editors);
		}, null, this._disposables);

		this._applyDecorations(vscode.window.visibleTextEditors);
	}

	public dispose(): void {
		for (const disposable of this._disposables) {
			disposable.dispose();
		}
		this._disposables = [];

		for (const [_key, value] of this._decorations) {
			value.dispose();
		}
		this._decorations.clear();
	}

	private _applyDecorations(editors: vscode.TextEditor[]): void {
		for (const editor of editors) {
			if (editor != null && editor.document.languageId === 'vt100') {
				this._decorator.apply(editor);
			}
		}
	}

	private _removeDecorations(editors: vscode.TextEditor[]): void {
		for (const editor of editors) {
			if (editor == null) {
				continue;
			}

			this._decorator.remove(editor);
		}
	}

	private _updateDecorations(editors: vscode.TextEditor[]): void {
		for (const editor of editors) {
			if (editor == null) {
				continue;
			}

			if (editor.document.languageId === 'vt100') {
				this._decorator.apply(editor);
			} else {
				this._decorator.remove(editor);
			}
		}
	}

	private _registerDecorations() {
		for (const [key, value] of this._configuration.getSettings()) {
			const decoration = vscode.window.createTextEditorDecorationType(value.editorStyle);
			this._decorations.set(key, decoration);
		}
	}

	private _reloadDecorations() {
		for (const [_key, value] of this._decorations) {
			value.dispose();
		}
		this._decorations.clear();

		this._registerDecorations();
	}

}

class EditorDecorator {

	private _decorations: Map<string, vscode.TextEditorDecorationType>;

	constructor(decorations: Map<string, vscode.TextEditorDecorationType>) {
		this._decorations = decorations;
	}

	public apply(editor: vscode.TextEditor): void {
		const appliedDecorations: Map<string, vscode.Range[]> = new Map();
		for (const decorationName of this._decorations.keys()) {
			appliedDecorations.set(decorationName, []);
		}

		VT100Parser.parse(editor.document, (range, modifiers, _lineEnd) => {
			this._applyDecoration(range, modifiers, appliedDecorations);
		});

		for (const [key, value] of appliedDecorations) {
			editor.setDecorations(this._decorations.get(key)!, value);
		}
	}

	public remove(editor: vscode.TextEditor): void {
		// Undecorate editor if decorated
		for (const decoration of this._decorations.values()) {
			editor.setDecorations(decoration, []);
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

		for (const attribute of ['bold', 'dim', 'underlined', 'blink', 'inverted', 'hidden']) {
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
				break;
			default:
				break;
		}
	}

}
