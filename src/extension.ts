import * as vscode from 'vscode';

import { ConfigurationManager } from './configurationManager';
import { DecorationManager } from './decorationManager';
//import { PreviewManager } from './previewManager';

export function activate(context: vscode.ExtensionContext) {
	const configuration = new ConfigurationManager();
	const decorator = new DecorationManager(configuration);
	//const preview = new PreviewManager(configuration);

	context.subscriptions.push(configuration);
	context.subscriptions.push(decorator);
	//context.subscriptions.push(preview);
	//context.subscriptions.push(vscode.commands.registerCommand('vt100.showPreview', preview.showPreview, preview));
	//context.subscriptions.push(vscode.commands.registerCommand('vt100.showPreviewToSide', preview.showPreviewToSide, preview));
}
