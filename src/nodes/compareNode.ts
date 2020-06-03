import { ITreeNode } from '../nodes/iTreeNode';
import { ExtensionContext, TreeDataProvider, EventEmitter, TreeItem, Event, window, TreeItemCollapsibleState, Uri, commands, workspace, TextDocumentContentProvider, CancellationToken, ProviderResult } from 'vscode';
import { CompareModel } from '../models/compareModel'
import * as path from 'path';
import * as vscode from 'vscode';

import * as FileCompare from '../lib/fileCompare';
import { CompareNodeState, getCompareNodeStateString } from '../lib/compareNodeState';
import { timingSafeEqual } from 'crypto';
import { ISyncInfoNode } from '../interfaces/iSyncInfo';

import * as hasha from 'hasha';
import { FileNode } from './fileNode';



export class CompareNode implements ITreeNode {

	private _resource: Uri;
	public _children:CompareNode[] = [];
	private profiles:ITreeNode;
	public nodeState: CompareNodeState = CompareNodeState.unknown;
	public isLoading:boolean = false;
	private priorSyncInfoNode:ISyncInfoNode = null;
	/** if we couldn't connect to this node for some reson  */
	public isFailed:boolean = false; 
	/** tracks how complete the comparison process is:
	 * - none: No comparisons done
	 * - localOnly: The diretory has been scanned locally (local is usally disk so done first as its fastest)
	 * - comparing: The directory on local and remote has been scanned and found to different from
	 *   the stored database so its awaiting a full file comparison. 
	 *   if they had matched based on prior sync info it would have gone striaght to complete
	 * - complete:  All comparisons are complete so can be confident we've got the right node state
	*/
	private compareProgress: 'none' | 'localOnly' | 'comparing' | 'complete' = 'none';
//	contextValue = 'file';
	
	// private _rando:number;

	constructor(public localNode:FileNode | null, 
		public remoteNode:FileNode | null, 
		protected _parent: string, 
		protected filename: string, 
		protected _isFolder: boolean, 
		public parentNode: CompareNode, 
		public compareModel:CompareModel) {
		
			if (compareModel) {
				this.priorSyncInfoNode = compareModel.getSyncInfoForNode(this);
			} else {
			}
			var a=1;
			if (localNode) this.compareProgress = 'localOnly';
			if (remoteNode) this.compareProgress = 'comparing';
			
		
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

		if (this.compareProgress === 'none') this.compareProgress = 'localOnly';
	}

