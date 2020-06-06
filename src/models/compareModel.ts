import { ExtensionContext, TreeDataProvider, EventEmitter, TreeItem, Event, window, TreeItemCollapsibleState, Uri, commands, workspace, TextDocumentContentProvider, CancellationToken, ProviderResult } from 'vscode';
import * as path from 'path';
import { setTimeout, setInterval } from 'timers';
import { ITreeNode } from '../nodes/iTreeNode';
import * as vscode from 'vscode';
import { ProfileNode, ConnectionStatus } from '../nodes/profileNode';
require('promise-pause');
import { CompareNode } from '../nodes/compareNode';
import { PromiseQueue } from '../modules/promiseQueue';
import { CompareNodeState } from '../lib/compareNodeState';
import { Database } from '../modules/database';
import { ISyncInfo, ISyncInfoNode } from '../interfaces/iSyncInfo';
import { kirbyFileSystemProvider } from '../providers/kirbyFileSystemProvider';

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
  }
export class CompareModel {
	
	
	private hasUserRequestedAPause: boolean = false;
	private promiseQueue:PromiseQueue;
	private priorSyncInfo:ISyncInfo | null = null;

	
	constructor(private localModel, private remoteModel, private nodeUpdated:Function, private profileNode: ProfileNode,private database: Database) {
		
		this.promiseQueue = new PromiseQueue(this.onError);
		//this.refreshAll();
		// setInterval( () => { this.nodeUpdated(null); }, 1000);

	}

	private onError(err) {
		vscode.window.showErrorMessage("Kirby FTP: " + err);
		console.log(err);
	}

	public connect():Promise<void> {
		vscode.window.setStatusBarMessage("Kirby FTP: Connecting to remote...");
		return Promise.all([this.localModel.connect(), this.remoteModel.connect()]).then(() => {})
		.then(async () => {
			this.profileNode.connectionStatus = ConnectionStatus.Connected;
			this.nodeUpdated(this.profileNode);
			this.priorSyncInfo = await this.profileNode.getSyncInfoFromDatabase();
		})
		.catch((err) => {
			vscode.window.setStatusBarMessage("Kirby FTP: " + err);
			this.profileNode.connectionStatus = ConnectionStatus.ConnectFailed;
			this.nodeUpdated(this.profileNode);
			// return Promise.reject(err);
		})
	
	}

	public userRequestsPause() {
		this.hasUserRequestedAPause=true;
	}

	public async disconnect() {
		await this.promiseQueue.emptyQueue();
		await this.localModel.disconnect();
		await this.remoteModel.disconnect();
		this.profileNode.children = [];
		this.nodeUpdated(this.profileNode);
		console.log("TODO: Disconnect");
	}


	// public get roots(): Thenable<ITreeNode[]> {
	// 	// return this.getChildren(null);
	// 	return this.profileNode.getChildNodes();
	// }

