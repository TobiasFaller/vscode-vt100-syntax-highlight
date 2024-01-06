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
		this._contentProvider = new HTMLContentProvider(configuration);
		this._configuration = configuration;
		this._configuration.onReload(() => {
			this._previews.forEach((preview) => preview.rerender());
		}, null, this._disposables);

		this._disposables.push(vscode.window.registerWebviewPanelSerializer('vt100.preview', this));

		// Only the side by side preview needs update.
		const lazyChangeEditor = debounce(async (uri, ranges) => {
			const previews = this._previews.filter(preview => preview.isIndexIn(['<side-by-side>']));
			await Promise.all(previews.map((preview) => preview.update(uri)));

			if (vscode.workspace.getConfiguration('vt100').get('synchronous-scrolling', false)) {
				await Promise.all(previews.map((preview) => preview.updateRange(ranges)));
			}
		}, 250);
		vscode.window.onDidChangeActiveTextEditor(async (editor) => {
			if (editor?.document?.languageId === 'vt100') {
				await lazyChangeEditor(editor.document.uri, editor.visibleRanges);
			}
		}, null, this._disposables);

		// Debounce since there might be a lot of small changes during writing
		const lazyUpdateText = debounce(async (uri) => {
			const previews = this._previews.filter(preview => preview.isIndexIn(['<side-by-side>', uri.toString()]));
			await Promise.all(previews.map((preview) => preview.update(uri)));
		}, 500);
		vscode.workspace.onDidChangeTextDocument(async (event) => {
			if (event.document?.languageId === 'vt100') {
				await lazyUpdateText(event.document.uri);
			}
		}, null, this._disposables);

		// Debounce as the scroll event might be repeated quite fast
		const lazyUpdateRange = debounce(async (uri, ranges) => {
			if (vscode.workspace.getConfiguration('vt100').get('synchronous-scrolling', false)) {
				const previews = this._previews.filter(preview => preview.isIndexIn(['<side-by-side>', uri.toString()]));
				await Promise.all(previews.map((preview) => preview.updateRange(ranges)));
			}
		}, 250);
		vscode.window.onDidChangeTextEditorVisibleRanges(async (event) => {
			const editor = event.textEditor;
			if (editor.document?.languageId === 'vt100') {
				await lazyUpdateRange(editor.document.uri, editor.visibleRanges);
			}
		}, null, this._disposables);
	}

	public dispose(): void {
		this._disposables.forEach((disposable) => disposable.dispose());
		this._disposables = [];
		this._previews.forEach((preview) => preview.dispose());
		this._previews = [];
	}

	public async showPreview(param: vscode.Uri, params: vscode.Uri[]): Promise<void> {
		await this._showPreview(param, params, false);
	}

	public async showPreviewToSide(param: vscode.Uri, params: vscode.Uri[]): Promise<void> {
		await this._showPreview(param, params, true);
	}

	public async toggleSynchronousScrolling(): Promise<void> {
		const configuration = vscode.workspace.getConfiguration('vt100');
		await configuration.update('synchronous-scrolling', !configuration.get('synchronous-scrolling', false), vscode.ConfigurationTarget.Global);
	}

	public async deserializeWebviewPanel(panel: vscode.WebviewPanel, state: any): Promise<void> {
		const uri = vscode.Uri.parse(state.uri);
		const index = state.index;
		const preview = this._createPreview(panel, uri, index);
		await preview.update(uri);
	}

	private async _showPreview(param: vscode.Uri, params: vscode.Uri[], sideBySide: boolean): Promise<void> {
		const promises: Promise<void>[] = [];

		if (Array.isArray(params)) {
			params.forEach((uri) => promises.push(this._previewDocument(uri, sideBySide)));
		} else if (param && (param instanceof vscode.Uri)) {
			promises.push(this._previewDocument(param, sideBySide));
		} else {
			const editor = vscode.window.activeTextEditor;
			if (editor?.document?.languageId == 'vt100') {
				promises.push(this._previewDocument(editor.document.uri, sideBySide));
			}
		}

		await Promise.all(promises);
	}

	private async _previewDocument(uri: vscode.Uri, sideBySide: boolean): Promise<void> {
		const previewColumn = sideBySide
			? vscode.ViewColumn.Two
			: (vscode?.window?.activeTextEditor?.viewColumn || vscode.ViewColumn.One);
		const index = sideBySide ? '<side-by-side>' : uri.toString();

		let preview = this._previews.find(preview => preview.isIndexIn([index]));
		if (preview == null) {
			const panel = vscode.window.createWebviewPanel('vt100.preview', `Preview loading ...`, previewColumn);
			preview = this._createPreview(panel, uri, index);
		}
		preview.update(uri);
	}

	private _createPreview(panel: vscode.WebviewPanel, uri: vscode.Uri, index: string): VT100Preview {
		const preview = new VT100Preview(panel, this._contentProvider, uri, index);
		this._previews.push(preview);
		preview.onDispose(() => {
			const index = this._previews.indexOf(preview);
			if (index != -1) {
				this._previews.splice(index, 1);
			}
		});
		return preview;
	}

}

