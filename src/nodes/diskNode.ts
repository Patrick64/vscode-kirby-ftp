import { ExtensionContext, TreeDataProvider, EventEmitter, TreeItem, Event, window, TreeItemCollapsibleState, Uri, commands, workspace, TextDocumentContentProvider, CancellationToken, ProviderResult } from 'vscode';
import * as path from 'path';

export class DiskNode {
	private _resource: Uri;

	constructor(private entry, private _parent: string) {
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
		return this.entry.name;
	}

	public get isFolder(): boolean {
		return this.entry.type === 'd' || this.entry.type === 'l';
	}

	public get dateLastModified(): Date {
		return this.entry.mtime;
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
}
