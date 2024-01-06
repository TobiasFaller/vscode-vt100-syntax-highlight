import * as vscode from 'vscode';

import { ConfigurationManager } from '../configurationManager';

export class TextContentProvider implements vscode.Disposable {

	constructor(_configuration: ConfigurationManager) {
		// Do nothing
	}

	public dispose(): void {
		// Do nothing
	}

	public async provideTextDocumentContent(document: vscode.TextDocument, callback: (data: string) => Promise<void>): Promise<void> {
		for (let lineNumber = 0; lineNumber < document.lineCount; lineNumber++) {
			const text = document.lineAt(lineNumber).text;

			// See http://ascii-table.com/ansi-escape-sequences-vt-100.php
			// And https://invisible-island.net/xterm/ctlseqs/ctlseqs.html
			// eslint-disable-next-line no-control-regex
			const stripped = text.replace(/\x1B\[([0-9?]*[hl]|[0-9;]*[mrHfy]|[0-9]*[ABCDgKJnqi]|[0-9;?]*[c])/g, '')
				// eslint-disable-next-line no-control-regex
				.replace(/\x1B([NODMEHc<=>FGABCDHIKJ]|[()][AB012]|#[0-9]|[0-9;]R|\/?Z|[0-9]+|O[PQRSABCDpqrstuvwxymlnM])/g, '');

			await callback(`${stripped}\n`);
		}
	}

}