import { ExtensionContext, TreeDataProvider, EventEmitter, TreeItem, Event, window, TreeItemCollapsibleState, Uri, commands, workspace, TextDocumentContentProvider, CancellationToken, ProviderResult } from 'vscode';
import * as path from 'path';
import { setTimeout, setInterval } from 'timers';
import { ITreeNode } from '../nodes/iTreeNode';
import * as vscode from 'vscode';
import { ProfileNode } from '../nodes/profileNode';
require('promise-pause');
import { CompareNode, CompareNodeState } from '../nodes/compareNode';

export class CompareModel {
	
	private rootNode:CompareNode;
	private hasUserRequestedAPause: boolean = false;
	
	constructor(private localModel, private remoteModel, private nodeUpdated:Function, private profileNode: ProfileNode) {
		this.rootNode = new CompareNode(localModel.getRootNode(),remoteModel.getRootNode(),"",path.sep,true,null, this);
		//this.refreshAll();
		// setInterval( () => { this.nodeUpdated(null); }, 1000);

	}

	public connect():Promise<void> {
		vscode.window.setStatusBarMessage("Kirby FTP: Connecting to remote...");
		return Promise.all([this.localModel.connect(), this.remoteModel.connect()]).then(() => {});
	
	}

	public userRequestsPause() {
		this.hasUserRequestedAPause=true;
	}

	public disconnect() {
		// this.localModel.disconnect();
		// this.remoteModel.disconnect();
		console.log("TODO: Disconnect");
	}


	public get roots(): Thenable<ITreeNode[]> {
		// return this.getChildren(null);
		return this.rootNode.getChildNodes();
	}

	public refreshAll() {
		console.log('FTP refresall is started.');
		vscode.window.setStatusBarMessage("Kirby FTP: Refreshing files list");
		return this.doFullRefresh(this.rootNode)
			.then(() => {
				console.log('FTP refresall is done.');
				vscode.window.setStatusBarMessage("Kirby FTP: Finished refreshing files list");
			}).catch(err => {
				console.log(err)
				vscode.window.showErrorMessage("Kirby FTP: " + err);
			});
	}

	// public refreshFolder(node:CompareNode) {
	// 	var isRootNode = (node == this.rootNode);
	// 	var parentPath = !isRootNode ? node.path : path.sep;
	// 	// if node is null then get root items, if it's not null then get all local items unless there's no localNode which means the directory doesnt exist locally
	// 	var getLocalNodes = !isRootNode ? (node.localNode ? this.localModel.getChildren(node.localNode) : []) : this.localModel.roots;
	// 	// same as above but remote
	// 	var getRemoteNodes = !isRootNode ? (node.remoteNode ? this.remoteModel.getChildren(node.remoteNode) : []) : this.remoteModel.roots;
	// 	// wait for promises
	// 	vscode.window.setStatusBarMessage("Kirby FTP: Scanning folder " + node.name);
	// 	return Promise.all([getLocalNodes,getRemoteNodes]).then(([localNodes,remoteNodes]) => {
	// 		var remoteNodeByName = {},  localNodeByName = {};
	// 		remoteNodes.forEach( n => { remoteNodeByName[n.name] = n; } );
	// 		localNodes.forEach( n => { localNodeByName[n.name] = n; } );
	// 		node.children.forEach(element => {
				
	// 		});
	// 	});
	// }

	public refreshFolder(node:CompareNode,isLocal:boolean) {
		var model = isLocal ? this.localModel : this.remoteModel;
		var localOrRemoteNode = isLocal ? node.localNode : node.remoteNode;

		var isRootNode = (node == this.rootNode);
		var parentPath = !isRootNode ? node.path : path.sep;
		if (isRootNode || localOrRemoteNode) {
			var getNodesFunc = isRootNode ? model.roots : model.getChildren(localOrRemoteNode);
			return getNodesFunc.then((newNodes) => {
				
				var childrenByName = node.children.reduce( (p,c) => { p[c.name] = c; return p; }, {} );
				newNodes.forEach( newNode => {
					
					if (isLocal && childrenByName[newNode.name]) {
						childrenByName[newNode.name].setLocalNode(newNode);
					} else if (isLocal) {
						node.children.push(new CompareNode(newNode,null,node.path,newNode.name,newNode.isFolder,node,this));
					} else if (!isLocal && childrenByName[newNode.name]) {
						childrenByName[newNode.name].setRemoteNode(newNode);
					} else if (!isLocal) {
						node.children.push(new CompareNode(null,newNode,node.path,newNode.name,newNode.isFolder,node,this));
					}
					
				});
				var newNodesByName = newNodes.reduce( (prev,c) => { prev[c.name] = c; return prev; }, {} );
				node.children.forEach( (childNode,i) => {
					if (!newNodesByName[childNode.name]) {
						// file doesnt exist locally
						if (isLocal) {
							childNode.setLocalNode(null);
						} else {
							childNode.setRemoteNode(null);
						}
						
					}
				});
				this.removeNodelessChildren(node);	
				this.updateFolderStateRecursive(node);
				this.nodeUpdated(node);
			});
		} else {
			if (isLocal) {
				node.children.forEach(c => c.setLocalNode(null));
			} else {
				node.children.forEach(c => c.setRemoteNode(null));
			}
			this.removeNodelessChildren(node);	
			this.updateFolderStateRecursive(node);
			this.nodeUpdated(node);
			return Promise.resolve();
		}
	}

