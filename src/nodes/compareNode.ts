import { ITreeNode } from '../nodes/iTreeNode';
import { ExtensionContext, TreeDataProvider, EventEmitter, TreeItem, Event, window, TreeItemCollapsibleState, Uri, commands, workspace, TextDocumentContentProvider, CancellationToken, ProviderResult } from 'vscode';
import { CompareModel } from '../models/compareModel'
import * as path from 'path';
import * as vscode from 'vscode';

import * as FileCompare from '../lib/fileCompare';
import { CompareNodeState, getCompareNodeStateString } from '../lib/compareNodeState';
import { timingSafeEqual } from 'crypto';
import { ISyncInfoNode } from '../interfaces/iSyncInfo';




export class CompareNode implements ITreeNode {

	private _resource: Uri;
	public _children:CompareNode[] = [];
	private profiles:ITreeNode;
	public nodeState: CompareNodeState = CompareNodeState.unknown;
	public isLoading:boolean = false;
	
	/** if we couldn't connect to this node for some reson  */
	public isFailed:boolean = false; 
	
//	contextValue = 'file';
	
	// private _rando:number;

	constructor(public localNode, 
		public remoteNode, 
		protected _parent: string, 
		protected filename: string, 
		protected _isFolder: boolean, 
		public parentNode: CompareNode, 
		public compareModel:CompareModel) {
		
		
		
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

	public get children() {
		return this._children;
	}

	public set children(c) {
		c = this._children;
	}

	public get contextValue():string {

		if (this.isFolder) 
			return 'folder_' + getCompareNodeStateString(this.nodeState);
		else 
			return 'file_' + getCompareNodeStateString(this.nodeState);
	}

	public upload() {
		if (this.isFolder) {
			return this.compareModel.uploadFolder(this);
		} else {
			return this.compareModel.uploadFile(this).catch(err => {
				console.log(err);
				vscode.window.showErrorMessage("Upload of " + this.name + " failed: " + err);
			});
		}
	}


	public download() {
		if (this.isFolder) {
			return this.compareModel.downloadFolder(this);
		} else {
			return this.compareModel.downloadFile(this);
		}
	}


	public async doComparison(localModel, remoteModel, priorSyncInfoNode:ISyncInfoNode):Promise<void> {
		try {
		if (this.isFolder) {
			this.nodeState = CompareNodeState.unknown; // leave until updateFolderState is called.
        } else if (!this.localNode && !this.remoteNode) {
            this.nodeState = CompareNodeState.error;
        } else	if (!this.localNode) {
			this.nodeState = CompareNodeState.remoteOnly;
        } else if (!this.remoteNode) {
            this.nodeState = CompareNodeState.localOnly;
        } else if (this.isFolder) {
			this.nodeState = CompareNodeState.unknown; // leave until updateFolderState is called.
		} else if (this.isSyncInfoEqual(priorSyncInfoNode)) {
			// both local and remote files haven't changed since we last looked 
			// so use the state we recorded then to save time
			this.nodeState = priorSyncInfoNode.nodeState;
		} else if (this.isSyncInfoShowLocalHasChanged(priorSyncInfoNode)) {
			const isEqual = await this.doFullFileComparison(localModel, remoteModel);
			if (isEqual) {
				this.nodeState = CompareNodeState.equal;
			} else if (priorSyncInfoNode.nodeState == CompareNodeState.equal || priorSyncInfoNode.nodeState == CompareNodeState.localChanged) {
				this.nodeState = CompareNodeState.localChanged;
			} else {
				this.nodeState = CompareNodeState.unequal;
			}
		} else if (this.isSyncInfoShowRemoteHasChanged(priorSyncInfoNode)) {
			const isEqual = await this.doFullFileComparison(localModel, remoteModel);
			if (isEqual) {
				this.nodeState = CompareNodeState.equal;
			} else if (priorSyncInfoNode.nodeState == CompareNodeState.equal || priorSyncInfoNode.nodeState == CompareNodeState.remoteChanged) {
				this.nodeState = CompareNodeState.remoteChanged;
			} else {
				this.nodeState = CompareNodeState.unequal;
			}
        } else if (this.localNode.size != this.remoteNode.size)  {
            this.nodeState = CompareNodeState.unequal;
        } else {
            // setInterval( ()=>{  
			vscode.window.setStatusBarMessage("Kirby FTP: Comparing " + this.name);
			const isEqual = await this.doFullFileComparison(localModel, remoteModel);
			
				// localModel.closeStream();
				// remoteModel.closeStream();
			this.nodeState = isEqual ? CompareNodeState.equal : CompareNodeState.unequal;
			
            // }, 1000 );
		}
	} catch(err) {
		this.nodeState = CompareNodeState.error;
		throw (err);
	}
        
    
		
	}

	private isSyncInfoEqual(priorSyncInfoNode:ISyncInfoNode) {
		return (!priorSyncInfoNode.isFolder 
		&& priorSyncInfoNode.local 
		&& priorSyncInfoNode.remote 
		&& this.localNode.isSyncInfoEqual(priorSyncInfoNode.local)
		&& this.remoteNode.isSyncInfoEqual(priorSyncInfoNode.remote));
	}
	

	private isSyncInfoShowRemoteHasChanged(priorSyncInfoNode:ISyncInfoNode) {
		return (!priorSyncInfoNode.isFolder 
		&& priorSyncInfoNode.local 
		&& priorSyncInfoNode.remote 
		&& this.localNode.isSyncInfoEqual(priorSyncInfoNode.local)
		&& !this.remoteNode.isSyncInfoEqual(priorSyncInfoNode.remote));
	}

	private isSyncInfoShowLocalHasChanged(priorSyncInfoNode:ISyncInfoNode) {
		return (!priorSyncInfoNode.isFolder 
		&& priorSyncInfoNode.local 
		&& priorSyncInfoNode.remote 
		&& !this.localNode.isSyncInfoEqual(priorSyncInfoNode.local)
		&& this.remoteNode.isSyncInfoEqual(priorSyncInfoNode.remote));
	}


	private doFullFileComparison(localModel, remoteModel):Promise<boolean> {
		return Promise.all([localModel.getBuffer(this.localNode),remoteModel.getBuffer(this.remoteNode)])
			.then(([localBuffer, remoteBuffer]) => {
				return FileCompare.compareBuffers(localBuffer,remoteBuffer);
				// return streamEqual(localStream, remoteStream).then((isEqual) => { localStream.destroy(); remoteStream.destroy(); return isEqual;});
			})
	}

	public openDiff() {
		this.compareModel.openDiff(this);
	}

	public get iconName(): string {
		if (this.isLoading) return 'loading';
		if (this.isFailed) return 'error';
		if (this.isFolder) {
			// if (!this.localNode && !this.remoteNode) {
			// 	return 'error';
			// } else	if (!this.localNode) {
			// 	return 'folder-remote';
			// } else if (!this.remoteNode) {
			// 	return 'folder-local';
			// } else {
				switch (this.nodeState) {
					case CompareNodeState.unknown: return 'loading'; 
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
			case CompareNodeState.unknown: return 'loading'; 
			case CompareNodeState.error: return 'error'; 
			case CompareNodeState.equal: return 'equal'; 
			case CompareNodeState.conflict: return 'conflict'; 
			case CompareNodeState.localOnly: return 'file-local'; 
			case CompareNodeState.remoteOnly: return 'file-remote'; 
			case CompareNodeState.unequal: return 'unequal'; 
			case CompareNodeState.remoteChanged: return 'remoteChanged'; 
			case CompareNodeState.localChanged: return 'localChanged'; 
		}

	}

	public addChildNode(child:CompareNode) {
		this.children.push(child);
	}

	public async getChildNodes(filterByStates?:CompareNodeState[]) {
		return this.compareModel.sort(this.compareModel.filterByStates(filterByStates,this.children));
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
			if (states.indexOf(CompareNodeState.unknown)!=-1)
				this.nodeState = CompareNodeState.unknown;
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

	/**
	 * Get info about file for storage in database
	 * This is so we know the date modified and size of all files (on ftp and on disk) so we
	 * can then know if a file has been modified on remote or locally and then can safely sync the 
	 * file without losing anything
	 */
	public getSyncInfoNode():ISyncInfoNode {
		if (this.isFolder) {
			return {
				nodeState: this.nodeState,
				isFolder:true,
				// get object of all child items
				children: this.children.reduce((list,node) => {
					list[node.name] = node.getSyncInfoNode();
					return list;
				},{})
			}

		} else {
			
			return {
				nodeState: this.nodeState,
				isFolder:false,
				local: this.localNode ? this.localNode.getSyncInfo() : null,
				remote: this.remoteNode ? this.remoteNode.getSyncInfo() : null
			};
			
		}
		
	}

}

