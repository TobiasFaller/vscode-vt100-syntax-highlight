import * as vscode from 'vscode';

import { randomBytes } from 'crypto';

import { ConfigurationManager } from './configurationManager';
import { VT100Parser } from './vt100Parser';

export class PreviewManager implements vscode.Disposable, vscode.WebviewPanelSerializer {

	private _configuration: ConfigurationManager;
	private _contentProvider: VT100ContentProvider;

	private _previews: VT100Preview[] = [];
	private _disposables: vscode.Disposable[] = [];

	constructor(configuration: ConfigurationManager) {
		this._configuration = configuration;
		this._contentProvider = new VT100ContentProvider(configuration);

		this._configuration.onReload(() => {
			this._contentProvider.reloadConfiguration();
			for (let preview of this._previews) {
				preview.refresh();
			}
		}, null, this._disposables);

		this._disposables.push(vscode.window.registerWebviewPanelSerializer('vt100.preview', this));
	}

	public dispose(): void {
		for (let disposable of this._disposables) {
			disposable.dispose();
		}
		this._disposables = [];

		for (let preview of this._previews) {
			preview.dispose();
		}
		this._previews = [];
	}

	public showPreview(): void {
		this._showPreviewImpl(false);
	}
	
	public showPreviewToSide(): void {
		this._showPreviewImpl(true);
	}

	private async _showPreviewImpl(sideBySide: boolean): Promise<void> {
		const uri = vscode.window.activeTextEditor?.document?.uri;
		if (!(uri instanceof vscode.Uri)) {
			return;
		}

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

	private _contentProvider: VT100ContentProvider;
	private _editor: vscode.WebviewPanel;
	private _uri: vscode.Uri;
	private _version?: { uri: vscode.Uri, version: number };

	private _disposables: vscode.Disposable[] = [];

	private _onDisposeEmitter = new vscode.EventEmitter<void>();
	public onDispose = this._onDisposeEmitter.event;

	private _onDidChangeViewStateEmitter = new vscode.EventEmitter<vscode.WebviewPanelOnDidChangeViewStateEvent>();
	public onDidChangeViewState = this._onDidChangeViewStateEmitter.event;

	static async create(uri: vscode.Uri, previewColumn: vscode.ViewColumn, contentProvider: VT100ContentProvider): Promise<VT100Preview> {
		const panel = vscode.window.createWebviewPanel('vt100.preview', 'VT100 Preview', previewColumn);
		const preview = new VT100Preview(uri, panel, contentProvider);
		await preview.refresh();
		return preview;
	}

	static async revive(panel: vscode.WebviewPanel, state: any, contentProvider: VT100ContentProvider): Promise<VT100Preview> {
		const uri = vscode.Uri.parse(state.uri);
		const preview = new VT100Preview(uri, panel, contentProvider);
		await preview.refresh();
		return preview;
	}

	constructor(uri: vscode.Uri, panel: vscode.WebviewPanel, contentProvider: VT100ContentProvider) {
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

		this._editor.onDidChangeViewState(e => {
			this._onDidChangeViewStateEmitter.fire(e);
		}, null, this._disposables);

		// Todo: Debounce
		vscode.workspace.onDidChangeTextDocument(event => {
			if (event.document.uri.fsPath == this._uri.fsPath) {
				this._update(this._uri, false);
			}
		}, null, this._disposables);
	
		vscode.window.onDidChangeActiveTextEditor(editor => {
			if (editor && editor.document.languageId === 'vt100') {
				this._update(editor.document.uri, false);
			}
		}, null, this._disposables);
	}

	dispose() {
		this._onDisposeEmitter.fire();

		this._onDisposeEmitter.dispose();
		this._onDidChangeViewStateEmitter.dispose();
		this._editor.dispose();

		for (let disposable of this._disposables) {
			disposable.dispose();
		}
		this._disposables = [];
	}

	public matchesResource(uri: vscode.Uri, previewColumn: vscode.ViewColumn): boolean {
		if (this._editor.viewColumn !== previewColumn) {
			return false;
		}

		// Currently there is no support for locked views
		// this._uri.fsPath === uri.fsPath
		return true;
	}

	public reveal(previewColumn: vscode.ViewColumn) {
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

		const state = { uri: this._uri.toString() };
		const content: string = this._contentProvider.provideTextDocumentContent(document, state);

		// Check for concurrency
		if (this._uri === uri) {
			this._editor.webview.html = content;
		}
	}
}

class VT100ContentProvider {