	public removeNodelessChildren(node:CompareNode) {
		node.children = node.children.filter( n => (n.remoteNode || n.localNode));
	}

	public refreshFolderRecursivly(node,isLocal) {
		
		return this.refreshFolder(node,isLocal).pause(this.hasUserRequestedAPause ? 500 : 0).then(() => {
			this.hasUserRequestedAPause = false;
			return node.children
			.filter( c => c.isFolder )
			.reduce( (promise,subFolder) => promise.then(() => this.refreshFolderRecursivly(subFolder,isLocal) ), Promise.resolve())
			.then(() => {
				this.nodeUpdated(node.isRootNode ? null : node);
			});
		});
		
	}

	public doComparisonsRecursivly(node) {

		var compareAllFiles = () => node.children
			.filter( c => !c.isFolder )
			.reduce( (promise,file) => 
				promise.then(() => file.doComparison(this.localModel,this.remoteModel))
				.then(() => this.nodeUpdated(file))
			, Promise.resolve());
			
		
		var compareAllFolders = () => {
			return node.children
			.filter( c => c.isFolder )
			.reduce( (promise,folder) => 
				promise.then(() => {
					return this.doComparisonsRecursivly(folder)
				})
				.then(() => this.nodeUpdated(folder))
			,Promise.resolve());
		};

		return compareAllFiles()
		.then(() => compareAllFolders())
		.then(() => node.updateFolderState());
		
	}

	public doFullRefresh(node:CompareNode) {
		return this.refreshFolderRecursivly(node,true)
		.then(() => this.nodeUpdated(null))
		.pause(500)
		.then(() => {
			return this.refreshFolderRecursivly(node,false)
		})
		.then(() => this.nodeUpdated(null))
		.pause(500)
		.then(() => this.doComparisonsRecursivly(node))
		.catch(err => {
					console.error(err)
					
						vscode.window.showErrorMessage("Remote listing failed. " + err );
					return Promise.reject(err);
				});
	}


	public getChildren(node: CompareNode): Thenable<CompareNode[]> {
		return Promise.resolve(node.getChildNodes());
		
	}

	public sort(nodes: CompareNode[]): CompareNode[] {
		return nodes.sort((n1, n2) => {
			if (n1.isFolder && !n2.isFolder) {
				return -1;
			}

			if (!n1.isFolder && n2.isFolder) {
				return 1;
			}

			return n1.name.localeCompare(n2.name);
		});
	}

	public uploadFile(compareNode:CompareNode):Promise<void> {
		vscode.window.setStatusBarMessage("Kirby FTP: Uploading " + compareNode.name + " ..." );
		compareNode.nodeState = CompareNodeState.loading;
		this.nodeUpdated(compareNode); 
		 
		vscode.window.setStatusBarMessage("Kirby FTP: Reading " + compareNode.name + " ..." );
		vscode.window.setStatusBarMessage("Kirby FTP: Uploading " + compareNode.name + " ..." );
		return this.doStreamUpload(compareNode)
		.then(() => { this.nodeUpdated(null); })
		.then(() => { vscode.window.setStatusBarMessage("Kirby FTP: " + compareNode.name + " uploaded." ); })
		.catch((err) => { 
			
			compareNode.nodeState = CompareNodeState.error; 
			this.nodeUpdated(compareNode);
			vscode.window.setStatusBarMessage("Kirby FTP: " + compareNode.name + " failed to upload." );
			return Promise.reject(err); 
			
		})
	}

	// upload file and create directory if neccesary
	private doStreamUpload(compareNode) {
		compareNode.nodeState = CompareNodeState.loading;
		vscode.window.setStatusBarMessage("Kirby FTP: Uploading " + compareNode.name + " ..." );
		return this.localModel.createReadStream(compareNode.localNode).then(stream => {
			if (compareNode.remoteNode) {
				return  this.remoteModel.writeFileFromStream(compareNode.remoteNode,stream);
			} else {
				return this.createRemoteFolder(compareNode.parentNode).then(() => {
					return this.remoteModel.writeNewFileFromStream(compareNode.parentNode.remoteNode,compareNode.name,stream);
				});
			}
		}).then(() => {
			compareNode.nodeState = CompareNodeState.equal;
			return this.refreshFolder(compareNode.parentNode,false);
		}).then(() => this.updateFolderStateRecursive(compareNode.parentNode));
			
		
	}

	public downloadFile(compareNode:CompareNode) {}

