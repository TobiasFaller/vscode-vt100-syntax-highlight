import * as vscode from 'vscode';

import { randomBytes } from 'crypto';

import { ConfigurationManager } from '../configurationManager';
import { VT100Parser } from '../vt100Parser';

export class HTMLContentProvider implements vscode.Disposable {

	private _disposables: vscode.Disposable[] = [];
	private _configuration: ConfigurationManager;

	private _styles: any;
	private _customCss: any;
	private _fontSettings: any;

	constructor(configuration: ConfigurationManager) {
		this._configuration = configuration;
		this._configuration.onReload(() => {
			this.reloadConfiguration();
		}, null, this._disposables);

		this._customCss = { };
		this._styles = new Map();

		this.reloadConfiguration();
	}

	public dispose(): void {
		for (const disposable of this._disposables) {
			disposable.dispose();
		}

		this._disposables = [];
	}

	public reloadConfiguration(): void {
		this._customCss = this._configuration.getCustomCss();

		// Convert font settings to CSS class properties
		this._fontSettings = { 'body': this._configuration.getFontSettings() };

		// Convert styles to CSS class properties
		this._styles = Object.fromEntries([... this._configuration.getSettings()]
			.map(([key, value]) => ['.' + key, value.previewStyle]));
	}

	public provideTextDocumentContent(document: vscode.TextDocument): string {
		const cssNonce = this._generateNonce();
		const jsNonce = this._generateNonce();
		const state = { uri: document.uri.toString() };

		let html = '<html>';

		// Try to add at least a little bit of security with Content-Security-Policy so that
		// the rendered file can not include arbitrary CSS code
		// JavaScript is disabled by CSP and the WebView settings
		html += '<head>';
		html += `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${jsNonce}'; style-src 'nonce-${cssNonce}'"></meta>`;
		html += '<meta name="viewport" content="width=device-width, initial-scale=1.0">';
		html += `<title>${this._getFilename(document.uri)}</title>`;
		html += `<script type="text/javascript" nonce="${jsNonce}">acquireVsCodeApi().setState(${JSON.stringify(state)});</script>`;
		html += `<style type="text/css" nonce="${cssNonce}">${this._generateCss(this._styles)}</style>`;
		html += `<style type="text/css" nonce="${cssNonce}">${this._generateCss(this._fontSettings)}</style>`;
		html += `<style type="text/css" nonce="${cssNonce}">${this._generateCss(this._customCss)}</style>`;
		html += '</head>';

		html += '<body>';
		VT100Parser.parse(document, (range, modifiers, lineEnd) => {
			// Just ignore escape sequences and don't render them
			if (modifiers.get('type') === 'escape-sequence') {
				return;
			}

			const [foregroundColor, backgroundColor] = this._getColors(modifiers);
			const classList: string[] = [];

			classList.push(modifiers.get('type')!);
			classList.push('foreground');
			classList.push(`foreground-color-${foregroundColor}`);

			for (const attribute of ['bold', 'dim', 'underlined', 'blink', 'inverted', 'hidden']) {
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

		for (const [key, value] of Object.entries(properties)) {
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

	private _getFilename(uri: vscode.Uri): string {
		const path = uri.path;
		const separatorIndex = path.lastIndexOf('/');

		if (separatorIndex !== -1) {
			return path.substr(separatorIndex + 1);
		}

		return path;
	}

}