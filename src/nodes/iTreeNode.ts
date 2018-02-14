

export interface ITreeNode {
    

	path: string;

    name: string;
    isFolder: boolean;
    iconName: string;
    updateFolderState();
    getChildNodes(): Promise<ITreeNode[]>;
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