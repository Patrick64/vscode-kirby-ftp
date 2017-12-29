import { ExtensionContext, TreeDataProvider, EventEmitter, TreeItem, Event, window, TreeItemCollapsibleState, Uri, commands, workspace, TextDocumentContentProvider, CancellationToken, ProviderResult } from 'vscode';
import * as path from 'path';
import { IEntry } from '../models/ientry';
import { FtpModel } from '../models/ftpModel';
import { DiskModel } from '../models/diskModel';



export class CompareNode {

	private _resource: Uri;

	constructor(public localNode, public remoteNode, private _parent: string, private filename: string, private _isFolder: boolean) {
		// var uri = `ftp://${host}${_parent}${entry.name}`;
		// this._resource = Uri.parse(uri);
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

}


export class CompareModel {

	constructor(private localModel, private remoteModel) {
	}

	public connect() {
		return Promise.all([this.localModel.connect(), this.remoteModel.connect()]);
	
	}

	public get roots(): Thenable<CompareNode[]> {
		return this.getChildren(null);
	}

	public getChildren(node: CompareNode): Thenable<CompareNode[]> {
		var parentPath = node ? node.path : "/";
		// if node is null then get root items, if it's not null then get all local items unless there's no localNode which means the directory doesnt exist locally
		var getLocalNodes = node ? (node.localNode ? this.localModel.getChildren(node.localNode) : []) : this.localModel.roots;
		// same as above but remote
		var getRemoteNodes = node ? (node.remoteNode ? this.remoteModel.getChildren(node.remoteNode) : []) : this.remoteModel.roots;
		// wait for promises
		return Promise.all([getLocalNodes,getRemoteNodes]).then(
			([localNodes,remoteNodes]) => {
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
				return compareNodes;
			}
		)
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
				light: element.isFolder ? path.join(__filename, '..', '..', '..', 'resources', 'light', 'folder.svg') : path.join(__filename, '..', '..', '..', 'resources', 'light', 'document.svg'),
				dark: element.isFolder ? path.join(__filename, '..', '..', '..', 'resources', 'dark', 'folder.svg') : path.join(__filename, '..', '..', '..', 'resources', 'dark', 'document.svg')
			}
		};
	}

	public getChildren(element?: CompareNode): CompareNode[] | Thenable<CompareNode[]> {
		if (!element) {
			if (!this.model) {
				// this.model = new CompareModel(new FtpModel('127.0.0.1', 'test', '123',4567), new FtpModel('127.0.0.1', 'test', '123',4567) );
				this.model = new CompareModel(new DiskModel("/home/patrick/junk/testftp_local"), new FtpModel('127.0.0.1', 'test', '123',4567) );	
			}

			return this.model.roots;
		}

		return this.model.getChildren(element);
	}

	public provideTextDocumentContent(uri: Uri, token: CancellationToken): ProviderResult<string> {
		return this.model.getContent(uri);
	}
}