	public uploadFolder(compareNode:CompareNode) {
		vscode.window.setStatusBarMessage("Kirby FTP: Uploading " + compareNode.name + " ..." );
		compareNode.nodeState = CompareNodeState.loading;
		this.nodeUpdated(compareNode); 
		return this.uploadFolderResursive(compareNode)
		.then(() => { this.nodeUpdated(null); })
		.then(() => { vscode.window.setStatusBarMessage("Kirby FTP: " + compareNode.name + " uploaded." ); })
		.catch((err) => { 
			compareNode.nodeState = CompareNodeState.error; 
			this.nodeUpdated(compareNode);
			vscode.window.setStatusBarMessage("Kirby FTP: " + compareNode.name + " failed to upload: " + err );
			return Promise.reject(err); 
			
		})

	}

	private uploadFolderResursive(compareNode) {
		vscode.window.setStatusBarMessage("Kirby FTP: Uploading folder " + compareNode.name + " ...");
		return this.refreshFolder(compareNode,true)
		.then(() => this.refreshFolder(compareNode,false))
		.then(() => compareNode.children.filter(n => !n.isFolder).reduce((promise,n) => promise.then( () => this.doStreamUpload(n)) , Promise.resolve() ))
		.then(() => compareNode.children.filter(n => n.isFolder).reduce((promise,n) => promise.then( () => this.uploadFolderResursive(n)) , Promise.resolve() ))
		.then(() => {vscode.window.setStatusBarMessage("Kirby FTP: Folder uploaded " + compareNode.name + " ...") } );
		
		
	}
	public downloadFolder(compareNode:CompareNode) {}
	
	public createRemoteFolder(compareNode:CompareNode):Thenable<void> {
		
		if (compareNode.remoteNode || !compareNode.parentNode) {
			return Promise.resolve();
		} else if (compareNode.parentNode) {
			return this.createRemoteFolder(compareNode.parentNode).then(() => { 
				vscode.window.setStatusBarMessage("Kirby FTP: Creating remote folder " + compareNode.name + " ..." );
				return this.remoteModel.mkdir(compareNode.parentNode.path, compareNode.name);
			}).then(() => {
				return this.refreshFolder(compareNode.parentNode,false).then(() => compareNode.parentNode.updateFolderState()); 
			}
			);
		} else {
			return Promise.reject("createRemoteFolder couldnt find root folder");
		}
	}

	



	public getContent(resource: Uri): Thenable<string> {
		return Promise.resolve("abc");
		// return this.connect().then(client => {
		// 	return new Promise((c, e) => {
		// 		client.get(resource.path.substr(2), (err, stream) => {
		// 			if (err) {
		// 				return e(err);
		// 			}

		// 			let string = ''
		// 			stream.on('data', function (buffer) {
		// 				if (buffer) {
		// 					var part = buffer.toString();
		// 					string += part;
		// 				}
		// 			});

		// 			stream.on('end', function () {
		// 				client.end();
		// 				c(string);
		// 			});
		// 		});
		// 	});
		// });
	}
	public updateFolderStateRecursive(node:CompareNode) {
		node.updateFolderState();
		if (node.parentNode) {
			this.updateFolderStateRecursive(node.parentNode);
		}
	}

	private setNodeIsLoading(node:CompareNode,isLoading:boolean):void {
		node.isLoading = isLoading;
		this.nodeUpdated(node);
	}

	

	public openDiff(node) {
		
		if (node.localNode && node.remoteNode) {
			this.setNodeIsLoading(node,true);
			return Promise.all([this.localModel.getUri(node.localNode,this.profileNode.workspaceFolder),this.remoteModel.getUri(node.remoteNode,this.profileNode.workspaceFolder)]) 
			.then(([localUri,remoteUri]) => { 
				try { 
					this.setNodeIsLoading(node,false);
					vscode.commands.executeCommand("vscode.diff",localUri,remoteUri,  node.name + " <-> " + " Remote", { originalEditable:true, readOnly:false } );  
				} catch(err) { 
					return Promise.reject(err); 
				}
			}).catch((err) => { 
				vscode.window.showErrorMessage("Kirby FTP: " + err); 
				console.log(err); 
				this.setNodeIsLoading(node,false);
			});
			
		} else if (node.localNode || node.remoteNode) {
			this.setNodeIsLoading(node,true);
			var fileNode = node.localNode ? node.localNode : node.remoteNode;
			var fileModel = node.localNode ? this.localModel : this.remoteModel;
			return fileModel.getUri(fileNode,this.profileNode.workspaceFolder)
			.then((uri) => { 
				try { 
					this.setNodeIsLoading(node,false);
					return vscode.workspace.openTextDocument(uri).then((doc) => vscode.window.showTextDocument(doc));
				} catch(err) { 
					return Promise.reject(err); 
				}
			}).catch((err) => { 
				vscode.window.showErrorMessage("Kirby FTP: " + err); 
				console.log(err); 
				this.setNodeIsLoading(node,false);
			});
		}
		
	}

}

