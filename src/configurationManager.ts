import * as vscode from 'vscode';

export const COLORS: string[] = [
	'default', 'inverted', 'black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'light-gray', 'dark-gray',
	'light-red', 'light-green', 'light-yellow', 'light-blue', 'light-magenta', 'light-cyan', 'white'
];
export const ATTRIBUTES: string[] = [
	'bold', 'dim', 'underlined', 'blink', 'inverted', 'hidden'
];

export class StyleConfiguration {

	constructor(
		public readonly editorStyle: vscode.DecorationRenderOptions,
		public readonly previewStyle: any
	) { }

}

export class ConfigurationManager implements vscode.Disposable {

	private _styles: Map<string, StyleConfiguration>;
	private _customCss: string;
	private _disposables: vscode.Disposable[] = [];
	
	private _onReloadEmitter = new vscode.EventEmitter<void>();
	public onReload = this._onReloadEmitter.event;

	constructor() {
		this._styles = new Map();
		this._customCss = "";
		
		vscode.workspace.onDidChangeConfiguration(event => { this._reload(); }, null, this._disposables);

		this._reload();
	}

	dispose(): void {
		this._onReloadEmitter.dispose();

		for (let disposable of this._disposables) {
			disposable.dispose();
		}
		this._disposables = [];
	}

	public getSettings(): IterableIterator<[string, StyleConfiguration]> {
		return this._styles.entries();
	}

	public getCustomPreviewCss(): string {
		return this._customCss;
	}

	private _reload(): void {
		const configuration = vscode.workspace.getConfiguration('vt100');

		for (let color of COLORS) {
			this._loadStyle('foreground-color-' + color, configuration);
			this._loadStyle('background-color-' + color, configuration);
		}

		for (let attribute of ATTRIBUTES) {
			this._loadStyle('attribute-' + attribute, configuration);
		}

		this._loadStyle('escape-sequence', configuration);
		this._loadStyle('text', configuration);

		this._customCss = configuration['custom-css'] || this._getDefaultCss();
	}

	private _loadStyle(name: string, configuration: vscode.WorkspaceConfiguration) {
		const settings = configuration[name];

		let editorSettings: vscode.DecorationRenderOptions;
		let previewSettings: any;

		if (settings == null || typeof settings !== 'object') {
			editorSettings = this._getDefaultStyle(name);
			previewSettings = this._convertEditorToCssStyle(editorSettings);
		} else {
			const editorSettingsExist = settings['editor'] && typeof settings['editor'] === 'object';
			const previewSettingsExist = settings['preview'] && typeof settings['preview'] === 'object';

			if (!editorSettingsExist && !previewSettingsExist) {
				editorSettings = <vscode.DecorationRenderOptions> settings;
				previewSettings = this._convertEditorToCssStyle(editorSettings);
			} else {
				if (editorSettingsExist) {
					editorSettings = <vscode.DecorationRenderOptions> settings['editor'];
				} else {
					editorSettings = this._getDefaultStyle(name);
				}

				if (previewSettingsExist) {
					previewSettings = settings['preview'];
				} else {
					previewSettings = this._convertEditorToCssStyle(editorSettings);
				}
			}
		}

		this._styles.set(name, new StyleConfiguration(editorSettings, previewSettings));
	}

	private _convertEditorToCssStyle(style: vscode.DecorationRenderOptions): any {
		const properties: [string, string][] = [];

		for (let [key, value] of Object.entries(style)) {
			properties.push([this._convertEditorToCssKey(key), value]);
		}

		return Object.fromEntries(properties);
	}

	private _convertEditorToCssKey(key: string): string {
		return key.replace(/[A-Z]/g, (letter) => '-' + letter.toLowerCase());
	}

	private _getDefaultStyle(style: string): any {
		switch(style) {
			case 'foreground-color-default':
				return { color: '#FFFFFF' };
			case 'foreground-color-inverted':
				return { color: '#000000' };
			case 'foreground-color-black':
				return { color: '#555555' };
			case 'foreground-color-red':
				return { color: '#FF0000' };
			case 'foreground-color-green':
				return { color: '#00FF00' };
			case 'foreground-color-yellow':
				return { color: '#FFFF00' };
			case 'foreground-color-blue':
				return { color: '#0000FF' };
			case 'foreground-color-magenta':
				return { color: '#FF00FF' };
			case 'foreground-color-cyan':
				return { color: '#00FFFF' };
			case 'foreground-color-light-gray':
				return { color: '#BBBBBB' };
			case 'foreground-color-dark-gray':
				return { color: '#777777' };
			case 'foreground-color-light-red':
				return { color: '#FF7777' };
			case 'foreground-color-light-green':
				return { color: '#77FF77' };
			case 'foreground-color-light-yellow':
				return { color: '#FFFF77' };
			case 'foreground-color-light-blue':
				return { color: '#7777FF' };
			case 'foreground-color-light-magenta':
				return { color: '#FF77FF' };
			case 'foreground-color-light-cyan':
				return { color: '#77FFFF' };
			case 'foreground-color-white':
				return { color: '#FFFFFF' };

			case 'background-color-default':
				return { backgroundColor: '#00000000' };
			case 'background-color-inverted':
				return { backgroundColor: '#FFFFFF00' };
			case 'background-color-black':
				return { backgroundColor: '#000000' };
			case 'background-color-red':
				return { backgroundColor: '#770000' };
			case 'background-color-green':
				return { backgroundColor: '#007700' };
			case 'background-color-yellow':
				return { backgroundColor: '#777700' };
			case 'background-color-blue':
				return { backgroundColor: '#000077' };
			case 'background-color-magenta':
				return { backgroundColor: '#770077' };
			case 'background-color-cyan':
				return { backgroundColor: '#007777' };
			case 'background-color-light-gray':
				return { backgroundColor: '#666666' };
			case 'background-color-dark-gray':
				return { backgroundColor: '#222222' };
			case 'background-color-light-red':
				return { backgroundColor: '#773333' };
			case 'background-color-light-green':
				return { backgroundColor: '#337733' };
			case 'background-color-light-yellow':
				return { backgroundColor: '#777733' };
			case 'background-color-light-blue':
				return { backgroundColor: '#333377' };
			case 'background-color-light-magenta':
				return { backgroundColor: '#773377' };
			case 'background-color-light-cyan':
				return { backgroundColor: '#337777' };
			case 'background-color-white':
				return { backgroundColor: '#AAAAAA' };

			case 'attribute-bold':
				return { fontWeight: 'bold' };
			case 'attribute-dim':
				return { opacity: '0.7' };
			case 'attribute-underlined':
				return { textDecoration: "underline solid" };
			case 'attribute-blink':
				return { border: '1px dotted #FFFFFF77' };
			case 'attribute-inverted':
				return { };
			case 'attribute-hidden':
				return { opacity: '0.3' };

			case 'text':
				return { };
			case 'escape-sequence':
				return { };

			default:
				return { };
		}
	}

	private _getDefaultCss(): string {
		return `
			* {
				padding: 0px;
				margin: 0px;
			}

			body {
				font-family: 'Lucida Console', monospace;
				font-size: 1.15em;
			}

			background {
				padding: 0.1em;
			}

			@keyframes blink-animation {
				50% { opacity: 0.0; }
			}
			.attribute-blink {
				animation: blink-animation 1s step-start 0s infinite;
			}
		`;
	}

}