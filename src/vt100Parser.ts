import * as vscode from 'vscode';

export class VT100Parser {

	public static async parse(document: vscode.TextDocument, callback: (range: vscode.Range, context: Map<string, any>) => Promise<void>): Promise<void> {
		const context = new Map<string, any>();

		// Initialize defaults
		context.set('foreground-color', 'default');
		context.set('background-color', 'default');
		context.set('bold', 'no');
		context.set('dim', 'no');
		context.set('underlined', 'no');
		context.set('blink', 'no');
		context.set('inverted', 'no');
		context.set('hidden', 'no');

		// eslint-disable-next-line no-control-regex
		const escapeRegex = /\x1B\[((?:[0-9]+;)*[0-9]+)?m/g;

		const lines = document.getText().split(/\r\n|\r|\n/);
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];

			context.set('line-number', i);
			context.set('line-end', 'no');

			escapeRegex.lastIndex = 0;
			let lastIndex = 0;
			let match;
			while ((match = escapeRegex.exec(line)) !== null) {
				// Push last result
				if (match.index - lastIndex > 0) {
					context.set('type', 'text');
					await callback(new vscode.Range(i, lastIndex, i, match.index), context);
				}

				this._applyParams(match[1], context);
				context.set('type', 'escape-sequence');
				await callback(new vscode.Range(i, match.index, i, escapeRegex.lastIndex), context);

				lastIndex = escapeRegex.lastIndex;
			}

			context.set('type', 'text');
			context.set('line-end', 'yes');
			await callback(new vscode.Range(i, lastIndex, i, line.length), context);
		}
	}

    private static _getParams(params: string): string[] {
		// ESC[m is eqivalent to ESC[0m
		if (typeof(params) == 'undefined') {
			return ['0'];
		}

		return params.split(';');
	}

	private static _applyParams(params: string, context: Map<string, string>): void {
		const splittedParams = this._getParams(params);

		// See https://misc.flogisoft.com/bash/tip_colors_and_formatting
		// And https://invisible-island.net/xterm/ctlseqs/ctlseqs.html
		for (const param of splittedParams) {
			if (param === "0") {
				context.set('foreground-color', 'default');
				context.set('background-color', 'default');
				context.set('bold', 'no');
				context.set('dim', 'no');
				context.set('underlined', 'no');
				context.set('blink', 'no');
				context.set('inverted', 'no');
				context.set('hidden', 'no');

			} else if (param === "1") {
				context.set('bold', 'yes');
			} else if (param === "2") {
				context.set('dim', 'yes');
			} else if (param === "4") {
				context.set('underlined', 'yes');
			} else if (param === "5") {
				context.set('blink', 'yes');
			} else if (param === "7") {
				context.set('inverted', 'yes');
			} else if (param === "8") {
				context.set('hidden', 'yes');

			} else if (param === "21") {
				context.set('bold', 'no');
			} else if (param === "22") {
				context.set('dim', 'no');
			} else if (param === "24") {
				context.set('underlined', 'no');
			} else if (param === "25") {
				context.set('blink', 'no');
			} else if (param === "27") {
				context.set('inverted', 'no');
			} else if (param === "28") {
				context.set('hidden', 'no');

			} else if (param === "39") {
				context.set('foreground-color', 'default');
			} else if (param === "30") {
				context.set('foreground-color', 'black');
			} else if (param === "31") {
				context.set('foreground-color', 'red');
			} else if (param === "32") {
				context.set('foreground-color', 'green');
			} else if (param === "33") {
				context.set('foreground-color', 'yellow');
			} else if (param === "34") {
				context.set('foreground-color', 'blue');
			} else if (param === "35") {
				context.set('foreground-color', 'magenta');
			} else if (param === "36") {
				context.set('foreground-color', 'cyan');
			} else if (param === "37") {
				context.set('foreground-color', 'light-gray');
			} else if (param === "90") {
				context.set('foreground-color', 'dark-gray');
			} else if (param === "91") {
				context.set('foreground-color', 'light-red');
			} else if (param === "92") {
				context.set('foreground-color', 'light-green');
			} else if (param === "93") {
				context.set('foreground-color', 'light-yellow');
			} else if (param === "94") {
				context.set('foreground-color', 'light-blue');
			} else if (param === "95") {
				context.set('foreground-color', 'light-magenta');
			} else if (param === "96") {
				context.set('foreground-color', 'light-cyan');
			} else if (param === "97") {
				context.set('foreground-color', 'white');

			} else if (param === "49") {
				context.set('background-color', 'default');
			} else if (param === "40") {
				context.set('background-color', 'black');
			} else if (param === "41") {
				context.set('background-color', 'red');
			} else if (param === "42") {
				context.set('background-color', 'green');
			} else if (param === "43") {
				context.set('background-color', 'yellow');
			} else if (param === "44") {
				context.set('background-color', 'blue');
			} else if (param === "45") {
				context.set('background-color', 'magenta');
			} else if (param === "46") {
				context.set('background-color', 'cyan');
			} else if (param === "47") {
				context.set('background-color', 'light-gray');
			} else if (param === "100") {
				context.set('background-color', 'dark-gray');
			} else if (param === "101") {
				context.set('background-color', 'light-red');
			} else if (param === "102") {
				context.set('background-color', 'light-green');
			} else if (param === "103") {
				context.set('background-color', 'light-yellow');
			} else if (param === "104") {
				context.set('background-color', 'light-blue');
			} else if (param === "105") {
				context.set('background-color', 'light-magenta');
			} else if (param === "106") {
				context.set('background-color', 'light-cyan');
			} else if (param === "107") {
				context.set('background-color', 'white');
			}
		}
	}

}