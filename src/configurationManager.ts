import * as vscode from 'vscode';

const COLORS: string[] = [
	'default', 'inverted', 'black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'light-gray', 'dark-gray',
	'light-red', 'light-green', 'light-yellow', 'light-blue', 'light-magenta', 'light-cyan', 'white'
];
const ATTRIBUTES: string[] = [
	'bold', 'dim', 'underlined', 'blink', 'hidden'
];

export class ConfigurationManager implements vscode.Disposable {

	private _styles: Map<string, vscode.TextEditorDecorationType>;
	private _disposables: vscode.Disposable[] = [];
	
	private _onReloadEmitter = new vscode.EventEmitter<void>();
	public onReload = this._onReloadEmitter.event;

	constructor() {
		this._styles = new Map();
		
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

	private _reload(): void {
		const configuration = vscode.workspace.getConfiguration('vt100');

		for (let color of COLORS) {
			const name = 'foreground-color-' + color;
			this._styles.set(name, configuration[name] || { color: this._getDefaultColor(name) });
		}

		for (let color of COLORS) {
			const name = 'background-color-' + color;
			this._styles.set(name, configuration[name] || { backgroundColor: this._getDefaultColor(name) });
		}

		for (let attribute of ATTRIBUTES) {
			const name = 'attribute-' + attribute;
			this._styles.set(name, configuration[name] || this._getDefaultStyle(name));
		}

		this._styles.set('escape-sequence', configuration['escape-sequence'] || this._getDefaultStyle('escape-sequence'));
	}

	public getSettings(): IterableIterator<[string, vscode.TextEditorDecorationType]> {
		return this._styles.entries();
	}

	private _getDefaultColor(name: string): string {
		switch(name) {
			case 'foreground-color-default':
				return '#FFFFFF';
			case 'foreground-color-inverted':
				return '#000000';
			case 'foreground-color-black':
				return '#555555';
			case 'foreground-color-red':
				return '#FF0000';
			case 'foreground-color-green':
				return '#00FF00';
			case 'foreground-color-yellow':
				return '#FFFF00';
			case 'foreground-color-blue':
				return '#0000FF';
			case 'foreground-color-magenta':
				return '#FF00FF';
			case 'foreground-color-cyan':
				return '#00FFFF';
			case 'foreground-color-light-gray':
				return '#BBBBBB';
			case 'foreground-color-dark-gray':
				return '#777777';
			case 'foreground-color-light-red':
				return '#FF7777';
			case 'foreground-color-light-green':
				return '#77FF77';
			case 'foreground-color-light-yellow':
				return '#FFFF77';
			case 'foreground-color-light-blue':
				return '#7777FF';
			case 'foreground-color-light-magenta':
				return '#FF77FF';
			case 'foreground-color-light-cyan':
				return '#77FFFF';
			case 'foreground-color-white':
				return '#FFFFFF';

			case 'background-color-default':
				return '#000000';
			case 'background-color-inverted':
				return '#FFFFFF';
			case 'background-color-black':
				return '#000000';
			case 'background-color-red':
				return '#770000';
			case 'background-color-green':
				return '#007700';
			case 'background-color-yellow':
				return '#777700';
			case 'background-color-blue':
				return '#000077';
			case 'background-color-magenta':
				return '#770077';
			case 'background-color-cyan':
				return '#007777';
			case 'background-color-light-gray':
				return '#666666';
			case 'background-color-dark-gray':
				return '#222222';
			case 'background-color-light-red':
				return '#773333';
			case 'background-color-light-green':
				return '#337733';
			case 'background-color-light-yellow':
				return '#777733';
			case 'background-color-light-blue':
				return '#333377';
			case 'background-color-light-magenta':
				return '#773377';
			case 'background-color-light-cyan':
				return '#337777';
			case 'background-color-white':
				return '#AAAAAA';

			default:
				return '#FFFFFF';
		}
	}

	private _getDefaultStyle(style: string): any {
		switch(style) {
			case 'attribute-bold':
				return { fontWeight: 'bold' };
			case 'attribute-dim':
				return { opacity: '0.7' };
			case 'attribute-underlined':
				return { textDecoration: "underline solid" };
			case 'attribute-blink':
				return { border: '1px dotted #FFFFFF77' };
			case 'attribute-hidden':
				return { opacity: '0.3' };

			case 'escape-sequence':
				return { };

			default:
				return { };
		}
	}

}