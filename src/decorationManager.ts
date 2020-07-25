import * as vscode from 'vscode';

import { debounce } from './util';

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

		vscode.window.onDidChangeVisibleTextEditors(async (editors) => {
			this._updateDecorations(editors);
		}, null, this._disposables);

		// Debounce since there might be a lot of small changes during writing
		const lazyUpdate = debounce(async (editors) => this._applyDecorations(editors), 500);
		vscode.workspace.onDidChangeTextDocument(async (event) => {
			const editors = vscode.window.visibleTextEditors.filter(editor => editor.document == event.document);
			await lazyUpdate(editors);
		}, null, this._disposables);

		vscode.workspace.onDidOpenTextDocument(async (document) => {
			const editors = vscode.window.visibleTextEditors.filter(editor => editor.document == document);
			await this._applyDecorations(editors);
		}, null, this._disposables);

		vscode.workspace.onDidCloseTextDocument(async (document) => {
			const editors = vscode.window.visibleTextEditors.filter(editor => editor.document == document);
			await this._removeDecorations(editors);
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

	private async _applyDecorations(editors: vscode.TextEditor[]): Promise<void[]> {
		const promises: Promise<void>[] = [];

		for (const editor of editors) {
			if (editor != null && editor.document.languageId === 'vt100') {
				promises.push(this._decorator.apply(editor));
			}
		}

		return Promise.all(promises);
	}

	private async _removeDecorations(editors: vscode.TextEditor[]): Promise<void[]> {
		const promises: Promise<void>[] = [];

		for (const editor of editors) {
			if (editor == null) {
				continue;
			}

			promises.push(this._decorator.remove(editor));
		}

		return Promise.all(promises);
	}

	private async _updateDecorations(editors: vscode.TextEditor[]): Promise<void[]> {
		const promises: Promise<void>[] = [];

		for (const editor of editors) {
			if (editor == null) {
				continue;
			}

			if (editor.document.languageId === 'vt100') {
				promises.push(this._decorator.apply(editor));
			} else {
				promises.push(this._decorator.remove(editor));
			}
		}

		return Promise.all(promises);
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

	public async apply(editor: vscode.TextEditor): Promise<void> {
		const appliedDecorations: Map<string, vscode.Range[]> = new Map();
		for (const decorationName of this._decorations.keys()) {
			appliedDecorations.set(decorationName, []);
		}

		const progressView = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right);
		progressView.text = "Parsing file";
		progressView.show();

		await VT100Parser.parse(editor.document, async (range, context) => {
			this._applyDecoration(range, context, appliedDecorations);
		});

		progressView.hide();
		progressView.dispose();

		for (const [key, value] of appliedDecorations) {
			editor.setDecorations(this._decorations.get(key)!, value);
		}
	}

	public async remove(editor: vscode.TextEditor): Promise<void> {
		// Undecorate editor if decorated
		for (const decoration of this._decorations.values()) {
			editor.setDecorations(decoration, []);
		}
	}

	private _applyDecoration(range: vscode.Range, context: Map<string, any>, appliedDecorations: Map<string, vscode.Range[]>) {
		let foregroundColor: string;
		let backgroundColor: string;

		if (context.get('inverted') === 'yes') {
			foregroundColor = <string> context.get('background-color');
			backgroundColor = <string> context.get('foreground-color');

			if (foregroundColor === 'default') {
				foregroundColor = 'inverted';
			}
			if (backgroundColor === 'default') {
				backgroundColor = 'inverted';
			}
		} else {
			foregroundColor = <string> context.get('foreground-color');
			backgroundColor = <string> context.get('background-color');
		}

		appliedDecorations.get('background-color-' + backgroundColor)!.push(range);
		appliedDecorations.get('foreground-color-' + foregroundColor)!.push(range);

		for (const attribute of ['bold', 'dim', 'underlined', 'blink', 'inverted', 'hidden']) {
			if (context.get(attribute) === 'yes') {
				appliedDecorations.get('attribute-' + attribute)!.push(range);
			}
		}

		switch (context.get('type')) {
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
