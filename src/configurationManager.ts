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
	private _customCss: any;
	private _fontSettings: any;
	private _disposables: vscode.Disposable[] = [];
	
	private _onReloadEmitter = new vscode.EventEmitter<void>();
	public onReload = this._onReloadEmitter.event;

	constructor() {
		this._styles = new Map();
		this._customCss = {};

		this._reload();

		vscode.workspace.onDidChangeConfiguration((event) => {
			this._reload();
		}, null, this._disposables);
	}

	dispose(): void {
		this._onReloadEmitter.dispose();

		for (const disposable of this._disposables) {
			disposable.dispose();
		}
		this._disposables = [];
	}

	public getSettings(): IterableIterator<[string, StyleConfiguration]> {
		return this._styles.entries();
	}

	public getCustomCss(): any {
		return this._customCss;
	}

	public getFontSettings(): any {
		return this._fontSettings;
	}

	private _reload(): void {
		const configuration = vscode.workspace.getConfiguration('vt100');

		for (const color of COLORS) {
			this._loadStyle('foreground-color-' + color, configuration);
			this._loadStyle('background-color-' + color, configuration);
		}

		for (const attribute of ATTRIBUTES) {
			this._loadStyle('attribute-' + attribute, configuration);
		}

		this._loadStyle('escape-sequence', configuration);
		this._loadStyle('text', configuration);

		this._loadFontSettings(configuration);
		this._loadCustomCss(configuration);

		this._onReloadEmitter.fire();
	}

	private _loadFontSettings(configuration: vscode.WorkspaceConfiguration) {
		const editorConfiguration = vscode.workspace.getConfiguration('editor');

		const fontFamily = configuration.get('font-family')
				|| editorConfiguration.get('fontFamily')
				|| this._getFallbackFont('font-family');

		const fontSize = configuration.get('font-size')
				|| editorConfiguration.get('fontSize')
				|| this._getFallbackFont('font-size');

		const fontWeight = configuration.get('font-weight')
				|| editorConfiguration.get('fontWeight')
				|| this._getFallbackFont('font-weight');

		this._fontSettings = {
			'font-family': fontFamily,
			'font-size': fontSize + 'px',
			'font-weight': fontWeight
		};
	}

	private _loadCustomCss(configuration: vscode.WorkspaceConfiguration) {
		this._customCss = configuration['custom-css'] || this._getFallbackCss();
	}

	private _loadStyle(name: string, configuration: vscode.WorkspaceConfiguration) {
		const settings = configuration[name];

		let editorSettings: any;
		let previewSettings: any;

		if (settings == null || typeof settings !== 'object') {
			// Settings are invalid
			editorSettings = this._getFallbackStyle(name);
			previewSettings = editorSettings;
		} else {
			const editorSettingsExist = 'editor' in settings;
			const previewSettingsExist = 'preview' in settings;

			if (!editorSettingsExist && !previewSettingsExist) {
				// Neither the editor nor the preview settings exists
				// Use the same style for both views
				editorSettings = settings;
				previewSettings = editorSettings;
			} else {
				if (editorSettingsExist && typeof settings['editor'] === 'object') {
					editorSettings = settings['editor'];
				} else {
					editorSettings = this._getFallbackStyle(name);
				}

				if (previewSettingsExist && typeof settings['preview'] === 'object') {
					previewSettings = settings['preview'];
				} else {
					previewSettings = this._getFallbackStyle(name);
				}
			}
		}

		this._styles.set(name, new StyleConfiguration(
			this._convertCssToEditorRenderOptions(editorSettings), previewSettings));
	}

	private _convertCssToEditorRenderOptions(style: any): vscode.DecorationRenderOptions {
		const properties: [string, string][] = [];

		for (const [key, value] of Object.entries(style)) {
			if (value != null) {
				properties.push([this._convertCssToRenderOptionKey(key), <string> value]);
			}
		}

		return Object.fromEntries(properties);
	}

	private _convertCssToRenderOptionKey(key: string): string {
		return key.replace(/-[A-Za-z]/g, (letter) => letter.substr(1).toUpperCase());
	}

	private _getFallbackStyle(style: string): any {
		switch(style) {
			case 'foreground-color-default':
				return { 'color': '#FFFFFF' };
			case 'foreground-color-inverted':
				return { 'color': '#000000' };
			case 'foreground-color-black':
				return { 'color': '#555555' };
			case 'foreground-color-red':
				return { 'color': '#FF0000' };
			case 'foreground-color-green':
				return { 'color': '#00FF00' };
			case 'foreground-color-yellow':
				return { 'color': '#FFFF00' };
			case 'foreground-color-blue':
				return { 'color': '#0000FF' };
			case 'foreground-color-magenta':
				return { 'color': '#FF00FF' };
			case 'foreground-color-cyan':
				return { 'color': '#00FFFF' };
			case 'foreground-color-light-gray':
				return { 'color': '#BBBBBB' };
			case 'foreground-color-dark-gray':
				return { 'color': '#777777' };
			case 'foreground-color-light-red':
				return { 'color': '#FF7777' };
			case 'foreground-color-light-green':
				return { 'color': '#77FF77' };
			case 'foreground-color-light-yellow':
				return { 'color': '#FFFF77' };
			case 'foreground-color-light-blue':
				return { 'color': '#7777FF' };
			case 'foreground-color-light-magenta':
				return { 'color': '#FF77FF' };
			case 'foreground-color-light-cyan':
				return { 'color': '#77FFFF' };
			case 'foreground-color-white':
				return { 'color': '#FFFFFF' };

			case 'background-color-default':
				return { 'background-color': '#00000000' };
			case 'background-color-inverted':
				return { 'background-color': '#FFFFFF00' };
			case 'background-color-black':
				return { 'background-color': '#000000' };
			case 'background-color-red':
				return { 'background-color': '#770000' };
			case 'background-color-green':
				return { 'background-color': '#007700' };
			case 'background-color-yellow':
				return { 'background-color': '#777700' };
			case 'background-color-blue':
				return { 'background-color': '#000077' };
			case 'background-color-magenta':
				return { 'background-color': '#770077' };
			case 'background-color-cyan':
				return { 'background-color': '#007777' };
			case 'background-color-light-gray':
				return { 'background-color': '#666666' };
			case 'background-color-dark-gray':
				return { 'background-color': '#222222' };
			case 'background-color-light-red':
				return { 'background-color': '#773333' };
			case 'background-color-light-green':
				return { 'background-color': '#337733' };
			case 'background-color-light-yellow':
				return { 'background-color': '#777733' };
			case 'background-color-light-blue':
				return { 'background-color': '#333377' };
			case 'background-color-light-magenta':
				return { 'background-color': '#773377' };
			case 'background-color-light-cyan':
				return { 'background-color': '#337777' };
			case 'background-color-white':
				return { 'background-color': '#AAAAAA' };

			case 'attribute-bold':
				return { 'font-weight': 'bold' };
			case 'attribute-dim':
				return { 'opacity': '0.7', 'font-weight': 'lighter' };
			case 'attribute-underlined':
				return { 'text-decoration': 'underline solid' };
			case 'attribute-blink':
				return { 'border': '1px dotted #FFFFFF77' };
			case 'attribute-inverted':
				return { };
			case 'attribute-hidden':
				return { 'opacity': '0.3' };

			case 'text':
				return { };
			case 'escape-sequence':
				return { };

			default:
				return { };
		}
	}

	private _getFallbackCss(): any {
		return {
			'*': {
				'padding': '0px',
				'margin': '0px'
			},
			'.bg': {
				'display': 'inline-block',
				'padding': '0.1em'
			},
			'@keyframes blink-animation': {
				'50%': {
					'opacity': '0.0'
				}
			}
		};
	}

	private _getFallbackFont(property: string): any {
		switch(property) {
			case'font-family':
				return '\'Lucida Console\', monospace';
			case 'font-size':
				return 15;
			case 'font-weight':
				return 'normal';

			default:
				return '';
		}
	}

}