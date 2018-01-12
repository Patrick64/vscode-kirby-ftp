import { CompareNode } from '../models/compareModel';

export interface ITreeNode {
    

	path: string;

    name: string;
    isFolder: boolean;
    iconName: string;
    updateFolderState();
    getChildNodes(): Thenable<ITreeNode[]>;
    contextValue:string;
    // uploadFile(compareNode:CompareNode);

	// downloadFile(compareNode:CompareNode);
	// uploadFolder(compareNode:CompareNode);
    // downloadFolder(compareNode:CompareNode);
    upload();
    download();

}