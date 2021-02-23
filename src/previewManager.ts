import * as vscode from 'vscode';

import { debounce } from './util';

import { ConfigurationManager } from './configurationManager';
import { HTMLContentProvider } from './content/htmlContentProvider';

export class PreviewManager implements vscode.Disposable, vscode.WebviewPanelSerializer {

	private _configuration: ConfigurationManager;
	private _contentProvider: HTMLContentProvider;

	private _previews: VT100Preview[] = [];
	private _disposables: vscode.Disposable[] = [];

	constructor(configuration: ConfigurationManager) {
		this._configuration = configuration;
		this._contentProvider = new HTMLContentProvider(configuration);

		this._configuration.onReload(() => {
			for (const preview of this._previews) {
				preview.refresh();
			}
		}, null, this._disposables);

		this._disposables.push(vscode.window.registerWebviewPanelSerializer('vt100.preview', this));
	}

	public dispose(): void {
		for (const disposable of this._disposables) {
			disposable.dispose();
		}
		this._disposables = [];

		for (const preview of this._previews) {
			preview.dispose();
		}
		this._previews = [];
	}

	public async showPreview(param: vscode.Uri, params: vscode.Uri[]): Promise<void> {
		if (Array.isArray(params)) {
			await this._previewAllDocuments(params, false);
		} else if (param && (param instanceof vscode.Uri)) {
			await this._previewAllDocuments([ param ], false);
		} else {
			const editor = vscode.window.activeTextEditor;
			if (editor == null || editor.document.languageId !== 'vt100') {
				return;
			}

			await this._previewDocument(editor.document.uri, false);
		}
	}
	
	public async showPreviewToSide(param: vscode.Uri, params: vscode.Uri[]): Promise<void> {
		if (Array.isArray(params)) {
			await this._previewAllDocuments(params, true);
		} else if (param && (param instanceof vscode.Uri)) {
			await this._previewAllDocuments([ param ], true);
		} else {
			const editor = vscode.window.activeTextEditor;
			if (editor == null || editor.document.languageId !== 'vt100') {
				return;
			}

			await this._previewDocument(editor.document.uri, true);
		}
	}

	public async toggleSynchronousScrolling(): Promise<void> {
		const configuration = vscode.workspace.getConfiguration('vt100');
		await configuration.update('synchronous-scrolling', !configuration.get('synchronous-scrolling', false), vscode.ConfigurationTarget.Global);
	}

	private async _previewAllDocuments(uris: vscode.Uri[], sideBySide: boolean): Promise<void[]> {
			return Promise.all(uris.map((uri) => this._previewDocument(uri, sideBySide)));
	}

	private async _previewDocument(uri: vscode.Uri, sideBySide: boolean): Promise<void> {
		const resourceColumn = (vscode.window.activeTextEditor && vscode.window.activeTextEditor.viewColumn) || vscode.ViewColumn.One;
		const previewColumn = sideBySide ? resourceColumn + 1 : resourceColumn;

		let preview = this._findPreview(uri, previewColumn);
		if (preview != null) {
			preview.reveal(previewColumn);
		} else {
			preview = await this._createPreview(uri, previewColumn);
		}

		preview.update(uri);
	}

	private async _createPreview(uri: vscode.Uri, previewColumn: vscode.ViewColumn): Promise<VT100Preview> {
		const newPreview: VT100Preview = await VT100Preview.create(uri, previewColumn, this._contentProvider);

		newPreview.onDispose(() => {
			const existing = this._previews.indexOf(newPreview);
			if (existing === -1) {
				return;
			}

			this._previews.splice(existing, 1);
		});

		this._previews.push(newPreview);
		return newPreview;
	}

	private async _revivePreview(panel: vscode.WebviewPanel, state: any): Promise<VT100Preview> {
		const revivedPreview: VT100Preview = await VT100Preview.revive(panel, state, this._contentProvider);

		revivedPreview.onDispose(() => {
			const existing = this._previews.indexOf(revivedPreview);
			if (existing === -1) {
				return;
			}

			this._previews.splice(existing, 1);
		});

		this._previews.push(revivedPreview);
		return revivedPreview;
	}

	private _findPreview(uri: vscode.Uri, previewColumn: vscode.ViewColumn): VT100Preview | undefined {
		return this._previews.find(preview => preview.matchesResource(uri, previewColumn));
	}

	public async deserializeWebviewPanel(panel: vscode.WebviewPanel, state: any): Promise<void> {
		await this._revivePreview(panel, state);
	}

}

class VT100Preview {

	private _contentProvider: HTMLContentProvider;
	private _editor: vscode.WebviewPanel;
	private _uri: vscode.Uri;
	private _version?: { uri: vscode.Uri, version: number };

