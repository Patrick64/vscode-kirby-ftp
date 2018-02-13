import { ExtensionContext, TreeDataProvider, EventEmitter, TreeItem, Event, window, TreeItemCollapsibleState, Uri, commands, workspace, TextDocumentContentProvider, CancellationToken, ProviderResult } from 'vscode';
import * as path from 'path';
import { IEntry } from '../models/ientry';
import { FtpModel } from '../models/ftpModel';
import { DiskModel } from '../models/diskModel';
import { setTimeout, setInterval } from 'timers';
import { CompareModel, CompareNode } from '../models/compareModel';
import { ITreeNode } from '../nodes/iTreeNode';
import { ProfileNode } from '../nodes/profileNode';
import { ISettings } from '../modules/config';

export class FtpTreeDataProvider implements TreeDataProvider<ITreeNode> {

	private _onDidChangeTreeData: EventEmitter<any> = new EventEmitter<any>();
	readonly onDidChangeTreeData: Event<any> = this._onDidChangeTreeData.event;

	// private model: CompareModel;
	private profileNodes: ProfileNode[] = [];
	private roots=[];
	private nodes={};

	public loadSettingsProfiles(profiles:ISettings[]) {
		try {
			this.profileNodes = profiles.map(p => new ProfileNode(p,this.nodeUpdated.bind(this)) );
			this.nodeUpdated(null); 
			return Promise.all(this.profileNodes.map(n => n.connect().then(() => n.refreshAll()).then(() => {this.nodeUpdated(null); })));
		} catch (err) {
			console.log(err);
			
		}
	}

	public getTreeItem(element: ITreeNode): TreeItem {
		var collapsibleState = void 0;
		if (element.isFolder && element.hasChildren) {
			collapsibleState = element.isRootNode ? TreeItemCollapsibleState.Expanded : TreeItemCollapsibleState.Collapsed;
		}
		return {
			label: element.name,
			collapsibleState: collapsibleState,
			command: element.isFolder ? void 0 : {
				command: 'kirby.openFile',
				arguments: [element],
				title: 'Kirby FTP: Open'
			},
			iconPath: {
				light: element.isFolder ? path.join(__filename, '..', '..', '..', 'resources', 'light', element.iconName + '.svg') : path.join(__filename, '..', '..', '..', 'resources', 'light', element.iconName + '.svg'),
				dark: element.isFolder ? path.join(__filename, '..', '..', '..', 'resources', 'dark', element.iconName + '.svg') : path.join(__filename, '..', '..', '..', 'resources', 'dark', element.iconName + '.svg')
			},
			contextValue: element.contextValue
		};
	}

	public getChildren(element?: ITreeNode): ITreeNode[] | Thenable<ITreeNode[]> {
		this.profileNodes.forEach((p) => { p.userRequestsPause(); });
		if (!element) {
			return Promise.resolve(this.profileNodes);
				
				// this.model = new CompareModel(new FtpModel('127.0.0.1', 'test', '123',4567), new FtpModel('127.0.0.1', 'test', '123',4567) );
				// this.model = new CompareModel(
				// 	new DiskModel("/home/patrick/junk/testftp_local"), 
				// 	new FtpModel('127.0.0.1', 'test', '123',4567),
				// 	this.nodeUpdated.bind(this) );	
			
			// if (this.roots.length>0) 
			// 	return Promise.resolve(this.roots);
			// else {
				 
				// return this.model.roots.then((t) => { this.roots = t; return t; } );
			// }
		} else {
			return element.getChildNodes();
			// return this.model.getChildren(element);
		}
	}

	

	public nodeUpdated(node:ITreeNode) {
		this._onDidChangeTreeData.fire(node);
	}

	// public provideTextDocumentContent(uri: Uri, token: CancellationToken): ProviderResult<string> {
	// public provideTextDocumentContent(uri: Uri, token: CancellationToken) {
		// return this.model.getContent(uri);
	// }

	public refresh() {
		// if (this.model) {
		// 	this.model.refreshAll();
		// }
	}
}