	private _configuration: ConfigurationManager;

	private _styles: any;
	private _customCss: any;
	private _fontSettings: any;

	constructor(configuration: ConfigurationManager) {
		this._configuration = configuration;

		this._customCss = { };
		this._styles = new Map();

		this.reloadConfiguration();
	}

	public reloadConfiguration(): void {
		this._customCss = this._configuration.getCustomCss();

		// Convert font settings to CSS class properties
		this._fontSettings = { 'body': this._configuration.getFontSettings() };

		// Convert styles to CSS class properties
		this._styles = Object.fromEntries([... this._configuration.getSettings()]
			.map(([key, value]) => ['.' + key, value.previewStyle]));
	}

	public provideTextDocumentContent(document: vscode.TextDocument, state: any): string {
		const parser = new VT100Parser();
		const cssNonce = this._generateNonce();
		const jsNonce = this._generateNonce();

		let html = '<html>';

		// Try to add at least a little bit of security with Content-Security-Policy so that
		// the rendered file can not include arbitrary CSS code
		// JavaScript is disabled by CSP and the WebView settings
		html += '<head>';

		html += `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${jsNonce}'; style-src 'nonce-${cssNonce}'"></meta>`;
		html += '<meta name="viewport" content="width=device-width, initial-scale=1.0">';
		html += `<script type="text/javascript" nonce="${jsNonce}">acquireVsCodeApi().setState(${JSON.stringify(state)});</script>`;
		html += `<style type="text/css" nonce="${cssNonce}">${this._generateCss(this._styles)}</style>`;
		html += `<style type="text/css" nonce="${cssNonce}">${this._generateCss(this._fontSettings)}</style>`;
		html += `<style type="text/css" nonce="${cssNonce}">${this._generateCss(this._customCss)}</style>`;
		html += '</head>';

		html += '<body>';
		parser.parse(document, (range, modifiers, lineEnd) => {
			// Just ignore escape sequences and don't render them
			if (modifiers.get('type') === 'escape-sequence') {
				return;
			}

			const [foregroundColor, backgroundColor] = this._getColors(modifiers);
			const classList: string[] = [];

			classList.push(modifiers.get('type')!);
			classList.push('foreground');
			classList.push(`foreground-color-${foregroundColor}`);

			for (let attribute of ['bold', 'dim', 'underlined', 'blink', 'inverted', 'hidden']) {
				if (modifiers.get(attribute) === 'yes') {
					classList.push('attribute-' + attribute);
				}
			}

			html += `<span class="background background-color-${backgroundColor}">`;
			html += `<span class="${classList.join(' ')}">`;
			html += this._escapeHtml(document.getText(range));
			html += '</span></span>';

			if (lineEnd) {
				html += '<br>';
			}
		});
		html += '</body>';
		html += '</html>';
		return html;
	}

	private _generateNonce(): string {
		const buffer: Buffer = randomBytes(64);
		return buffer.toString('base64');
	}

	private _getColors(modifiers: Map<string, string>): [string, string] {
		let foregroundColor: string;
		let backgroundColor: string;

		if (modifiers.get('inverted') === 'yes') {
			foregroundColor = modifiers.get('background-color')!;
			backgroundColor = modifiers.get('foreground-color')!;

			if (foregroundColor === 'default') {
				foregroundColor = 'inverted';
			}
			if (backgroundColor === 'default') {
				backgroundColor = 'inverted';
			}
		} else {
			foregroundColor = modifiers.get('foreground-color')!;
			backgroundColor = modifiers.get('background-color')!;
		}

		return [foregroundColor, backgroundColor];
	}

	private _generateCss(properties: any): string {
		let css = '';

		for (let [key, value] of Object.entries(properties)) {
			if (value == null) {
				continue;
			}

			if (typeof value === 'object') {
				css += `${key} {\n`;
				css += this._generateCss(value);
				css += `}\n`;
			} else if (typeof value === 'string') {
				css += `${key}: ${value};\n`;
			}
		}

		return css;
	}

	private _escapeHtml(value: string): string {
		return value
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;")
			.replace(/'/g, "&#039;")
			.replace(/ /g, '&nbsp;');
	}

}