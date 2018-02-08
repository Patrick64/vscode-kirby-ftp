import { ExtensionContext, TreeDataProvider, EventEmitter, TreeItem, Event, window, TreeItemCollapsibleState, Uri, commands, workspace, TextDocumentContentProvider, CancellationToken, ProviderResult } from 'vscode';
import * as path from 'path';
import { setTimeout, setInterval } from 'timers';
import { ITreeNode } from '../nodes/iTreeNode';
import * as vscode from 'vscode';
const streamEqual = require('stream-equal');
require('promise-pause');

export enum CompareNodeState {
	
	equal = 200,
	localOnly = 300,
	remoteOnly = 400,
	remoteChanged = 500,
	localChanged = 600,
	unequal = 700,
	bothChanged = 800,
	conflict = 900,
	error = 1000,
	loading = 1100
}


function getCompareNodeStateString(state:CompareNodeState):string {
	if (state == CompareNodeState.equal) return 'equal';
	if (state == CompareNodeState.localOnly) return 'localOnly';
	if (state == CompareNodeState.remoteOnly) return 'remoteOnly';
	if (state == CompareNodeState.remoteChanged) return 'remoteChanged';
	if (state == CompareNodeState.localChanged) return 'localChanged';
	if (state == CompareNodeState.unequal) return 'unequal';
	if (state == CompareNodeState.bothChanged) return 'bothChanged';
	if (state == CompareNodeState.conflict) return 'conflict';
	if (state == CompareNodeState.error) return 'error';
	if (state == CompareNodeState.loading) return 'loading';
	return '';
}


export class CompareNode implements ITreeNode {

	private _resource: Uri;
	public children:CompareNode[] = [];
	private profiles:ITreeNode;
	public nodeState: CompareNodeState = CompareNodeState.loading;

//	contextValue = 'file';
	
	// private _rando:number;

	constructor(public localNode, public remoteNode, private _parent: string, private filename: string, private _isFolder: boolean, public parentNode: CompareNode, public model:CompareModel) {
		
		// var uri = `ftp://${host}${_parent}${entry.name}`;
		// this._resource = Uri.parse(uri);
		// this.rando = (Date.now());
		
	}

	public get resource(): Uri {
		return this._resource;
	}

	public get path(): string {
		return path.join(this._parent, this.name);
	}

	public get name(): string {
		return this.filename;
	}

	public get isFolder(): boolean {
		return this._isFolder;
	}

	public setLocalNode(_localNode) {
		this.localNode = _localNode;
	}

	public setRemoteNode(_remoteNode) {
		this.remoteNode = _remoteNode;
	}

	public get hasChildren():boolean {
		return (this.children.length>0);
	}

	public get isRootNode():boolean {
		return !this.parentNode;
	}

	public get contextValue():string {
		if (this.isFolder) 
			return 'folder_' + getCompareNodeStateString(this.nodeState);
		else 
			return 'file_' + getCompareNodeStateString(this.nodeState);
	}

	public upload() {
		if (this.isFolder) {
			return this.model.uploadFolder(this);
		} else {
			return this.model.uploadFile(this).catch(err => {
				console.log(err);
				vscode.window.showErrorMessage("Upload of " + this.name + " failed: " + err);
			});
		}
	}

	public download() {
		if (this.isFolder) {
			return this.model.downloadFolder(this);
		} else {
			return this.model.downloadFile(this);
		}
	}


