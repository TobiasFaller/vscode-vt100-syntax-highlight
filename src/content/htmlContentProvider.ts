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
		this._styles = this._loadStyles();
	}

	private _loadStyles(): any {
		const styles: [string, any][] = [];

		for (const [key, value] of this._configuration.getSettings()) {
			const previewSettings = value.previewStyle;

			const darkSettingsExist = 'dark' in previewSettings;
			const lightSettingsExist = 'light' in previewSettings;
			const highContrastSettingsExist = 'high-contrast' in previewSettings;

			if (!darkSettingsExist && !lightSettingsExist && !highContrastSettingsExist) {
				// Neither the dark, the light nor the high-contrast settings exists
				// Use the same style for all modes
				styles.push([`.${key}`, previewSettings]);
			} else {
				if (darkSettingsExist && typeof previewSettings['dark'] === 'object') {
					styles.push([`.vscode-dark .${key}`, previewSettings['dark']]);
				} else {
					styles.push([`.vscode-dark .${key}`, {}]);
				}

				if (lightSettingsExist && typeof previewSettings['light'] === 'object') {
					styles.push([`.vscode-light .${key}`, previewSettings['light']]);
				} else {
					styles.push([`.vscode-light .${key}`, {}]);
				}

				if (highContrastSettingsExist && typeof previewSettings['high-contrast'] === 'object') {
					styles.push([`.vscode-high-contrast .${key}`, previewSettings['high-contrast']]);
				} else {
					styles.push([`.vscode-high-contrast .${key}`, {}]);
				}
			}
		}

		return Object.fromEntries(styles);
	}

	/**
	 * Converts the source text to rendered HTML code.
	 * The state parameter contains the editor state when genrating a preview
	 * for the Webview in VS Code.
	 * The state parameter is undefined, when exporting HTML to a file.
	 *
	 * @param document The document to render
	 * @param state The state information, when in preview mode
	 */
	public provideTextDocumentContent(document: vscode.TextDocument, state?: any): string {
		const cssNonce = this._generateNonce();
		const jsNonce = this._generateNonce();

		let html = '<html>';

		// Try to add at least a little bit of security with Content-Security-Policy so that
		// the rendered file can not include arbitrary CSS code
		// JavaScript is disabled by CSP and the WebView settings
		html += '<head>';
		html += `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${jsNonce}'; style-src 'nonce-${cssNonce}'"></meta>`;
		html += '<meta name="viewport" content="width=device-width, initial-scale=1.0">';
		html += `<title>${this._getFilename(document.uri)}</title>`;
		if (state != null) {
			html += `<script type="text/javascript" nonce="${jsNonce}">acquireVsCodeApi().setState(${JSON.stringify(state)});</script>`;
		}
		html += `<style type="text/css" nonce="${cssNonce}">${this._generateCss(this._styles)}</style>`;
		html += `<style type="text/css" nonce="${cssNonce}">${this._generateCss(this._fontSettings)}</style>`;
		html += `<style type="text/css" nonce="${cssNonce}">${this._generateCss(this._customCss)}</style>`;
		html += '</head>';

		if (state != null) {
			html += '<body>';
		} else {
			html += '<body class="vscode-light">';
		}
		VT100Parser.parse(document, (range, context) => {
			// Just ignore escape sequences and don't render them
			if (context.get('type') === 'escape-sequence') {
				return;
			}

			const [foregroundColor, backgroundColor] = this._getColors(context);
			const classList: string[] = [];

			classList.push(context.get('type')!);
			classList.push('foreground');
			classList.push(`foreground-color-${foregroundColor}`);

			for (const attribute of ['bold', 'dim', 'underlined', 'blink', 'inverted', 'hidden']) {
				if (context.get(attribute) === 'yes') {
					classList.push('attribute-' + attribute);
				}
			}

			html += `<span class="background background-color-${backgroundColor}">`;
			html += `<span class="${classList.join(' ')}">`;
			html += this._escapeHtml(document.getText(range));
			html += '</span></span>';

			if (context.get('line-end') == 'yes') {
				html += '<br>\n';
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

	private _getColors(context: Map<string, string>): [string, string] {
		let foregroundColor: string;
		let backgroundColor: string;

		if (context.get('inverted') === 'yes') {
			foregroundColor = context.get('background-color')!;
			backgroundColor = context.get('foreground-color')!;

			if (foregroundColor === 'default') {
				foregroundColor = 'inverted';
			}
			if (backgroundColor === 'default') {
				backgroundColor = 'inverted';
			}
		} else {
			foregroundColor = context.get('foreground-color')!;
			backgroundColor = context.get('background-color')!;
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