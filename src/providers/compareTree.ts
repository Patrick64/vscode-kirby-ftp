import { ExtensionContext, TreeDataProvider, EventEmitter, TreeItem, Event, window, TreeItemCollapsibleState, Uri, commands, workspace, TextDocumentContentProvider, CancellationToken, ProviderResult } from 'vscode';
import * as path from 'path';
import { IEntry } from '../models/ientry';
import { FtpModel } from '../models/ftpModel';
import { DiskModel } from '../models/diskModel';
import { setTimeout, setInterval } from 'timers';

enum CompareNodeState {
	loading,
	error,
	equal,
	conflict,
	localFile,
	remoteFile,
	unequal,
	remoteChanged,
	localChanged
}

export class CompareNode {

	private _resource: Uri;
	private children:CompareNode[] = [];
	private nodeState: CompareNodeState = CompareNodeState.loading;
	// private _rando:number;

	constructor(public localNode, public remoteNode, private _parent: string, private filename: string, private _isFolder: boolean) {
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

	

	public doComparison(remoteModel, localModel):Thenable<void> {
		return new Promise((resolve,reject) => {
			if (!this.localNode && !this.remoteNode) {
				this.nodeState = CompareNodeState.error;
				resolve();
			} else	if (!this.localNode) {
				this.nodeState = CompareNodeState.remoteFile;
				resolve();
			} else if (!this.remoteNode) {
				this.nodeState = CompareNodeState.localFile;
				resolve();
			} else if (this.localNode.size != this.remoteNode.size)  {
				this.nodeState = CompareNodeState.unequal;
				resolve();
			} else {
				setInterval( ()=>{  
					this.nodeState = CompareNodeState.equal;
					resolve(); 
				}, 1000 );
			}
			
		})
		
	}

	public get iconName(): string {

		switch (this.nodeState) {
			case CompareNodeState.loading: return 'loading'; break;
			case CompareNodeState.error: return 'error'; break;
			case CompareNodeState.equal: return 'equal'; break;
			case CompareNodeState.conflict: return 'conflict'; break;
			case CompareNodeState.localFile: return 'localFile'; break;
			case CompareNodeState.remoteFile: return 'remoteFile'; break;
			case CompareNodeState.unequal: return 'unequal'; break;
			case CompareNodeState.remoteChanged: return 'remoteChanged'; break;
			case CompareNodeState.localChanged: return 'localChange'; break;
		}

	}

	public addChildNode(child:CompareNode) {
		this.children.push(child);
	}

	public getChildNodes() {
		return this.children;
	}

}


export class CompareModel {
	
	private rootNode:CompareNode;
	private hasUserRequestedAPause: boolean = false;

	constructor(private localModel, private remoteModel, private nodeUpdated:Function) {
		this.rootNode = new CompareNode(null,null,"","root",true);
		this.refreshAll();
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


	public get roots(): Thenable<CompareNode[]> {
		// return this.getChildren(null);
		return Promise.resolve(this.rootNode.getChildNodes());
	}

	public refreshAll() {
		console.log('FTP refresall is started.');
		return this.connect()
			.then(() => { 
				return this.refreshNodeRecursively(this.rootNode); 
			}).then(this.disconnect.bind(this))
			.then(() => {
				console.log('FTP refresall is done.');

			}).catch(err => console.log(err));
	}

	public refreshNodeRecursively(node:CompareNode) {
		var isRootNode = (node == this.rootNode);
		var parentPath = !isRootNode ? node.path : "/";
		// if node is null then get root items, if it's not null then get all local items unless there's no localNode which means the directory doesnt exist locally
		var getLocalNodes = !isRootNode ? (node.localNode ? this.localModel.getChildren(node.localNode) : []) : this.localModel.roots;
		// same as above but remote
		var getRemoteNodes = !isRootNode ? (node.remoteNode ? this.remoteModel.getChildren(node.remoteNode) : []) : this.remoteModel.roots;
		// wait for promises
		
		return Promise.all([getLocalNodes,getRemoteNodes]).then(([localNodes,remoteNodes]) => {
			
				
				// now combine the local and remote nodes into a list of compareNodes which will be shown in the tree
				var remoteNodeByName = {},  localNodeByName = {};
				remoteNodes.forEach( n => { remoteNodeByName[n.name] = n; } );
				localNodes.forEach( n => { localNodeByName[n.name] = n; } );
				var compareNodes = localNodes.map(localNode => {
					var remoteNode = remoteNodeByName[localNode.name];
					if (remoteNode) {
						return new CompareNode(localNode,remoteNode,"/",localNode.name,localNode.isFolder);
					} else {
						return new CompareNode(localNode,null,"/",localNode.name,localNode.isFolder);
					}
				});
				remoteNodes.forEach(remoteNode => {
					if (!localNodeByName[remoteNode.name]) {
						compareNodes.push(new CompareNode(null,remoteNode,"/",remoteNode.name, remoteNode.isFolder));
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
						.then(resolve);
					} catch(err) {
						reject(err);
					}
					// ).then(resolve);
				},this.hasUserRequestedAPause || isRootNode ? 500 : 1);
				this.hasUserRequestedAPause=false;
				// },reject);
			}); // end promise
		}); // end then 
		
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


export class FtpTreeDataProvider implements TreeDataProvider<CompareNode>, TextDocumentContentProvider {

	private _onDidChangeTreeData: EventEmitter<any> = new EventEmitter<any>();
	readonly onDidChangeTreeData: Event<any> = this._onDidChangeTreeData.event;

	private model: CompareModel;
	private roots=[];
	private nodes={};

	public getTreeItem(element: CompareNode): TreeItem {
		return {
			label: element.name,
			collapsibleState: element.isFolder ? TreeItemCollapsibleState.Collapsed : void 0,
			command: element.isFolder ? void 0 : {
				command: 'openFtpResource',
				arguments: [element],
				title: 'Open FTP Resource'
			},
			iconPath: {
				light: element.isFolder ? path.join(__filename, '..', '..', '..', 'resources', 'light', element.iconName + '.svg') : path.join(__filename, '..', '..', '..', 'resources', 'light', element.iconName + '.svg'),
				dark: element.isFolder ? path.join(__filename, '..', '..', '..', 'resources', 'dark', element.iconName + '.svg') : path.join(__filename, '..', '..', '..', 'resources', 'dark', element.iconName + '.svg')
			}
		};
	}

	public getChildren(element?: CompareNode): CompareNode[] | Thenable<CompareNode[]> {
		if (!element) {
			if (!this.model) {
				// this.model = new CompareModel(new FtpModel('127.0.0.1', 'test', '123',4567), new FtpModel('127.0.0.1', 'test', '123',4567) );
				this.model = new CompareModel(
					new DiskModel("/home/patrick/junk/testftp_local"), 
					new FtpModel('127.0.0.1', 'test', '123',4567),
					this.nodeUpdated.bind(this) );	
			}
			// if (this.roots.length>0) 
			// 	return Promise.resolve(this.roots);
			// else {
				this.model.userRequestsPause();
				return this.model.roots.then((t) => { this.roots = t; return t; } );
			// }
		}
		this.model.userRequestsPause();
		return this.model.getChildren(element);
	}

	public nodeUpdated(node:CompareNode) {
		this._onDidChangeTreeData.fire(node);
	}

	public provideTextDocumentContent(uri: Uri, token: CancellationToken): ProviderResult<string> {
		return this.model.getContent(uri);
	}
}