	public doComparison(localModel, remoteModel):Thenable<void> {
		if (this.isFolder) {
			this.nodeState = CompareNodeState.loading; // leave until updateFolderState is called.
        } else if (!this.localNode && !this.remoteNode) {
            this.nodeState = CompareNodeState.error;
        } else	if (!this.localNode) {
            this.nodeState = CompareNodeState.remoteOnly;
        } else if (!this.remoteNode) {
            this.nodeState = CompareNodeState.localOnly;
        } else if (this.isFolder) {
            this.nodeState = CompareNodeState.loading; // leave until updateFolderState is called.
        } else if (this.localNode.size != this.remoteNode.size)  {
            this.nodeState = CompareNodeState.unequal;
        } else {
            // setInterval( ()=>{  
			vscode.window.setStatusBarMessage("Kirby FTP: Comparing " + this.name);
			
			return Promise.all([localModel.createReadStream(this.localNode),remoteModel.createReadStream(this.remoteNode)])
			.then(([localStream, remoteStream]) => streamEqual(localStream, remoteStream))
			.then((isEqual) => {
				// localModel.closeStream();
				// remoteModel.closeStream();
				this.nodeState = isEqual ? CompareNodeState.equal : CompareNodeState.unequal;
			}).catch((err) => {
				this.nodeState = CompareNodeState.error;
				return Promise.reject(err);
			})	;									
			
            // }, 1000 );
        }
        return Promise.resolve();
    
		
	}

	public get iconName(): string {

		if (this.isFolder) {
			// if (!this.localNode && !this.remoteNode) {
			// 	return 'error';
			// } else	if (!this.localNode) {
			// 	return 'folder-remote';
			// } else if (!this.remoteNode) {
			// 	return 'folder-local';
			// } else {
				switch (this.nodeState) {
					case CompareNodeState.loading: return 'loading'; 
					case CompareNodeState.error: return 'error'; 
					case CompareNodeState.equal: return 'folder-equal'; 
					case CompareNodeState.conflict: return 'folder-conflict'; 
					case CompareNodeState.localOnly: return 'folder-local'; 
					case CompareNodeState.remoteOnly: return 'folder-remote'; 
					case CompareNodeState.unequal: return 'folder-conflict'; 
					case CompareNodeState.remoteChanged: return 'folder-changed'; 
					case CompareNodeState.localChanged: return 'folder-changed'; 
					case CompareNodeState.bothChanged: return 'folder-changed'; 
				}
			// }
		}
		switch (this.nodeState) {
			case CompareNodeState.loading: return 'loading'; 
			case CompareNodeState.error: return 'error'; 
			case CompareNodeState.equal: return 'equal'; 
			case CompareNodeState.conflict: return 'conflict'; 
			case CompareNodeState.localOnly: return 'file-local'; 
			case CompareNodeState.remoteOnly: return 'file-remote'; 
			case CompareNodeState.unequal: return 'unequal'; 
			case CompareNodeState.remoteChanged: return 'remoteChanged'; 
			case CompareNodeState.localChanged: return 'localChange'; 
		}

	}

	public addChildNode(child:CompareNode) {
		this.children.push(child);
	}

	public getChildNodes() {
		return Promise.resolve(this.model.sort(this.children));
	}

	public updateFolderState() {
		var newState:CompareNodeState = CompareNodeState.equal;
		if (!this.localNode && !this.remoteNode) {
            this.nodeState = CompareNodeState.error;
        } else	if (!this.localNode) {
            this.nodeState = CompareNodeState.remoteOnly;
        } else if (!this.remoteNode) {
			this.nodeState = CompareNodeState.localOnly;
		} else if (this.children.length==0) {
			this.nodeState = CompareNodeState.equal;
		} else {
			var states = this.children.reduce((states: CompareNodeState[], childNode: CompareNode) => {
				if (states.indexOf(childNode.nodeState)==-1) states.push(childNode.nodeState)
				return states;
				// if (childNode.nodeState > newState) return childNode.nodeState; else return newState;
				// if (newState == CompareNodeState.equal)
			}, []);
			if (states.indexOf(CompareNodeState.loading)!=-1)
				this.nodeState = CompareNodeState.loading;
			else if (states.indexOf(CompareNodeState.error)!=-1)
				this.nodeState = CompareNodeState.error;
			else if (states.indexOf(CompareNodeState.conflict) != -1 || states.indexOf(CompareNodeState.unequal) != -1)
				this.nodeState = CompareNodeState.unequal;
			else if ((states.indexOf(CompareNodeState.localOnly) != -1 || states.indexOf(CompareNodeState.localChanged) != -1) &&
				(states.indexOf(CompareNodeState.remoteOnly) == -1 || states.indexOf(CompareNodeState.remoteChanged) == -1)) 
				this.nodeState = CompareNodeState.localChanged;
			else if ((states.indexOf(CompareNodeState.remoteOnly) != -1 || states.indexOf(CompareNodeState.remoteChanged) != -1) &&
				(states.indexOf(CompareNodeState.localOnly) == -1 || states.indexOf(CompareNodeState.localChanged) == -1)) 
				this.nodeState = CompareNodeState.remoteChanged;
			else if (states.length==0 || (states.length==1 && states[0] == CompareNodeState.equal))
				this.nodeState = CompareNodeState.equal;
			else
				this.nodeState == CompareNodeState.bothChanged;
			

		}
		if (this._parent) this.parentNode.updateFolderState();
	}

}


