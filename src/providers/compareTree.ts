import { ExtensionContext, TreeDataProvider, EventEmitter, TreeItem, Event, window, TreeItemCollapsibleState, Uri, commands, workspace, TextDocumentContentProvider, CancellationToken, ProviderResult } from 'vscode';
import * as path from 'path';
import { IEntry } from '../models/ientry';
import { FtpModel } from '../models/ftpModel';
import { DiskModel } from '../models/diskModel';
import { setTimeout, setInterval } from 'timers';
import { CompareModel, CompareNode } from '../models/compareModel';

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