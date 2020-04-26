import { ExtensionContext, TreeDataProvider, EventEmitter, TreeItem, Event, window, TreeItemCollapsibleState, Uri, commands, workspace, TextDocumentContentProvider, CancellationToken, ProviderResult, WorkspaceFolder } from 'vscode';

import * as path from 'path';

export class FtpNode {
	private _resource: Uri;

	constructor(private entry, private host: string, private _parent: string) {
		var uri = `kirby://${host}${_parent}${entry.name}`;
		this._resource = Uri.parse(uri);
	}

	public get resource(): Uri {
		return this._resource;
	}

	public get path(): string {
		return path.join(this._parent, this.name);
	}

	public get name(): string {
		return this.entry.name;
	}

	public get isFolder(): boolean {
		return this.entry.type === 'd' || this.entry.type === 'l';
	}

	public get dateLastModified(): Date {
		return this.entry.date;
	}

	public get size(): number {
		return this.entry.size;
	}

	/**
	 * Get size and modified date @see CompareNode::getSyncInfo
	 */
	public getSyncInfo() {
		return {
			size: this.size,
			modified: this.dateLastModified
		}
	}

	public isSyncInfoEqual(syncInfo) {
		return (syncInfo.size == this.size && 
			new Date(syncInfo.modified).toString() == new Date(this.dateLastModified).toString());
			
	}
}