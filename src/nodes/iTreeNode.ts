import { CompareNodeState } from "../lib/compareNodeState";
import * as vscode from 'vscode'

export interface ITreeNode {
    
    resource: vscode.Uri;
	path: string;
    
    name: string;
    isFolder: boolean;
    isFailed:boolean;
    iconName: string;
    updateFolderState();
    getChildNodes(filterByStates?:CompareNodeState[] ): Promise<ITreeNode[]>;
    contextValue:string;
    hasChildren:boolean;
    isRootNode:boolean;

    openDiff?();
    // uploadFile(compareNode:CompareNode);

	// downloadFile(compareNode:CompareNode);
	// uploadFolder(compareNode:CompareNode);
    // downloadFolder(compareNode:CompareNode);
    upload();
    download();

}