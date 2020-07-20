import * as vscode from 'vscode';

const legend = (function () {
	const tokenTypesLegend = [
		'vt100-text',
		'vt100-escape-sequence'
	];
	const tokenModifiersLegend = [
		'vt100-bold',
		'vt100-dim',
		'vt100-underlined',
		'vt100-blink',
		'vt100-inverted',
		'vt100-hidden',

		'vt100-foreground-default',
		'vt100-foreground-black',
		'vt100-foreground-red',
		'vt100-foreground-green',
		'vt100-foreground-yellow',
		'vt100-foreground-blue',
		'vt100-foreground-magenta',
		'vt100-foreground-cyan',
		'vt100-foreground-light-gray',
		'vt100-foreground-dark-gray',
		'vt100-foreground-light-red',
		'vt100-foreground-light-green',
		'vt100-foreground-light-yellow',
		'vt100-foreground-light-blue',
		'vt100-foreground-light-magenta',
		'vt100-foreground-light-cyan',
		'vt100-foreground-white'

		// Removed background support since the Uint32Array,
		// which is used internally to hold all token modifiers,
		// can not store more than 32 different modifiers
		// This would result in an overflow at color "light-gray"
		// 'vt100-background-default',
		// 'vt100-background-black',
		// 'vt100-background-red',
		// 'vt100-background-green',
		// 'vt100-background-yellow',
		// 'vt100-background-blue',
		// 'vt100-background-magenta',
		// 'vt100-background-cyan',
		// 'vt100-background-light-gray',
		// 'vt100-background-dark-gray',
		// 'vt100-background-light-red',
		// 'vt100-background-light-green',
		// 'vt100-background-light-yellow',
		// 'vt100-background-light-blue',
		// 'vt100-background-light-magenta',
		// 'vt100-background-light-cyan',
		// 'vt100-background-white'
	];
	return new vscode.SemanticTokensLegend(tokenTypesLegend, tokenModifiersLegend);
})();

export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(
		vscode.languages.registerDocumentSemanticTokensProvider(
			{ language: 'vt100' },
			new DocumentSemanticTokensProvider(),
			legend
		)
	);
}

class DocumentSemanticTokensProvider implements vscode.DocumentSemanticTokensProvider {
	async provideDocumentSemanticTokens(document: vscode.TextDocument, token: vscode.CancellationToken): Promise<vscode.SemanticTokens> {
		const builder = new vscode.SemanticTokensBuilder(legend);
		const tokenModifiers = new Map<string, string>();

		tokenModifiers.set('foreground-color', 'default');
		// tokenModifiers.set('background-color', 'default');
		tokenModifiers.set('bold', 'no');
		tokenModifiers.set('dim', 'no');
		tokenModifiers.set('underlined', 'no');
		tokenModifiers.set('blink', 'no');
		tokenModifiers.set('inverted', 'no');
		tokenModifiers.set('hidden', 'no');

		const lines = document.getText().split(/\r\n|\r|\n/);
		for (let i = 0; i < lines.length && !token.isCancellationRequested; i++) {
			const escapeRegex: RegExp = /\x1B\[((?:[0-9]+;)*?[0-9]+)m/g;
			const line = lines[i];

			let lastIndex = 0;
			let match;
			while ((match = escapeRegex.exec(line)) !== null) {
				// Push last result
				if (match.index - lastIndex > 0) {
					builder.push(
						new vscode.Range(i, lastIndex, i, match.index),
						'vt100-text',
						this._getTokenModifiers(tokenModifiers)
					);
				}
	
				this._applyParams(match[1], tokenModifiers);
				builder.push(
					new vscode.Range(i, match.index, i, escapeRegex.lastIndex),
					'vt100-escape-sequence',
					this._getTokenModifiers(tokenModifiers)
				);
	
				lastIndex = escapeRegex.lastIndex;
			}

			if (line.length - lastIndex > 0)
			{
				builder.push(
					new vscode.Range(i, lastIndex, i, line.length),
					'vt100-text',
					this._getTokenModifiers(tokenModifiers)
				);
			}
		}

		return builder.build();
	}


	private _getTokenModifiers(tokenModifiers: Map<string, string>): string[] {
		const foregroundColor = tokenModifiers.get('foreground-color');
		// const backgroundColor = tokenModifiers.get('background-color');

		let result: string[] = [];

		result.push('vt100-foreground-' + foregroundColor);
		// result.push('vt100-background-' + backgroundColor);

		for (let attribute of ['bold', 'dim', 'underlined', 'blink', 'inverted', 'hidden']) {
			if (tokenModifiers.get(attribute) === 'yes') {
				result.push('vt100-' + attribute);
			}
		}

		return result;
	}

	private _applyParams(params: string, tokenModifiers: Map<string, string>): void {
		// See https://misc.flogisoft.com/bash/tip_colors_and_formatting
		const splittedParams = params.split(';');

		for (var param of splittedParams) {
			if (param === "0") {
				tokenModifiers.set('foreground-color', 'default');
				// tokenModifiers.set('background-color', 'default');
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
				tokenModifiers.set('reverse', 'yes');
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
				tokenModifiers.set('reverse', 'no');
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
			}

			// } else if (param === "49") {
			// 	tokenModifiers.set('background-color', 'default');
			// } else if (param === "40") {
			// 	tokenModifiers.set('background-color', 'black');
			// } else if (param === "41") {
			// 	tokenModifiers.set('background-color', 'red');
			// } else if (param === "42") {
			// 	tokenModifiers.set('background-color', 'green');
			// } else if (param === "43") {
			// 	tokenModifiers.set('background-color', 'yellow');
			// } else if (param === "44") {
			// 	tokenModifiers.set('background-color', 'blue');
			// } else if (param === "45") {
			// 	tokenModifiers.set('background-color', 'magenta');
			// } else if (param === "46") {
			// 	tokenModifiers.set('background-color', 'cyan');
			// } else if (param === "47") {
			// 	tokenModifiers.set('background-color', 'light-gray');
			// } else if (param === "100") {
			// 	tokenModifiers.set('background-color', 'dark-gray');
			// } else if (param === "101") {
			// 	tokenModifiers.set('background-color', 'light-red');
			// } else if (param === "102") {
			// 	tokenModifiers.set('background-color', 'light-green');
			// } else if (param === "103") {
			// 	tokenModifiers.set('background-color', 'light-yellow');
			// } else if (param === "104") {
			// 	tokenModifiers.set('background-color', 'light-blue');
			// } else if (param === "105") {
			// 	tokenModifiers.set('background-color', 'light-magenta');
			// } else if (param === "106") {
			// 	tokenModifiers.set('background-color', 'light-cyan');
			// } else if (param === "107") {
			// 	tokenModifiers.set('background-color', 'white');
			// }
		}
	}
}