	public setRemoteNode(_remoteNode) {
		this.remoteNode = _remoteNode;
		if (this.compareProgress === 'none' || this.compareProgress === 'localOnly') {
			this.compareProgress = 'comparing';
		}
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


	public async doComparison(localModel, remoteModel, priorSyncInfoNode:ISyncInfoNode = null):Promise<void> {
		//if (priorSyncInfoNode) this.priorSyncInfoNode = priorSyncInfoNode;
		if (this.localNode && this.priorSyncInfoNode?.local?.hash) this.localNode.hash = this.priorSyncInfoNode.local.hash;
		if (this.remoteNode && this.priorSyncInfoNode?.remote?.hash) this.remoteNode.hash = this.priorSyncInfoNode.remote.hash;
		
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
		} else if (this.priorSyncInfoNode && this.isSyncInfoEqual(this.priorSyncInfoNode)) {
			// both local and remote files haven't changed since we last looked 
			// so use the state we recorded then to save time
			this.nodeState = this.priorSyncInfoNode.nodeState;
		} else if (!this.priorSyncInfoNode || !this.isSyncInfoEqual(this.priorSyncInfoNode)) {
			const {isEqual, localHash, remoteHash} = await this.doFullFileComparison(localModel, remoteModel);
			this.localNode.hash = localHash;
			this.remoteNode.hash = remoteHash;
			const localHashSame = (this.priorSyncInfoNode?.local?.hash && this.priorSyncInfoNode.local.hash == localHash )
			const remoteHashSame = (this.priorSyncInfoNode?.remote?.hash && this.priorSyncInfoNode.remote.hash == remoteHash )
			const priorNodeState = this.priorSyncInfoNode.nodeState;
			if (isEqual) {
				this.nodeState = CompareNodeState.equal;
			} else if (localHashSame && remoteHashSame) {
				this.nodeState = this.priorSyncInfoNode.nodeState;
			} else if (localHashSame && (priorNodeState === CompareNodeState.equal || priorNodeState === CompareNodeState.remoteChanged)) {
				this.nodeState = CompareNodeState.remoteChanged;
			} else if (remoteHashSame && (priorNodeState === CompareNodeState.equal || priorNodeState === CompareNodeState.localChanged)) {
				this.nodeState = CompareNodeState.localChanged;
			} else {
				this.nodeState = CompareNodeState.unequal;
			}

			// } else if (this.priorSyncInfoNode.nodeState == CompareNodeState.equal || this.priorSyncInfoNode.nodeState == CompareNodeState.localChanged) {
			// 	this.nodeState = CompareNodeState.localChanged;
			// } else if (this.priorSyncInfoNode.nodeState == CompareNodeState.remoteChanged && this.priorSyncInfoNode?.local?.hash && this.priorSyncInfoNode.local.hash == localHash ) {
			// 	// previous state has remote changed and sure, the local node's date modified has changed but it's 
			// 	// still the same file and the hashes are the same. This will happen if the user saves a file in the diff
			// 	// view as it saves both files.
			// 	this.nodeState = CompareNodeState.remoteChanged;
			// } else {
			// 	this.nodeState = CompareNodeState.unequal;
			// }
		
		// } else if (this.priorSyncInfoNode && this.isSyncInfoShowLocalHasChanged(this.priorSyncInfoNode)) {
		// 	const {isEqual, localHash, remoteHash} = await this.doFullFileComparison(localModel, remoteModel);
		// 	this.localNode.hash = localHash;
		// 	this.remoteNode.hash = remoteHash;
		// 	if (isEqual) {
		// 		this.nodeState = CompareNodeState.equal;
		// 	} else if (this.priorSyncInfoNode.nodeState == CompareNodeState.equal || this.priorSyncInfoNode.nodeState == CompareNodeState.localChanged) {
		// 		this.nodeState = CompareNodeState.localChanged;
		// 	} else if (this.priorSyncInfoNode.nodeState == CompareNodeState.remoteChanged && this.priorSyncInfoNode?.local?.hash && this.priorSyncInfoNode.local.hash == localHash ) {
		// 		// previous state has remote changed and sure, the local node's date modified has changed but it's 
		// 		// still the same file and the hashes are the same. This will happen if the user saves a file in the diff
		// 		// view as it saves both files.
		// 		this.nodeState = CompareNodeState.remoteChanged;
		// 	} else {
		// 		this.nodeState = CompareNodeState.unequal;
		// 	}
		// } else if (this.priorSyncInfoNode && this.isSyncInfoShowRemoteHasChanged(this.priorSyncInfoNode)) {
		// 	const {isEqual, localHash, remoteHash} = await this.doFullFileComparison(localModel, remoteModel);
		// 	this.localNode.hash = localHash;
		// 	this.remoteNode.hash = remoteHash;
		// 	if (isEqual) {
		// 		this.nodeState = CompareNodeState.equal;
		// 	} else if (this.priorSyncInfoNode.nodeState == CompareNodeState.equal || this.priorSyncInfoNode.nodeState == CompareNodeState.remoteChanged) {
		// 		this.nodeState = CompareNodeState.remoteChanged;
		// 	} else if (this.priorSyncInfoNode.nodeState == CompareNodeState.localChanged && this.priorSyncInfoNode?.local?.hash && this.priorSyncInfoNode.local.hash == remoteHash ) {
		// 		// previous state has remote changed and sure, the local node's date modified has changed but it's 
		// 		// still the same file and the hashes are the same. This will happen if the user saves a file in the diff
		// 		// view as it saves both files.
		// 		this.nodeState = CompareNodeState.localChanged;
		// 	} else {
		// 		this.nodeState = CompareNodeState.unequal;
		// 	}
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
		this.compareProgress = 'complete';
		this.setPriorSyncInfoNode();
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

	private isSyncInfoShowBothHasChanged(priorSyncInfoNode:ISyncInfoNode) {
		return (!priorSyncInfoNode.isFolder 
		&& priorSyncInfoNode.local 
		&& priorSyncInfoNode.remote 
		&& !this.localNode.isSyncInfoEqual(priorSyncInfoNode.local)
		&& !this.remoteNode.isSyncInfoEqual(priorSyncInfoNode.remote));
	}

	private doFullFileComparison(localModel, remoteModel):Promise<{isEqual:boolean,localHash:string,remoteHash:string}> {
		vscode.window.setStatusBarMessage("Kirby FTP: Comparing " + this.name);
			
		return Promise.all([localModel.getBuffer(this.localNode),remoteModel.getBuffer(this.remoteNode)])
			.then(([localBuffer, remoteBuffer]) => {
				return {
					isEqual:FileCompare.compareBuffers(localBuffer,remoteBuffer),
					localHash: hasha(localBuffer),
					remoteHash: hasha(remoteBuffer)
				};
				// return streamEqual(localStream, remoteStream).then((isEqual) => { localStream.destroy(); remoteStream.destroy(); return isEqual;});
			})
	}

	/** useful for knowing when to show the state of a folder */
	public hasCompareFinished():boolean {
		return this.compareProgress === 'complete';
	}

	public setFolderHasRefreshed(isLocal:boolean) {
		if (this.compareProgress === 'none' && isLocal) {
			this.compareProgress = 'localOnly';
		} else if (this.compareProgress !== 'complete') {
			this.compareProgress = 'comparing';
		}
	}

	/** the folder has completed all comparisons including subfolders and files */
	public setFolderHasCompletedComparison() {
		this.compareProgress = 'complete';
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

	/**
	 * Recursively update the states of folders
	 */
	public updateFolderState() {
		if (this.isFolder) {
			var newState:CompareNodeState = CompareNodeState.equal;
			if (!this.hasCompareFinished()) {
				newState = CompareNodeState.unknown;
			} else if (!this.localNode && !this.remoteNode) {
				newState = CompareNodeState.error;
			} else	if (!this.localNode) {
				newState = CompareNodeState.remoteOnly;
			} else if (!this.remoteNode) {
				newState = CompareNodeState.localOnly;
			} else if (this.children.length==0) {
				newState = CompareNodeState.equal;
			} else {
				var states = this.children.reduce((states: CompareNodeState[], childNode: CompareNode) => {
					if (!childNode.hasCompareFinished()) {
						states.push(CompareNodeState.unknown);
					} else {
						if (states.indexOf(childNode.nodeState)==-1) states.push(childNode.nodeState)
					}
					return states;
					// if (childNode.nodeState > newState) return childNode.nodeState; else return newState;
					// if (newState == CompareNodeState.equal)
				}, []);
				if (states.indexOf(CompareNodeState.unknown)!=-1)
					newState = CompareNodeState.unknown;
				else if (states.indexOf(CompareNodeState.error)!=-1)
					newState = CompareNodeState.error;
				else if (states.indexOf(CompareNodeState.conflict) != -1 || states.indexOf(CompareNodeState.unequal) != -1)
					newState = CompareNodeState.unequal;
				else if ((states.indexOf(CompareNodeState.localOnly) != -1 || states.indexOf(CompareNodeState.localChanged) != -1) &&
					(states.indexOf(CompareNodeState.remoteOnly) == -1 || states.indexOf(CompareNodeState.remoteChanged) == -1)) 
					newState = CompareNodeState.localChanged;
				else if ((states.indexOf(CompareNodeState.remoteOnly) != -1 || states.indexOf(CompareNodeState.remoteChanged) != -1) &&
					(states.indexOf(CompareNodeState.localOnly) == -1 || states.indexOf(CompareNodeState.localChanged) == -1)) 
					newState = CompareNodeState.remoteChanged;
				else if (states.length==0 || (states.length==1 && states[0] == CompareNodeState.equal))
					newState = CompareNodeState.equal;
				else
					newState = CompareNodeState.bothChanged;
				

			}

			this.nodeState = newState;
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
			this.setPriorSyncInfoNode();
			return this.priorSyncInfoNode;
			
		}
		
	}

	private setPriorSyncInfoNode() {
		if (this.isFolder) throw "files only";
		this.priorSyncInfoNode = {
			nodeState: this.nodeState,
			isFolder:false,
			local: this.localNode ? this.localNode.getSyncInfo() : null,
			remote: this.remoteNode ? this.remoteNode.getSyncInfo() : null
		};
	}

	/**
	 * Get all parents  as array
	 */
	public getParentNodes():CompareNode[] {
		if (this.parentNode && typeof this.parentNode ) {
			return [...this.parentNode.getParentNodes(),this.parentNode];
		} else {
			return [];
		}
	}
}

