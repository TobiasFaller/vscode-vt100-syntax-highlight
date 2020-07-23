import * as vscode from 'vscode';
import { promises as fs } from 'fs';

import { ConfigurationManager } from './configurationManager';
import { HTMLContentProvider } from './content/htmlContentProvider';
import { TextContentProvider } from './content/textContentProvider';

export class ExportManager implements vscode.Disposable {

	private _htmlContentProvider: HTMLContentProvider;
	private _textContentProvider: TextContentProvider;

	constructor(configuration: ConfigurationManager) {
		this._htmlContentProvider = new HTMLContentProvider(configuration);
		this._textContentProvider = new TextContentProvider(configuration);
	}

	public dispose(): void {
		this._htmlContentProvider.dispose();
		this._textContentProvider.dispose();
	}

	public async exportText(param: vscode.Uri, params: vscode.Uri[]): Promise<void> {
		if (Array.isArray(params)) {
			await this._exportAllDocuments(params,
				(uri) => uri.fsPath + '.txt',
				(document) => this._textContentProvider.provideTextDocumentContent(document));
		} else if (param && (param instanceof vscode.Uri)) {
			await this._exportAllDocuments([ param ],
				(uri) => uri.fsPath + '.txt',
				(document) => this._textContentProvider.provideTextDocumentContent(document));
		} else {
			const editor = vscode.window.activeTextEditor;
			if (editor == null || editor.document.languageId !== 'vt100') {
				return;
			}

			await this._exportDocument(editor.document, editor.document.uri.fsPath + '.txt',
				(document) => this._textContentProvider.provideTextDocumentContent(document));
		}
	}

	public async exportHtml(param: vscode.Uri, params: vscode.Uri[]): Promise<void> {
		if (Array.isArray(params)) {
			console.log(params);
			await this._exportAllDocuments(params,
				(uri) => uri.fsPath + '.html',
				(document) => this._htmlContentProvider.provideTextDocumentContent(document));
		} else if (param && (param instanceof vscode.Uri)) {
			await this._exportAllDocuments([ param ],
				(uri) => uri.fsPath + '.html',
				(document) => this._htmlContentProvider.provideTextDocumentContent(document));
		} else {
			const editor = vscode.window.activeTextEditor;
			if (editor == null || editor.document.languageId !== 'vt100') {
				return;
			}

			await this._exportDocument(editor.document, editor.document.uri.fsPath + '.html',
				(document) => this._htmlContentProvider.provideTextDocumentContent(document));
		}
	}

	private async _exportAllDocuments(uris: vscode.Uri[], pathProvider: (uri: vscode.Uri) => string,
		contentProvider: (document: vscode.TextDocument) => string): Promise<void[]> {
			const promises: Thenable<void>[] = [];

			for (const uri of uris) {
				const promise = vscode.workspace.openTextDocument(uri)
						.then((document) => this._exportDocument(document, pathProvider(uri), contentProvider));
				promises.push(promise);
			}

			return Promise.all(promises);
	}

	private async _exportDocument(document: vscode.TextDocument, path: string,
			contentProvider: (document: vscode.TextDocument) => string): Promise<void> {
		try {
			const text = contentProvider(document);
			await fs.writeFile(path, text, {});
			vscode.window.showInformationMessage('Exported document to ' + this._getFilename(path));
		} catch (error) {
			console.log(error);
			vscode.window.showErrorMessage('Could not export document to ' + this._getFilename(path));
		}
	}

	private _getFilename(path: string) {
		const separatorIndex = path.lastIndexOf('/');

		if (separatorIndex !== -1) {
			return path.substr(separatorIndex + 1);
		}

		return path;
	}


}