'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
//import { CompareTreeDataProvider } from './providers/compareTree';
import { FtpTreeDataProvider } from './providers/compareTree';
import { kirbyFileSystemProvider } from './providers/kirbyFileSystemProvider';
import { editConfig, getAllProfiles } from './modules/config';
import { ProfileNode } from './nodes/profileNode';
import { ITreeNode } from './nodes/iTreeNode';
import { MainController } from './controllers/mainController';
import { CompareNodeState } from './lib/compareNodeState';
import { Database } from './modules/database';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    // console.log('Congratulations, your extension "kirby-ftp" is now active!');

    const db = new Database(context.storagePath);
    db.init();
    
    
    // Kirby file system is used to open files from FTP as if they were normal files
    context.subscriptions.push(vscode.workspace.registerFileSystemProvider('kirby', kirbyFileSystemProvider, { isCaseSensitive: true, isReadonly:false }));
    const compareViewProvider = new FtpTreeDataProvider();
    const filterViewProvider = new FtpTreeDataProvider();
    const mainController = new MainController(compareViewProvider, filterViewProvider, db);
    filterViewProvider.filterByStates = [
        CompareNodeState.bothChanged,
        CompareNodeState.conflict,
        CompareNodeState.localChanged,
        CompareNodeState.localOnly,
        CompareNodeState.remoteChanged,
        CompareNodeState.remoteOnly,
        CompareNodeState.unequal
    ];
    vscode.window.registerTreeDataProvider('kirbyCompareView', compareViewProvider);
    vscode.window.registerTreeDataProvider('kirbyFilterView', filterViewProvider);
    vscode.commands.registerCommand('kirbyCompareView.refreshEntry', () => mainController.refresh());
    vscode.commands.registerCommand("kirby.openConfig", () => {
        editConfig();

    } );
    vscode.commands.registerCommand('kirby.uploadNode', (node: ITreeNode) => {
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
    vscode.commands.registerCommand('kirby.downloadNode', (node: ITreeNode) => {
		// vscode.workspace.openTextDocument(node.resource).then(document => {
		// 	vscode.window.showTextDocument(document);
        // });
       // vscode.window.showInformationMessage("todo: Upload file ");
       try {
            node.download();
       } catch (err)  {
           vscode.window.showErrorMessage(err);
       }

        
    });

    // vscode.window.regist FileSystemProvider
    // vscode.workspace.registerFileSystemProvider('kirby-ftp',vscode.)
   
    vscode.commands.registerCommand('kirby.openFile', (node: ITreeNode) => {
        node.openDiff();
        
        vscode.window.setStatusBarMessage("Kirby FTP: Opening diff window");
       
       
        
    });
    context.subscriptions.push( 
        vscode.workspace.onDidSaveTextDocument((e:vscode.TextDocument)=>{
         
        }),
      );

    try {
        mainController.loadAllProfiles();
    } catch (err) {
        vscode.window.showErrorMessage(err);
    }
    
    // getAllProfiles().then((profiles):Promise<void> => {
    //     compareViewProvider.loadSettingsProfiles(profiles);
    //     return Promise.resolve();
    // }).catch(error => {
    //     vscode.window.showErrorMessage(error);
    // });

    // var promise1:Promise<void> = new Promise(function(resolve, reject) {
    //     debugger;
    //     throw 'Uh-oh!';
    //   });
      
    //   promise1.catch(function(error) {
    //     console.log(error);
    //   });

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