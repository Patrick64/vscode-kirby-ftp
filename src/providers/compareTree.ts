import * as vscode from 'vscode';
import * as path from 'path';
import { isNumber } from 'util';
let Client = require('ftp');
 

export class CompareTreeDataProvider implements vscode.TreeDataProvider<string> {
    getTreeItem(offset: string): vscode.TreeItem {
		// const path = json.getLocation(this.text, parseInt(offset)).path
		// const valueNode = json.findNodeAtLocation(this.tree, path);
		// if (valueNode) {
			let hasChildren = false;
			let treeItem: vscode.TreeItem = new vscode.TreeItem(offset, vscode.TreeItemCollapsibleState.None);
			// treeItem.command = {
			// 	command: 'extension.openJsonSelection',
			// 	title: '',
			// 	arguments: [new vscode.Range(this.editor.document.positionAt(valueNode.offset), this.editor.document.positionAt(valueNode.offset + valueNode.length))]
			// };
			// treeItem.iconPath = this.getIcon(valueNode);
			// treeItem.contextValue = valueNode.type   ;
			return treeItem;
		// }
		// return null;
    }
    
    getChildren(offset?: string): Thenable<string[]> {
		// if (offset) {
		// 	const path = json.getLocation(this.text, parseInt(offset)).path
		// 	const node = json.findNodeAtLocation(this.tree, path);
		// 	return Promise.resolve(this.getChildrenOffsets(node));
		// } else {
		// 	return Promise.resolve(this.tree ? this.getChildrenOffsets(this.tree) : []);
		// }
        return new Promise((resolve,reject) => {
            // return Promise.resolve( ["whatever"]);
        
            var c = new Client();
            c.on('ready', function() {
              c.list(function(err, list) {
                if (err) throw err;
                console.dir(list);
                c.end();
                resolve(list.map(file => file.name));
                
              });
            });
            // connect to localhost:21 as anonymous 
            c.connect({
                'host':'127.0.0.1',
                'port':4567,
                'user':'test',
                'password':'123'
            });
        } )
        
	}
}
