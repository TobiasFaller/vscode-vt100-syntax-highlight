import * as vscode from 'vscode';

import { ConfigurationManager } from '../configurationManager';

export class TextContentProvider implements vscode.Disposable {

	constructor(_configuration: ConfigurationManager) {
		// Do nothing
	}

	public dispose(): void {
		// Do nothing
	}

	public provideTextDocumentContent(document: vscode.TextDocument): string {
		// eslint-disable-next-line no-control-regex
		const escapeRegex = /\x1B\[((?:[0-9]+;)*?[0-9]+)m/g;

		return document.getText()
			.replace(escapeRegex, '');
	}

}