export class CompareModel {
	
	private rootNode:CompareNode;
	private hasUserRequestedAPause: boolean = false;
	
	constructor(private localModel, private remoteModel, private nodeUpdated:Function) {
		this.rootNode = new CompareNode(localModel.getRootNode(),remoteModel.getRootNode(),"",path.sep,true,null, this);
		//this.refreshAll();
		// setInterval( () => { this.nodeUpdated(null); }, 1000);

	}

	public connect() {
		vscode.window.setStatusBarMessage("Kirby FTP: Connecting to remote...");
		return Promise.all([this.localModel.connect(), this.remoteModel.connect()]);
	
	}

	public userRequestsPause() {
		this.hasUserRequestedAPause=true;
	}

	public disconnect() {
		this.localModel.disconnect();
		this.remoteModel.disconnect();
	
	}


	public get roots(): Thenable<ITreeNode[]> {
		// return this.getChildren(null);
		return this.rootNode.getChildNodes();
	}

	public refreshAll() {
		console.log('FTP refresall is started.');
		vscode.window.setStatusBarMessage("Kirby FTP: Refreshing files list");
		return this.connect()
			.then(() => { 
				// return this.refreshNodeRecursively(this.rootNode); 
				return this.doFullRefresh(this.rootNode);
			}).then(this.disconnect.bind(this))
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
			var promises = node.children
			.filter( c => c.isFolder )
			.map( subFolder => {
				return this.refreshFolderRecursivly(subFolder,isLocal)
			});
			return Promise.all(promises).then(() => {
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
			
		
		var compareAllFolders = () => node.children
			.filter( c => c.isFolder )
			.reduce( (promise,folder) => 
				promise.then(() => this.doComparisonsRecursivly(folder))
				.then(() => this.nodeUpdated(folder))
			,Promise.resolve());
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
		return this.connect()
		.then(() => { 
			vscode.window.setStatusBarMessage("Kirby FTP: Reading " + compareNode.name + " ..." );
			vscode.window.setStatusBarMessage("Kirby FTP: Uploading " + compareNode.name + " ..." );
			return this.doStreamUpload(compareNode);
		})
		.then(() => { this.disconnect(); })
		.then(() => { this.nodeUpdated(null); })
		.then(() => { vscode.window.setStatusBarMessage("Kirby FTP: " + compareNode.name + " uploaded." ); })
		.catch((err) => { 
			this.disconnect(); 
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
		return this.connect()
		.then(() => { 
			return this.uploadFolderResursive(compareNode);
		})
		.then(() => { this.disconnect(); })
		.then(() => { this.nodeUpdated(null); })
		.then(() => { vscode.window.setStatusBarMessage("Kirby FTP: " + compareNode.name + " uploaded." ); })
		.catch((err) => { 
			this.disconnect(); 
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
}

