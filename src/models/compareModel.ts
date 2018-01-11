import { ExtensionContext, TreeDataProvider, EventEmitter, TreeItem, Event, window, TreeItemCollapsibleState, Uri, commands, workspace, TextDocumentContentProvider, CancellationToken, ProviderResult } from 'vscode';
import * as path from 'path';
import { setTimeout, setInterval } from 'timers';
import { ITreeNode } from '../nodes/iTreeNode';
import * as vscode from 'vscode';

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
	private children:CompareNode[] = [];
	private profiles:ITreeNode;
	public nodeState: CompareNodeState = CompareNodeState.loading;

//	contextValue = 'file';
	
	// private _rando:number;

	constructor(public localNode, public remoteNode, private _parent: string, private filename: string, private _isFolder: boolean, private parentNode: ITreeNode, public model:CompareModel) {
		
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

	public get contextValue():string {
		if (this.isFolder) 
			return 'folder_' + getCompareNodeStateString(this.nodeState);
		else 
			return 'file_' + getCompareNodeStateString(this.nodeState);
	}

	


	public doComparison(localModel, remoteModel):Thenable<void> {
		
        if (!this.localNode && !this.remoteNode) {
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
            return Promise.all([localModel.getContentFromNode(this.localNode),remoteModel.getContentFromNode(this.remoteNode)]).then(([localText,remoteText]) => {
                if (localText == remoteText) {
                    this.nodeState = CompareNodeState.equal;
                } else {
                    this.nodeState = CompareNodeState.unequal;
                } 
            }).catch((err)=>{
                this.nodeState = CompareNodeState.error;
                console.error(err);
            });
                
                
            // }, 1000 );
        }
        return Promise.resolve();
    
		
	}

	public get iconName(): string {

		if (this.isFolder) {
			if (!this.localNode && !this.remoteNode) {
				return 'error';
			} else	if (!this.localNode) {
				return 'folder-remote';
			} else if (!this.remoteNode) {
				return 'folder-local';
			} else {
				switch (this.nodeState) {
					case CompareNodeState.loading: return 'loading'; 
					case CompareNodeState.error: return 'error'; 
					case CompareNodeState.equal: return 'folder-equal'; 
					case CompareNodeState.conflict: return 'folder-conflict'; 
					case CompareNodeState.localOnly: return 'folder-changed'; 
					case CompareNodeState.remoteOnly: return 'folder-changed'; 
					case CompareNodeState.unequal: return 'folder-conflict'; 
					case CompareNodeState.remoteChanged: return 'folder-changed'; 
					case CompareNodeState.localChanged: return 'folder-changed'; 
				}
			}
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
		return Promise.resolve(this.children);
	}

	public updateFolderState() {
		var newState:CompareNodeState = null;
		if (!this.localNode && !this.remoteNode) {
            this.nodeState = CompareNodeState.error;
        } else	if (!this.localNode) {
            this.nodeState = CompareNodeState.remoteOnly;
        } else if (!this.remoteNode) {
			this.nodeState = CompareNodeState.localOnly;
		} else if (this.children.length==0) {
			this.nodeState = CompareNodeState.equal;
		} else {
			this.nodeState = this.children.reduce((newState: CompareNodeState, childNode: CompareNode) => {
				if (childNode.nodeState > newState) return childNode.nodeState; else return newState;
			}, 0);
		}
		if (this._parent) this.parentNode.updateFolderState();
	}

}


export class CompareModel {
	
	private rootNode:CompareNode;
	private hasUserRequestedAPause: boolean = false;
	
	constructor(private localModel, private remoteModel, private nodeUpdated:Function) {
		this.rootNode = new CompareNode(null,null,"","root",true,null, this);
		//this.refreshAll();
		// setInterval( () => { this.nodeUpdated(null); }, 1000);

	}

	public connect() {
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
				return this.refreshNodeRecursively(this.rootNode); 
			}).then(this.disconnect.bind(this))
			.then(() => {
				console.log('FTP refresall is done.');
				vscode.window.setStatusBarMessage("Kirby FTP: Finished refreshing files list");
			}).catch(err => {
				console.log(err)
				vscode.window.showErrorMessage("Kirby FTP: " + err);
			});
	}

	public refreshNodeRecursively(node:CompareNode, retries = 0) {
		var isRootNode = (node == this.rootNode);
		var parentPath = !isRootNode ? node.path : "/";
		// if node is null then get root items, if it's not null then get all local items unless there's no localNode which means the directory doesnt exist locally
		var getLocalNodes = !isRootNode ? (node.localNode ? this.localModel.getChildren(node.localNode) : []) : this.localModel.roots;
		// same as above but remote
		var getRemoteNodes = !isRootNode ? (node.remoteNode ? this.remoteModel.getChildren(node.remoteNode) : []) : this.remoteModel.roots;
		// wait for promises
		vscode.window.setStatusBarMessage("Kirby FTP: Scanning folder " + node.name);
		return Promise.all([getLocalNodes,getRemoteNodes]).then(([localNodes,remoteNodes]) => {
			
				
				// now combine the local and remote nodes into a list of compareNodes which will be shown in the tree
				var remoteNodeByName = {},  localNodeByName = {};
				remoteNodes.forEach( n => { remoteNodeByName[n.name] = n; } );
				localNodes.forEach( n => { localNodeByName[n.name] = n; } );
				var compareNodes = localNodes.map(localNode => {
					var remoteNode = remoteNodeByName[localNode.name];
					if (remoteNode) {
						return new CompareNode(localNode,remoteNode,"/",localNode.name,localNode.isFolder,node,this);
					} else {
						return new CompareNode(localNode,null,"/",localNode.name,localNode.isFolder,node,this);
					}
				});
				remoteNodes.forEach(remoteNode => {
					if (!localNodeByName[remoteNode.name]) {
						compareNodes.push(new CompareNode(null,remoteNode,"/",remoteNode.name, remoteNode.isFolder,node,this));
					}
				});
				compareNodes = compareNodes.sort((l,r) => {
					if (l.name == r.name) return 0;
					if (l.isFolder == r.isFolder) return l.name < r.name ? -1 : 1;
					return l.isFolder ? -1 : 1; 
				});
				// compareNodes.forEach(n => { setInterval(() => { this.nodeUpdated(n); },1000) });
				// return compareNodes;

				// add children to node
				compareNodes.forEach( newNode => { node.addChildNode(newNode); });
				
				// tell vscode that this node has updated
				this.nodeUpdated(isRootNode ? null : node);
				
				return compareNodes.reduce( (p:Thenable<void>,n:CompareNode) => {
					return p.then(() => { return n.doComparison(this.localModel,this.remoteModel); } );
				}, Promise.resolve() ).then(() => { 
					// tell vscode that this node has updated
					this.nodeUpdated(isRootNode ? null : node);
					
					return compareNodes;
				});


				

			
		}).then( (compareNodes:CompareNode[]) => {
			return new Promise((resolve,reject) => {
				// recursivly get nodes in folders
				// process.nextTick(() => {
				setTimeout(()=>{
					// Promise.all(
					try {
						compareNodes
						.filter(n => n.isFolder)
						.reduce( (p:any,folderNode:CompareNode) => {
							return p.then(() => { return this.refreshNodeRecursively(folderNode) } );
						}, Promise.resolve() )
						.then(() => {
							// we've finished with updating the folders so look at the children to see what state the folder is
							if (node.isFolder) {
								node.updateFolderState();
								this.nodeUpdated(node);
							}
					 	})
						.then(resolve);
					} catch(err) {
						reject(err);
					}
					// ).then(resolve);
				},this.hasUserRequestedAPause || isRootNode ? 500 : 1);
				this.hasUserRequestedAPause=false;
				// },reject);
			}); // end promise
		}) // end then 
		.catch(err => {
			console.error(err)
			if (retries<5) 
				this.refreshNodeRecursively(node,retries+1);
			else
				vscode.window.showErrorMessage("Remote listing failed." );
		});
		
	}

	public getChildren(node: CompareNode): Thenable<CompareNode[]> {
		return Promise.resolve(node.getChildNodes());
		
	}

	private sort(nodes: CompareNode[]): CompareNode[] {
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
}

