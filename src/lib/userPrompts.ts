import * as vscode from 'vscode';

/** Show an error message to the user */
export function showError(msg:string,err:Error = null):void {
    if (err) console.log(err);
	vscode.window.showErrorMessage("Kirby FTP: " + msg);
}