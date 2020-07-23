import * as vscode from 'vscode';

import { ConfigurationManager } from './configurationManager';
import { DecorationManager } from './decorationManager';
import { PreviewManager } from './previewManager';
import { ExportManager } from './exportManager';

export function activate(context: vscode.ExtensionContext) {
	const configuration = new ConfigurationManager();
	const decoratorManager = new DecorationManager(configuration);
	const previewManager = new PreviewManager(configuration);
	const exportManager = new ExportManager(configuration);

	context.subscriptions.push(configuration);
	context.subscriptions.push(decoratorManager);
	context.subscriptions.push(previewManager);
	context.subscriptions.push(exportManager);

	context.subscriptions.push(vscode.commands.registerCommand('vt100.showPreview', previewManager.showPreview, previewManager));
	context.subscriptions.push(vscode.commands.registerCommand('vt100.showPreviewToSide', previewManager.showPreviewToSide, previewManager));
	context.subscriptions.push(vscode.commands.registerCommand('vt100.exportText', exportManager.exportText, exportManager));
	context.subscriptions.push(vscode.commands.registerCommand('vt100.exportHtml', exportManager.exportHtml, exportManager));
}
