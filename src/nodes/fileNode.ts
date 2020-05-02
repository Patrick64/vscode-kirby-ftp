import { ExtensionContext, TreeDataProvider, EventEmitter, TreeItem, Event, window, TreeItemCollapsibleState, Uri, commands, workspace, TextDocumentContentProvider, CancellationToken, ProviderResult } from 'vscode';
import * as path from 'path';

export abstract class FileNode {
	protected _resource: Uri;
    protected _hash;

	constructor() {
		// var uri = `ftp://${host}${_parent}${entry.name}`;
		// this._resource = Uri.parse(uri);
	}

	public get resource(): Uri {
		return this._resource;
	}

	abstract get path(): string ;

	abstract get name(): string ;

	abstract get isFolder(): boolean ;

	abstract get dateLastModified(): Date;

    abstract get size(): number ;
    
    public set hash(h:string) {
        this._hash = h;
    }

    public get hash():string {
        return this._hash
    }

	/**
	 * Get size and modified date @see CompareNode::getSyncInfo
	 */
	public getSyncInfo() {
		return {
			size: this.size,
            modified: this.dateLastModified,
            hash: this.hash
		}
	}

	public isSyncInfoEqual(syncInfo) {
		return (syncInfo.size == this.size &&
			new Date(syncInfo.modified).toString() == new Date(this.dateLastModified).toString());
	}
}
