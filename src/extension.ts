'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
//import { CompareTreeDataProvider } from './providers/compareTree';
import { FtpTreeDataProvider } from './providers/compareTree';
import { editConfig, getAllProfiles } from './modules/config';
import { ProfileNode } from './nodes/profileNode';
import { ITreeNode } from './nodes/iTreeNode';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    console.log('Congratulations, your extension "kirby-ftp" is now active!');

    const compareViewProvider = new FtpTreeDataProvider();
    vscode.window.registerTreeDataProvider('compareView', compareViewProvider);
    vscode.commands.registerCommand('compareView.refreshEntry', () => compareViewProvider.refresh());
    vscode.commands.registerCommand("kirby.openConfig", () => {
        editConfig();

    } );
    vscode.commands.registerCommand('kirby.uploadFile', (node: ITreeNode) => {
		// vscode.workspace.openTextDocument(node.resource).then(document => {
		// 	vscode.window.showTextDocument(document);
        // });
       // vscode.window.showInformationMessage("todo: Upload file ");
       try {
            node.upload();
       } catch (err)  {
           vscode.window.showErrorMessage(err);
       }

        
    });
   
    vscode.commands.registerCommand('kirby.openFile', (node: ITreeNode) => {
        vscode.window.setStatusBarMessage("Kirby FTP: Opening diff window");
       node.openDiff(); 
       
        
    });
   
    
    getAllProfiles().then((profiles):Promise<void> => {
        compareViewProvider.loadSettingsProfiles(profiles);
        return Promise.resolve();
    }).catch(error => {
        vscode.window.showErrorMessage(error);
    });

    var promise1:Promise<void> = new Promise(function(resolve, reject) {
        throw 'Uh-oh!';
      });
      
      promise1.catch(function(error) {
        console.log(error);
      });

    // vscode.commands.registerCommand('openFtpResource', (node: CompareNode) => {
	// 	vscode.workspace.openTextDocument(node.resource).then(document => {
    //         vscode.window.showTextDocument(document);
            
	// 	});
	// });
    
    // The command has been defined in the package.json file
    // Now provide the implementation of the command with  registerCommand
    // The commandId parameter must match the command field in package.json
    let disposable = vscode.commands.registerCommand('extension.sayHello', () => {
        // The code you place here will be executed every time your command is executed

        // Display a message box to the user
        vscode.window.showInformationMessage('Hello World!');
    });

    context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() {
}