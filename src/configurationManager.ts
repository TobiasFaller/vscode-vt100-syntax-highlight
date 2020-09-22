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
	private _defaultConfiguration: Map<string, any>;
	
	private _onReloadEmitter = new vscode.EventEmitter<void>();
	public onReload = this._onReloadEmitter.event;

	constructor() {
		this._styles = new Map();
		this._customCss = {};
		this._defaultConfiguration = this._loadDefaultConfiguration();

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

	private _loadDefaultConfiguration(): Map<string, any> {
		const extension = vscode.extensions.getExtension('Tobias-Faller.vt100-syntax-highlighting');
		const packageJSON = extension?.packageJSON;
		const packageConfiguration = packageJSON?.contributes?.configuration;

		if (!Array.isArray(packageConfiguration)) {
			return new Map();
		}

		const configuration: Map<string, any> = new Map();

		const defaultConfiguration =  packageConfiguration[0]?.properties;
		for (const [key, value] of Object.entries(defaultConfiguration)) {
			if (value !== null && typeof value === 'object') {
				configuration.set(key, (<any> value)?.default);
			}
		}

		return configuration;
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
		this._customCss = configuration['custom-css'] || this._getFallbackStyle('custom-css', 'preview');
	}

	private _loadStyle(name: string, configuration: vscode.WorkspaceConfiguration) {
		const settings = configuration[name];

		let editorSettings: any;
		let previewSettings: any;

		if (settings == null || typeof settings !== 'object') {
			// Settings are invalid
			editorSettings = this._getFallbackStyle(name, 'editor');
			previewSettings = this._getFallbackStyle(name, 'preview');
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
					editorSettings = this._getFallbackStyle(name, 'editor');
				}

				if (previewSettingsExist && typeof settings['preview'] === 'object') {
					previewSettings = settings['preview'];
				} else {
					previewSettings = this._getFallbackStyle(name, 'preview');
				}
			}
		}

		const editorStyle = this._convertCssToEditorRenderOptions(name, editorSettings);
		this._styles.set(name, new StyleConfiguration(editorStyle, previewSettings));
	}

	private _convertCssToEditorRenderOptions(name: string, style: any): vscode.DecorationRenderOptions {
		const defaultStyle = this._getFallbackStyle(name, 'editor');

		let darkStyle: any = null;
		let lightStyle: any = null;

		if ('dark' in style && typeof style['dark'] === 'object') {
			darkStyle = this._convertObjectToRenderOptions(style['dark']);
		} else if (typeof style === 'object') {
			darkStyle = this._convertObjectToRenderOptions(style);
		} else if ('dark' in defaultStyle && typeof style['dark'] === 'object') {
			darkStyle = this._convertObjectToRenderOptions(defaultStyle['dark']);
		} else {
			darkStyle = this._convertObjectToRenderOptions(defaultStyle);
		}

		if ('light' in style && typeof style['light'] === 'object') {
			lightStyle = this._convertObjectToRenderOptions(style['light']);
		} else if (typeof style === 'object') {
			lightStyle = this._convertObjectToRenderOptions(style);
		} else if ('light' in defaultStyle && typeof style['light'] === 'object') {
			lightStyle = this._convertObjectToRenderOptions(defaultStyle['light']);
		} else {
			lightStyle = this._convertObjectToRenderOptions(defaultStyle);
		}

		return {
			"dark": darkStyle,
			"light": lightStyle
		};
	}

	private _convertObjectToRenderOptions(object: any): any {
		const properties: [string, string][] = [];

		for (const [key, value] of Object.entries(object)) {
			if (value != null) {
				properties.push([this._convertCssToRenderOptionKey(key), <string> value]);
			}
		}

		return Object.fromEntries(properties);
	}

	private _convertCssToRenderOptionKey(key: string): string {
		return key.replace(/-[A-Za-z]/g, (letter) => letter.substr(1).toUpperCase());
	}

	private _getFallbackStyle(style: string, type: string): any {
		const configuration = this._defaultConfiguration.get('vt100.' + style) || { };
		
		const editorSettingsExist = 'editor' in configuration;
		const previewSettingsExist = 'preview' in configuration;

		if (editorSettingsExist && type === 'editor') {
			return configuration['editor'];
		}

		if (previewSettingsExist && type === 'preview') {
			return configuration['preview'];
		}

		return configuration;
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