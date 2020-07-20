import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
	const decorator = new Decorator();

	vscode.window.onDidChangeActiveTextEditor(editor => {
		if (editor != null && editor.document.languageId === 'vt100')
		{
			decorator.decorateEditor(editor);
		}
	}, null, context.subscriptions);

	vscode.workspace.onDidChangeTextDocument(event => {
		const editor = vscode.window.activeTextEditor;
		if (editor != null && editor.document.languageId === 'vt100'
				&& event.document == editor.document) {
			decorator.decorateEditor(editor);
		}
	}, null, context.subscriptions);

	vscode.workspace.onDidChangeConfiguration(event => {
		decorator.reloadDecorations();

		for (let editor of vscode.window.visibleTextEditors) {
			if (editor != null && editor.document.languageId === 'vt100') {
				decorator.decorateEditor(editor);
			}
		}
	}, null, context.subscriptions);

	for (let editor of vscode.window.visibleTextEditors) {
		if (editor != null && editor.document.languageId === 'vt100') {
			decorator.decorateEditor(editor);
		}
	}
}

const COLORS: string[] = [
	'default', 'inverted', 'black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'light-gray', 'dark-gray',
	'light-red', 'light-green', 'light-yellow', 'light-blue', 'light-magenta', 'light-cyan', 'white'
];
const ATTRIBUTES: string[] = [
	'bold', 'dim', 'underlined', 'blink', 'hidden'
];

class Decorator {

	decorations: Map<string, vscode.TextEditorDecorationType>;

	constructor() {
		this.decorations = new Map();

		this._registerDecorations();
	}

	private _registerDecorations() {
		const configuration = vscode.workspace.getConfiguration('vt100');

		for (let color of COLORS) {
			const name = 'foreground-color-' + color;
			const style: vscode.DecorationRenderOptions = configuration[name] || { color: this._getDefaultColor(name) };
			this.decorations.set(name, vscode.window.createTextEditorDecorationType(style));
		}

		for (let color of COLORS) {
			const name = 'background-color-' + color;
			const style: vscode.DecorationRenderOptions = configuration[name] || { backgroundColor: this._getDefaultColor(name) };
			this.decorations.set(name, vscode.window.createTextEditorDecorationType(style));
		}

		for (let attribute of ATTRIBUTES) {
			const name = 'attribute-' + attribute;
			const style: vscode.DecorationRenderOptions = configuration[name] || this._getDefaultStyle(name);
			this.decorations.set(name, vscode.window.createTextEditorDecorationType(style));
		}

		const escapeStyle: vscode.DecorationRenderOptions = configuration['escape-sequence'] || this._getDefaultStyle('escape-sequence');
		this.decorations.set('escape-sequence', vscode.window.createTextEditorDecorationType(escapeStyle));
	}