	private _disposables: vscode.Disposable[] = [];

	private _onDisposeEmitter = new vscode.EventEmitter<void>();
	public onDispose = this._onDisposeEmitter.event;

	static async create(uri: vscode.Uri, previewColumn: vscode.ViewColumn, contentProvider: HTMLContentProvider): Promise<VT100Preview> {
		const filename = VT100Preview._getFilename(uri);
		const panel = vscode.window.createWebviewPanel('vt100.preview', `${filename} (Preview)`, previewColumn);
		const preview = new VT100Preview(uri, panel, contentProvider);
		await preview.refresh();
		return preview;
	}

	static async revive(panel: vscode.WebviewPanel, state: any, contentProvider: HTMLContentProvider): Promise<VT100Preview> {
		const uri = vscode.Uri.parse(state.uri);
		const preview = new VT100Preview(uri, panel, contentProvider);
		await preview.refresh();
		return preview;
	}

	constructor(uri: vscode.Uri, panel: vscode.WebviewPanel, contentProvider: HTMLContentProvider) {
		this._contentProvider = contentProvider;
		this._uri = uri;
		this._editor = panel;
		this._editor.webview.options = {
			enableScripts: true,
			enableCommandUris: false,
			localResourceRoots: [],
			portMapping: []
		};

		this._editor.onDidDispose(() => {
			this.dispose();
		}, null, this._disposables);

		vscode.window.onDidChangeActiveTextEditor(async (editor) => {
			if (editor && editor.document.languageId === 'vt100') {
				await this._update(editor.document.uri, true);
				await this._updateRanges(editor.visibleRanges);
			}
		}, null, this._disposables);
		vscode.workspace.onDidOpenTextDocument(async (document) => {
			if (document.languageId === 'vt100') {
				await this._update(document.uri, true);
			}
		}, null, this._disposables);

		// Debounce since there might be a lot of small changes during writing
		const lazyUpdate = debounce(async (uri) => await this._update(uri, false), 500);
		vscode.workspace.onDidChangeTextDocument(async (event) => {
			if (event.document.uri.fsPath == this._uri.fsPath) {
				await lazyUpdate(this._uri);
			}
		}, null, this._disposables);

		// Debounce as the scroll event might be repeated quite fast
		const lazyRangeUpdate = debounce(async (ranges) => await this._updateRanges(ranges), 250);
		vscode.window.onDidChangeTextEditorVisibleRanges(async (event) => {
			const editor = event.textEditor;
			if (editor && editor.document.languageId === 'vt100') {
				await lazyRangeUpdate(event.visibleRanges);
			}
		}, null, this._disposables);
	}

	public dispose(): void {
		this._onDisposeEmitter.fire();
		this._onDisposeEmitter.dispose();
		this._editor.dispose();

		for (const disposable of this._disposables) {
			disposable.dispose();
		}
		this._disposables = [];
	}

	public matchesResource(uri: vscode.Uri, previewColumn: vscode.ViewColumn): boolean {
		if (this._editor.viewColumn !== previewColumn) {
			return false;
		}

		return true;
	}

	public reveal(previewColumn: vscode.ViewColumn): void {
		this._editor.reveal(previewColumn);
	}

	public async refresh(): Promise<void> {
		await this._update(this._uri, true);
	}

	public async update(uri: vscode.Uri): Promise<void> {
		await this._update(uri, true);
	}

	private async _update(uri: vscode.Uri, force: boolean): Promise<void> {
		const document = await vscode.workspace.openTextDocument(uri);
		const version: { uri: vscode.Uri, version: number } = { uri: uri, version: document.version };
		if (!force && version === this._version) {
			return;
		}

		this._uri = uri;
		this._version = version;
		this._editor.title = `${VT100Preview._getFilename(uri)} (Preview)`;

		const state = { uri: document.uri.toString() };

		let content = '';
		await this._contentProvider.provideTextDocumentContent(document, async (data) => {
			content += data;
		}, state);

		// Check for concurrency
		if (this._uri === uri) {
			this._editor.webview.html = content;
		}
	}

	private async _updateRanges(ranges: readonly vscode.Range[]): Promise<void> {
		if (!vscode.workspace.getConfiguration('vt100').get('synchronous-scrolling', false))
		{
			return;
		}

		if (ranges.length < 1)
		{
			return;
		}

		const startLine = ranges[0].start.line;
		this._editor.webview.postMessage({
			'command': 'scroll-to',
			'line': startLine
		});
	}

	private static _getFilename(uri: vscode.Uri): string {
		const path = uri.path;
		const separatorIndex = path.lastIndexOf('/');

		if (separatorIndex !== -1) {
			return path.substr(separatorIndex + 1);
		}

		return path;
	}

}
