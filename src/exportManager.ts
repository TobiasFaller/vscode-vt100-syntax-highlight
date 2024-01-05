import * as vscode from 'vscode';
import { promises as fs } from 'fs';

import { ConfigurationManager } from './configurationManager';
import { HTMLContentProvider } from './content/htmlContentProvider';
import { TextContentProvider } from './content/textContentProvider';

export class ExportManager implements vscode.Disposable {

	private _htmlContentProvider: HTMLContentProvider;
	private _textContentProvider: TextContentProvider;
	private _statusBarItem: vscode.StatusBarItem;

	constructor(configuration: ConfigurationManager) {
		this._htmlContentProvider = new HTMLContentProvider(configuration);
		this._textContentProvider = new TextContentProvider(configuration);

		this._statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
	}

	public dispose(): void {
		this._htmlContentProvider.dispose();
		this._textContentProvider.dispose();
		this._statusBarItem.dispose();
	}

	public async exportText(param: vscode.Uri, params: vscode.Uri[]): Promise<void> {
		const editor = vscode.window.activeTextEditor;
		const contentProvider: ContentProvider = (document, callback) =>
			this._textContentProvider.provideTextDocumentContent(document, callback);

		if (Array.isArray(params)) {
			await this._exportAllUris(params, { type: "text", extension: "txt" }, contentProvider);
		} else if (param && (param instanceof vscode.Uri)) {
			await this._exportAllUris([ param ], { type: "text", extension: "txt" }, contentProvider);
		} else if (editor != null && editor.document.languageId === 'vt100') {
			await this._exportDocument(editor.document, { type: "text", extension: "txt" }, contentProvider);
		}
	}

	public async exportHtml(param: vscode.Uri, params: vscode.Uri[]): Promise<void> {
		const editor = vscode.window.activeTextEditor;
		const contentProvider: ContentProvider = (document, callback) =>
			this._htmlContentProvider.provideTextDocumentContent(document, callback);

		if (Array.isArray(params)) {
			await this._exportAllUris(params, { type: "HTML", extension: "html" }, contentProvider);
		} else if (param && (param instanceof vscode.Uri)) {
			await this._exportAllUris([ param ], { type: "HTML", extension: "html" }, contentProvider);
		} else if (editor != null && editor.document.languageId === 'vt100') {
			await this._exportDocument(editor?.document, { type: "HTML", extension: "html" }, contentProvider);
		}
	}

	private async _exportAllUris(uris: vscode.Uri[], options: ExportOptions, contentProvider: ContentProvider): Promise<void> {
			for (const uri of uris) {
				await this._exportDocument(await vscode.workspace.openTextDocument(uri), options, contentProvider);
			}
	}

	private async _exportDocument(document: vscode.TextDocument, options: ExportOptions, contentProvider: ContentProvider): Promise<void> {
		const path = document.uri.fsPath + '.' + options.extension;
		const name = this._getFilename(path);

		let file: fs.FileHandle | null = null;
		try {
			file = await fs.open(path, 'w');
			if (file != null)
			{
				this._statusBarItem.text = `Exporting document to ${options.type} file ${name} ...`;
				this._statusBarItem.show();

				const fileHandle = file;
				let size = 0;
				await contentProvider(document, async (data: string) => {
					const buffer = Buffer.from(data, 'utf8');
					await fileHandle.write(buffer);

					size += buffer.byteLength;
					this._statusBarItem.text = `Exporting document to ${options.type} file ${name} (${this._getSize(size)}) ...`;
				});

				this._statusBarItem.hide();
				await vscode.window.showInformationMessage(`Exported document to ${options.type} file ${name} (${this._getSize(size)})`);
			}
		} catch (error) {
			console.error(`Could not export document to ${options.type} file ${name}.`);
			console.error(error);

			this._statusBarItem.hide();
			await vscode.window.showErrorMessage(`Could not export document to ${options.type} file ${name}`);
		} finally {
			if (file != null)
			{
				await file.close();
			}
		}
	}

	private _getFilename(path: string) {
		const separatorIndex = path.lastIndexOf('/');

		if (separatorIndex !== -1) {
			return path.substring(separatorIndex + 1);
		}

		return path;
	}

	private _getSize(size: number): string {
		const digits = 1;
		const base = 1024;
		const sizes = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'];
		const unit = (size === 0) ? 0
			: Math.min(Math.floor(Math.log(size) / Math.log(base)), sizes.length - 1);

		return `${(size / Math.pow(base, unit)).toFixed(digits)} ${sizes[unit]}`;
	}

}

type ContentProvider = (document: vscode.TextDocument, callback: (data: string) => Promise<void>) => Promise<void>;

interface ExportOptions {

	readonly type: string;
	readonly extension: string;

}