	public reloadDecorations() {
		for (let [key, value] of this.decorations) {
			value.dispose();
		}

		this.decorations.clear();
		this._registerDecorations();
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

	private _getDefaultStyle(style: string): vscode.DecorationRenderOptions {
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

	public decorateEditor(editor: vscode.TextEditor) {
		const appliedDecorations: Map<string, vscode.Range[]> = new Map();
		for (let decorationName of this.decorations.keys()) {
			appliedDecorations.set(decorationName, []);
		}

		const tokenModifiers = new Map<string, string>();
		tokenModifiers.set('foreground-color', 'default');
		tokenModifiers.set('background-color', 'default');
		tokenModifiers.set('bold', 'no');
		tokenModifiers.set('dim', 'no');
		tokenModifiers.set('underlined', 'no');
		tokenModifiers.set('blink', 'no');
		tokenModifiers.set('inverted', 'no');
		tokenModifiers.set('hidden', 'no');

		const document = editor.document;
		const lines = document.getText().split(/\r\n|\r|\n/);
		for (let i = 0; i < lines.length; i++) {
			const escapeRegex: RegExp = /\x1B\[((?:[0-9]+;)*?[0-9]+)m/g;
			const line = lines[i];

			let lastIndex = 0;
			let match;
			while ((match = escapeRegex.exec(line)) !== null) {
				// Push last result
				if (match.index - lastIndex > 0) {
					const range = new vscode.Range(i, lastIndex, i, match.index);
					this._applyDecorations(range, tokenModifiers, appliedDecorations);
				}

				this._applyParams(match[1], tokenModifiers);
	
				const range = new vscode.Range(i, match.index, i, escapeRegex.lastIndex);
				this._applyDecorations(range, tokenModifiers, appliedDecorations);
				appliedDecorations.get('escape-sequence')!.push(range);

				lastIndex = escapeRegex.lastIndex;
			}

			if (line.length - lastIndex > 0)
			{
				const range = new vscode.Range(i, lastIndex, i, line.length);
				this._applyDecorations(range, tokenModifiers, appliedDecorations);
			}
		}

		for (let [key, value] of appliedDecorations) {
			editor.setDecorations(this.decorations.get(key)!, value);
		}
	}

	private _applyDecorations(range: vscode.Range, tokenModifiers: Map<string, string>, decorations: Map<string, vscode.Range[]>) {
		let foregroundColor;
		let backgroundColor;

		if (tokenModifiers.get('inverted') === 'yes') {
			foregroundColor = tokenModifiers.get('background-color');
			backgroundColor = tokenModifiers.get('foreground-color');

			if (foregroundColor === 'default') {
				foregroundColor = 'inverted';
			}
			if (backgroundColor === 'default') {
				backgroundColor = 'inverted';
			}
		} else {
			foregroundColor = tokenModifiers.get('foreground-color');
			backgroundColor = tokenModifiers.get('background-color');
		}

		decorations.get('foreground-color-' + foregroundColor)!.push(range);
		decorations.get('background-color-' + backgroundColor)!.push(range);

		for (let attribute of ATTRIBUTES) {
			if (attribute !== 'inverted') {
				if (tokenModifiers.get(attribute) === 'yes') {
					decorations.get('attribute-' + attribute)!.push(range);
				}
			}
		}
	}

	private _applyParams(params: string, tokenModifiers: Map<string, string>): void {
		// See https://misc.flogisoft.com/bash/tip_colors_and_formatting
		const splittedParams = params.split(';');

		for (var param of splittedParams) {
			if (param === "0") {
				tokenModifiers.set('foreground-color', 'default');
				tokenModifiers.set('background-color', 'default');
				tokenModifiers.set('bold', 'no');
				tokenModifiers.set('dim', 'no');
				tokenModifiers.set('underlined', 'no');
				tokenModifiers.set('blink', 'no');
				tokenModifiers.set('inverted', 'no');
				tokenModifiers.set('hidden', 'no');

			} else if (param === "1") {
				tokenModifiers.set('bold', 'yes');
			} else if (param === "2") {
				tokenModifiers.set('dim', 'yes');
			} else if (param === "4") {
				tokenModifiers.set('underlined', 'yes');
			} else if (param === "5") {
				tokenModifiers.set('blink', 'yes');
			} else if (param === "7") {
				tokenModifiers.set('inverted', 'yes');
			} else if (param === "8") {
				tokenModifiers.set('hidden', 'yes');

			} else if (param === "21") {
				tokenModifiers.set('bold', 'no');
			} else if (param === "22") {
				tokenModifiers.set('dim', 'no');
			} else if (param === "24") {
				tokenModifiers.set('underlined', 'no');
			} else if (param === "25") {
				tokenModifiers.set('blink', 'no');
			} else if (param === "27") {
				tokenModifiers.set('inverted', 'no');
			} else if (param === "28") {
				tokenModifiers.set('hidden', 'no');

			} else if (param === "39") {
				tokenModifiers.set('foreground-color', 'default');
			} else if (param === "30") {
				tokenModifiers.set('foreground-color', 'black');
			} else if (param === "31") {
				tokenModifiers.set('foreground-color', 'red');
			} else if (param === "32") {
				tokenModifiers.set('foreground-color', 'green');
			} else if (param === "33") {
				tokenModifiers.set('foreground-color', 'yellow');
			} else if (param === "34") {
				tokenModifiers.set('foreground-color', 'blue');
			} else if (param === "35") {
				tokenModifiers.set('foreground-color', 'magenta');
			} else if (param === "36") {
				tokenModifiers.set('foreground-color', 'cyan');
			} else if (param === "37") {
				tokenModifiers.set('foreground-color', 'light-gray');
			} else if (param === "90") {
				tokenModifiers.set('foreground-color', 'dark-gray');
			} else if (param === "91") {
				tokenModifiers.set('foreground-color', 'light-red');
			} else if (param === "92") {
				tokenModifiers.set('foreground-color', 'light-green');
			} else if (param === "93") {
				tokenModifiers.set('foreground-color', 'light-yellow');
			} else if (param === "94") {
				tokenModifiers.set('foreground-color', 'light-blue');
			} else if (param === "95") {
				tokenModifiers.set('foreground-color', 'light-magenta');
			} else if (param === "96") {
				tokenModifiers.set('foreground-color', 'light-cyan');
			} else if (param === "97") {
				tokenModifiers.set('foreground-color', 'white');

			} else if (param === "49") {
				tokenModifiers.set('background-color', 'default');
			} else if (param === "40") {
				tokenModifiers.set('background-color', 'black');
			} else if (param === "41") {
				tokenModifiers.set('background-color', 'red');
			} else if (param === "42") {
				tokenModifiers.set('background-color', 'green');
			} else if (param === "43") {
				tokenModifiers.set('background-color', 'yellow');
			} else if (param === "44") {
				tokenModifiers.set('background-color', 'blue');
			} else if (param === "45") {
				tokenModifiers.set('background-color', 'magenta');
			} else if (param === "46") {
				tokenModifiers.set('background-color', 'cyan');
			} else if (param === "47") {
				tokenModifiers.set('background-color', 'light-gray');
			} else if (param === "100") {
				tokenModifiers.set('background-color', 'dark-gray');
			} else if (param === "101") {
				tokenModifiers.set('background-color', 'light-red');
			} else if (param === "102") {
				tokenModifiers.set('background-color', 'light-green');
			} else if (param === "103") {
				tokenModifiers.set('background-color', 'light-yellow');
			} else if (param === "104") {
				tokenModifiers.set('background-color', 'light-blue');
			} else if (param === "105") {
				tokenModifiers.set('background-color', 'light-magenta');
			} else if (param === "106") {
				tokenModifiers.set('background-color', 'light-cyan');
			} else if (param === "107") {
				tokenModifiers.set('background-color', 'white');
			}
		}
	}
}