class VT100Preview {

	private _contentProvider: HTMLContentProvider;
	private _panel: vscode.WebviewPanel;
	private _version?: { uri: vscode.Uri, version: number };
	private _disposables: vscode.Disposable[] = [];
	private _index: any;
	private _uri: vscode.Uri;
	private _cancelSource: vscode.CancellationTokenSource | null;

	private _onDisposeEmitter = new vscode.EventEmitter<void>();
	public onDispose = this._onDisposeEmitter.event;

	constructor(panel: vscode.WebviewPanel, contentProvider: HTMLContentProvider, uri: vscode.Uri, index: any) {
		this._contentProvider = contentProvider;
		this._panel = panel;
		this._panel.webview.options = {
			enableScripts: true,
			enableCommandUris: false,
			localResourceRoots: [],
			portMapping: []
		};
		this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
		this._index = index;
		this._uri = uri;
		this._cancelSource = null;
	}

	public dispose(): void {
		this._cancelCurrentUpdate();
		this._onDisposeEmitter.fire();
		this._onDisposeEmitter.dispose();
		this._panel.dispose();
		this._disposables.forEach((disposable) => disposable.dispose());
		this._disposables = [];
	}

	public async rerender(): Promise<void> {
		this._cancelCurrentUpdate();
		this._cancelSource = new vscode.CancellationTokenSource();
		const cancelToken = this._cancelSource.token;

		this._refresh(this._uri, true, cancelToken);
	}

	public async update(uri: vscode.Uri): Promise<void> {
		this._cancelCurrentUpdate();
		this._cancelSource = new vscode.CancellationTokenSource();
		const cancelToken = this._cancelSource.token;

		this._uri = uri;
		this._refresh(uri, false, cancelToken);
	}

	public async updateRange(ranges: readonly vscode.Range[]): Promise<void> {
		if (ranges.length > 0) {
			const line = ranges[0].start.line;
			await this._panel.webview.postMessage({
				'command': 'scroll-to',
				'line': line
			});
		}
	}

	public isIndexIn(indices: any[]): boolean {
		return indices.findIndex((value, _index, _obj) => (value == this._index)) != -1;
	}

	public async _cancelCurrentUpdate(): Promise<void> {
		if (this._cancelSource != null) {
			this._cancelSource.cancel();
			this._cancelSource.dispose();
			this._cancelSource = null;
		}
	}

	private async _refresh(uri: vscode.Uri, force: boolean, cancelToken: vscode.CancellationToken | null): Promise<void> {
		if (cancelToken?.isCancellationRequested) {
			return;
		}

		const document = await vscode.workspace.openTextDocument(uri);
		const version: { uri: vscode.Uri, version: number } = { uri: uri, version: document.version };
		if (force || version === this._version) {
			return;
		}

		const options: Map<string, any> = new Map([
			['is-editor', true]
		]);
		let content = '';
		await this._contentProvider.provideTextDocumentContent(document, options, async (data) => {
			if (cancelToken?.isCancellationRequested) {
				return;
			}

			content += data;
		}, cancelToken);

		if (cancelToken?.isCancellationRequested) {
			return;
		}

		this._version = version;
		this._panel.title = this._getTitleForUri(uri);
		this._panel.webview.html = content;

		const state = { uri: uri.toString(), index: this._index?.toString() };
		await this._panel.webview.postMessage({
			'command': 'set-state',
			'state': state
		});
	}

	private _getTitleForUri(uri: vscode.Uri): string {
		const path = uri.path;
		const index = path.lastIndexOf('/');
		const name = (index != -1) ? path.substring(index + 1) : path;
		return `${name} (Preview)`;
	}

}
