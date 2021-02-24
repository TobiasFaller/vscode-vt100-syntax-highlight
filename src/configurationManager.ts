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

		editorSettings = this._applyNativeTheme(name, editorSettings, configuration, 'theme-color');
		previewSettings = this._applyNativeTheme(name, previewSettings, configuration, 'resolved-color');

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

	private _applyNativeTheme(name: string, style: any, configuration: vscode.WorkspaceConfiguration, type: string): any {
		const nativeColor = this._applyNativeColor(name, style, configuration, type);
		if (nativeColor) {
			style = {...style, ...nativeColor};
		}

		if ('dark' in style && typeof style['dark'] === 'object') {
			const nativeDarkColor = this._applyNativeColor(name, style['dark'], configuration, type);
			if (nativeDarkColor) {
				style = {...style, ...{
					'dark': nativeDarkColor
				}};
			}
		}
		if ('light' in style && typeof style['light'] === 'object') {
			const nativeLightColor = this._applyNativeColor(name, style['light'], configuration, type);
			if (nativeLightColor) {
				style = {...style, ...{
					'light': nativeLightColor
				}};
			}
		}

		return style;
	}

	private _applyNativeColor(name: string, style: any, configuration: vscode.WorkspaceConfiguration, type: string): object | null {
		const key = name.startsWith('foreground') ? 'color'
			: name.startsWith('background') ? 'background-color' : null;
		if (!key)
		{
			// Do not change configuration
			return null;
		}

		if (configuration.get('use-native-theme', false)
			|| (key in style && style[key] === 'native')) {
			// Override the color configuration on enabled native theme
			const nativeColor = this._getNativeColor(name);
			if (nativeColor)
			{
				switch (type)
				{
					case 'theme-color':
						return { [key]: new vscode.ThemeColor(nativeColor) };
					case 'resolved-color':
						return {
							[key]: `var(--vscode-${nativeColor.replace('.', '-')})`,
							[key + '-fallback']: (key in style) ? style[key] : null
						};
				}
			}
		}

		// Do not change configuration
		return null;
	}

	private _getNativeColor(name: string): string | undefined {
		switch (name)
		{
			case 'foreground-color-default':
				return 'editor.foreground';
			case 'foreground-color-inverted':
				return 'editor.background';
			case 'foreground-color-black':
				return 'terminal.ansiBlack';
			case 'foreground-color-red':
				return 'terminal.ansiRed';
			case 'foreground-color-green':
				return 'terminal.ansiGreen';
			case 'foreground-color-yellow':
				return 'terminal.ansiYellow';
			case 'foreground-color-blue':
				return 'terminal.ansiBlue';
			case 'foreground-color-magenta':
				return 'terminal.ansiMagenta';
			case 'foreground-color-cyan':
				return 'terminal.ansiCyan';
			case 'foreground-color-light-gray':
				return 'terminal.ansiWhite';
			case 'foreground-color-dark-gray':
				return 'terminal.ansiBrightBlack';
			case 'foreground-color-light-red':
				return 'terminal.ansiBrightRed';
			case 'foreground-color-light-green':
				return 'terminal.ansiBrightGreen';
			case 'foreground-color-light-yellow':
				return 'terminal.ansiBrightYellow';
			case 'foreground-color-light-blue':
				return 'terminal.ansiBrightBlue';
			case 'foreground-color-light-magenta':
				return 'terminal.ansiBrightMagenta';
			case 'foreground-color-light-cyan':
				return 'terminal.ansiBrightCyan';
			case 'foreground-color-white':
				return 'terminal.ansiBrightWhite';
			case 'background-color-default':
				return 'editor.background';
			case 'background-color-inverted':
				return 'editor.foreground';
			case 'background-color-black':
				return 'terminal.ansiBlack';
			case 'background-color-red':
				return 'terminal.ansiRed';
			case 'background-color-green':
				return 'terminal.ansiGreen';
			case 'background-color-yellow':
				return 'terminal.ansiYellow';
			case 'background-color-blue':
				return 'terminal.ansiBlue';
			case 'background-color-magenta':
				return 'terminal.ansiMagenta';
			case 'background-color-cyan':
				return 'terminal.ansiCyan';
			case 'background-color-light-gray':
				return 'terminal.ansiWhite';
			case 'background-color-dark-gray':
				return 'terminal.ansiBrightBlack';
			case 'background-color-light-red':
				return 'terminal.ansiBrightRed';
			case 'background-color-light-green':
				return 'terminal.ansiBrightGreen';
			case 'background-color-light-yellow':
				return 'terminal.ansiBrightYellow';
			case 'background-color-light-blue':
				return 'terminal.ansiBrightBlue';
			case 'background-color-light-magenta':
				return 'terminal.ansiBrightMagenta';
			case 'background-color-light-cyan':
				return 'terminal.ansiBrightCyan';
			case 'background-color-white':
				return 'terminal.ansiBrightWhite';
		}

		return undefined;
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