	public refreshAll() {
		if (this.profileNode.connectionStatus == ConnectionStatus.Connected) {
			this.promiseQueue.addToQueue(() => {
				console.log('FTP refresall is started.');
				vscode.window.setStatusBarMessage("Kirby FTP: Refreshing files list");
				return this.doFullRefresh(this.profileNode)
					.then(() => {
						console.log('FTP refresall is done.');
						vscode.window.setStatusBarMessage("Kirby FTP: Finished refreshing files list");
					}).catch(err => {
						console.log(err)
						vscode.window.showErrorMessage("Kirby FTP: " + err);
					});
			});
		}
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

	public getSyncInfoForNode(node:CompareNode):ISyncInfoNode | null {
		//  get array of nodes leading to this one ie ["wp-content","themes","mytheme"]
		if (this.priorSyncInfo) {
			const path = node.getParentNodes();
			path.push(node);
			path.shift(); // remove the profile node
			// starting from the root work up the tree to find the correct prior sync node
			return path.reduce((syncNode,compareNode)=> {
				if (syncNode !== null && syncNode.children[compareNode.name]) {
					return syncNode.children[compareNode.name];
				} else {
					return null;
				}
			},this.priorSyncInfo.nodes)
		} else {
			return null;
		}
	}


	private async refreshFolder(node:CompareNode,isLocal:boolean):Promise<void> {
		var model = isLocal ? this.localModel : this.remoteModel;
		var localOrRemoteNode = isLocal ? node.localNode : node.remoteNode;

		var isRootNode = (node == this.profileNode);
		var parentPath = !isRootNode ? node.path : path.sep;
		if (isRootNode || localOrRemoteNode) {
			var getNodesFunc = isRootNode ? model.roots : model.getChildren(localOrRemoteNode);
			const newNodes = await getNodesFunc;
			try {
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
				node.setFolderHasRefreshed(isLocal);
				this.updateFolderStateRecursive(node);
				this.nodeUpdated(node);
			} catch(err) {
				console.error('failed ' + (isLocal ? 'local ' : 'remote ') + node.path,err);
				vscode.window.showErrorMessage("failed to list folder on " + (isLocal ? 'local ' : 'remote ') + err );
				node.isFailed = true;
			}
		} else {
			if (isLocal) {
				node.children.forEach(c => c.setLocalNode(null));
			} else {
				node.children.forEach(c => c.setRemoteNode(null));
			}
			this.removeNodelessChildren(node);	
			node.setFolderHasRefreshed(isLocal);
			this.updateFolderStateRecursive(node);
			this.nodeUpdated(node);
		}
	}

	private removeNodelessChildren(node:CompareNode) {
		node.children = node.children.filter( n => (n.remoteNode || n.localNode));
	}

	private async refreshFolderRecursivly(node,isLocal) {
		
		await this.refreshFolder(node,isLocal);
		await sleep(this.hasUserRequestedAPause ? 500 : 0)
		this.hasUserRequestedAPause = false;
		return node.children
			.filter( c => c.isFolder )
			.reduce( (promise,subFolder) => promise.then(() => this.refreshFolderRecursivly(subFolder,isLocal) ), Promise.resolve())
			.then(() => {
				this.nodeUpdated(node.isRootNode ? null : node);
			});
		
		
	}

	private doComparisonsRecursivly(node:CompareNode,priorSyncInfoNode:ISyncInfoNode) {

		var compareAllFiles = () => node.children
			.filter( c => !c.isFolder )
			.reduce( (promise,file) => 
				promise.then(() => {
					const n = priorSyncInfoNode?.children?.[file.name]
					return file.doComparison(this.localModel,this.remoteModel,n)
				})
				.then(() => this.nodeUpdated(file))
			, Promise.resolve());
			
		
		var compareAllFolders = () => {
			return node.children
			.filter( c => c.isFolder )
			.reduce( (promise,folder) => 
				promise.then(() => {
					const n = priorSyncInfoNode?.children?.[folder.name]
					return this.doComparisonsRecursivly(folder,n)
				})
				.then(() => this.nodeUpdated(folder))
			,Promise.resolve());
		};

		return compareAllFiles()
		.then(() => compareAllFolders())
		.then(() => node.setFolderHasCompletedComparison())
		.then(() => node.updateFolderState());
		
	}

	public async refreshJustThisFile(node:CompareNode) {
		await this.refreshFolder(node.parentNode,true);
		await this.refreshFolder(node.parentNode,false);
		await node.doComparison(this.localModel,this.remoteModel);
		await node.updateFolderState();
		// await node.updateFolderState();
		// this.nodeUpdated(null);
		await this.saveSyncInfo();
		this.nodeUpdated(node);
	}

	private async saveSyncInfo() {
		const syncInfo = this.profileNode.getSyncInfo();
		await this.database.storeSyncInfo(syncInfo);
	}

	private async doFullRefresh(node:CompareNode) {
		
		return this.refreshFolderRecursivly(node,true)
		.then(() => this.nodeUpdated(null))
		.then(()=>sleep(500))
		.then(() => {
			return this.refreshFolderRecursivly(node,false)
		})
		.then(() => this.nodeUpdated(null))
		.then(()=>sleep(500))
		.then(() => this.doComparisonsRecursivly(node,this.priorSyncInfo ? this.priorSyncInfo.nodes : null))
		.then(async () => {
			await this.saveSyncInfo();
			//const stored = await this.database.getSyncInfo(syncInfo);
			
		})
		.catch(err => {
					console.error(err)
					
					vscode.window.showErrorMessage("Remote listing failed. " + err );
					// return Promise.reject(err);
					node.isFailed = true;
					node.children = []; // remove all children as this refresh has failed
					console.log("children " , node.children.length);
					this.nodeUpdated(node);
					return Promise.resolve();

				});
	}


	public getChildren(node: CompareNode): Thenable<CompareNode[]> {
		return Promise.resolve(node.getChildNodes());
		
	}

	public filterByStates(filterByStates:CompareNodeState[],nodes:CompareNode[]):CompareNode[] {
		if (!filterByStates || filterByStates.length == 0) {
			return nodes;
		} else {
			return nodes.filter(node => 
				node.isFolder || filterByStates.includes(node.nodeState)
			)
		}
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

	/**
	 * 
	 * @param compareNode 
	 */
	public uploadFile(compareNode:CompareNode):Promise<any> {
		
		
		this.setNodeIsLoading(compareNode,true);
		vscode.window.setStatusBarMessage("Kirby FTP: Waiting to upload " + compareNode.name + " ..." );

		return this.promiseQueue.addToQueue(() => {
			
			return this.doStreamUpload(compareNode)
			// .then(() => { this.nodeUpdated(null); })
			.then(() => { vscode.window.setStatusBarMessage("Kirby FTP: " + compareNode.name + " uploaded." ); })
			.catch((err) => { 
				
				compareNode.nodeState = CompareNodeState.error; 
				this.nodeUpdated(compareNode);
				vscode.window.setStatusBarMessage("Kirby FTP: " + compareNode.name + " failed to upload: " + err );
				console.log(err);
				// return Promise.reject(err); 
				
			}).finally( async () => {
				
				this.setNodeIsLoading(compareNode,false);
				await this.refreshJustThisFile(compareNode);
			})	
		})
		
	}

	// upload file and create directory if neccesary
	private doStreamUpload(compareNode) {
		
		if (!this.canUploadFile(compareNode)) {
			throw "File cant be uploaded";
		}
		// compareNode.nodeState = CompareNodeState.loading;
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


	// upload file and create directory if neccesary
	private doStreamDownload(compareNode) {
		
		if (!this.canDownloadFile(compareNode)) {
			throw "File cant be dwnloaded";
		}
		// compareNode.nodeState = CompareNodeState.loading;
		vscode.window.setStatusBarMessage("Kirby FTP: Downloading " + compareNode.name + " ..." );
		return this.remoteModel.getBuffer(compareNode.remoteNode).then(stream => {
			if (compareNode.localNode) {
				return  this.localModel.writeFileFromStream(compareNode.localNode,stream);
			} else {
				return this.createLocalFolder(compareNode.parentNode).then(() => {
					return this.localModel.writeNewFileFromStream(compareNode.parentNode.localNode,compareNode.name,stream);
				});
			}
		}).then(() => {
			compareNode.nodeState = CompareNodeState.equal;
			return this.refreshFolder(compareNode.parentNode,false);
		}).then(() => this.updateFolderStateRecursive(compareNode.parentNode));
			
		
	}
	
	

	public async downloadFile(compareNode:CompareNode):Promise<void> {
		
		
		this.setNodeIsLoading(compareNode,true);
		vscode.window.setStatusBarMessage("Kirby FTP: Waiting to download " + compareNode.name + " ..." );

		await this.promiseQueue.addToQueue(async () => {
			
			try {
				await this.doStreamDownload(compareNode);
				// .then(() => { this.nodeUpdated(null); })
				vscode.window.setStatusBarMessage("Kirby FTP: " + compareNode.name + " downloaded." ); 
			} catch(err) {
				
				compareNode.nodeState = CompareNodeState.error; 
				this.nodeUpdated(compareNode);
				vscode.window.showErrorMessage("Kirby FTP: " + compareNode.name + " failed to upload: " + err );
				console.log(err);
			} finally {	
				this.setNodeIsLoading(compareNode,false);
				await this.refreshJustThisFile(compareNode);
			}
		})
		
	}


	public uploadFolder(compareNode:CompareNode) {
		
		
		this.setNodeIsLoading(compareNode,true);
		this.nodeUpdated(compareNode); 
		this.promiseQueue.addToQueue(() => {
			vscode.window.setStatusBarMessage("Kirby FTP: Uploading folder " + compareNode.name + " ..." );
			return this.uploadFolderResursive(compareNode)
			.then(() => { this.nodeUpdated(null); })
			.then(() => { 
				vscode.window.setStatusBarMessage("Kirby FTP: " + compareNode.name + " uploaded." ); })
			.catch((err) => { 
				compareNode.nodeState = CompareNodeState.error; 
				this.nodeUpdated(compareNode);
				vscode.window.showErrorMessage("Kirby FTP: " + compareNode.name + " failed to upload: " + err );
				console.log(err);
				return Promise.reject(err); 
				
			}).finally(() => {
				this.setNodeIsLoading(compareNode,false);
			})
		})
		

	}

	private canUploadFile(node:CompareNode):boolean {
		return (!node.isFolder && node.localNode && 
		( node.nodeState == CompareNodeState.bothChanged 
		 || node.nodeState == CompareNodeState.conflict 
		 || node.nodeState == CompareNodeState.error 
		 || node.nodeState == CompareNodeState.localChanged 
		 || node.nodeState == CompareNodeState.localOnly 
		 || node.nodeState == CompareNodeState.remoteChanged 
		 || node.nodeState == CompareNodeState.unequal));

	}

	private canDownloadFile(node:CompareNode):boolean {
		return (!node.isFolder && node.remoteNode && 
		( node.nodeState == CompareNodeState.bothChanged 
		 || node.nodeState == CompareNodeState.conflict 
		 || node.nodeState == CompareNodeState.error 
		 || node.nodeState == CompareNodeState.localChanged 
		 || node.nodeState == CompareNodeState.remoteOnly 
		 || node.nodeState == CompareNodeState.remoteChanged 
		 || node.nodeState == CompareNodeState.unequal));

	}

	private canUploadFolder(node:CompareNode):boolean {
		return (node.isFolder && node.localNode !== null);

	}

	private uploadFolderResursive(compareNode) {
		vscode.window.setStatusBarMessage("Kirby FTP: Uploading folder " + compareNode.name + " ...");
		return this.refreshFolder(compareNode,true)
		.then(() => this.refreshFolder(compareNode,false))
		.then(() => { if (!compareNode.remoteNode) {  return this.createRemoteFolder(compareNode); } }  )
		.then(() => compareNode.children.filter(this.canUploadFile).reduce((promise,n) => promise.then( () => this.doStreamUpload(n)) , Promise.resolve() ))
		.then(() => compareNode.children.filter(this.canUploadFolder).reduce((promise,n) => promise.then( () => this.uploadFolderResursive(n)) , Promise.resolve() ))
		.then(() => {vscode.window.setStatusBarMessage("Kirby FTP: Folder uploaded " + compareNode.name + " ...") } );
		
		
	}
	public downloadFolder(compareNode:CompareNode) {}
	
	private createRemoteFolder(compareNode:CompareNode):Thenable<void> {
		
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

	private createLocalFolder(compareNode:CompareNode):Thenable<void> {
		
		if (compareNode.localNode || !compareNode.parentNode) {
			return Promise.resolve();
		} else if (compareNode.parentNode) {
			return this.createLocalFolder(compareNode.parentNode).then(() => { 
				vscode.window.setStatusBarMessage("Kirby FTP: Creating local folder " + compareNode.name + " ..." );
				return this.localModel.mkdir(compareNode.parentNode.path, compareNode.name);
			}).then(() => {
				return this.refreshFolder(compareNode.parentNode,false).then(() => compareNode.parentNode.updateFolderState()); 
			}
			);
		} else {
			return Promise.reject("createLocalFolder couldnt find root folder");
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
		// if (node.parentNode) {
		// 	this.updateFolderStateRecursive(node.parentNode);
		// }
	}

	private setNodeIsLoading(node:CompareNode,isLoading:boolean):void {
		node.isLoading = isLoading;
		this.nodeUpdated(node);
	}

	public async saveLocalFile(node:CompareNode,content:Buffer,newContent:Buffer) {
		if (Buffer.compare(content,newContent) !== 0) {
			this.setNodeIsLoading(node,false);
			await this.localModel.writeFileFromStream(node.localNode,newContent);
			await this.refreshJustThisFile(node);
			vscode.window.showInformationMessage(node.name + " uploaded");
		}
	}

	public async saveRemoteFile(node:CompareNode,content:Buffer,newContent:Buffer) {
		if (Buffer.compare(content,newContent) !== 0) {
			this.setNodeIsLoading(node,false);
			await this.remoteModel.writeFileFromStream(node.remoteNode,newContent);
			vscode.window.showInformationMessage(node.name + " uploaded");
		}
		await this.refreshJustThisFile(node);
	}
	public openDiff(node) {
		this.setNodeIsLoading(node,true);
		this.promiseQueue.addToQueue(async () => {
			try {
				if (node.localNode && node.remoteNode) {
					
					const [localUri,remoteUri] = await Promise.all([
						this.localModel.getUri(node.localNode,this.profileNode.workspaceFolder),
						this.remoteModel.getUri(node.remoteNode,this.profileNode.workspaceFolder)]);
						await Promise.all([
							this.localModel.openForEditor(node.localNode,this.saveLocalFile.bind(this,node)),
							this.remoteModel.openForEditor(node.remoteNode,this.saveRemoteFile.bind(this,node)),
						])
							this.setNodeIsLoading(node,false);
								
							vscode.commands.executeCommand("vscode.diff",localUri,remoteUri,  node.name + " <-> " + " Remote", { originalEditable:true, readOnly:false } );  
						
					
				} else if (node.localNode) {
					const uri = await this.localModel.getUri(node.localNode,this.profileNode.workspaceFolder);
					await this.localModel.openForEditor(node.localNode,this.saveLocalFile.bind(this,node));
					const doc = await vscode.workspace.openTextDocument(uri);
					await vscode.window.showTextDocument(doc);
		
				} else if (node.remoteNode) {
					const uri = await this.remoteModel.getUri(node.remoteNode,this.profileNode.workspaceFolder);
					await this.remoteModel.openForEditor(node.remoteNode,this.saveRemoteFile.bind(this,node));
					const doc = await vscode.workspace.openTextDocument(uri);
					await vscode.window.showTextDocument(doc);
		
				} else { throw "Orphan node."; }
			} catch(err) {
				vscode.window.showErrorMessage("Kirby FTP: " + err); 
				console.log(err); 
				this.setNodeIsLoading(node,false);
			} finally {
				this.setNodeIsLoading(node,false);
			}
		});
	}

	
}

