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
		// eslint-disable-next-line no-control-regex
		const escapeRegex = /\x1B\[((?:[0-9]+;)*[0-9]+)m/g;

		for (let lineNumber = 0; lineNumber < document.lineCount; lineNumber++) {
			const line = document.lineAt(lineNumber);

			await callback(line.text.replace(escapeRegex, '') + '\n');
		}
	}

}