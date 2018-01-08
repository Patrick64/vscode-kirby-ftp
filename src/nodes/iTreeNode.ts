

export interface ITreeNode {
    

	path: string;

    name: string;
    isFolder: boolean;
    iconName: string;
    updateFolderState();
    getChildNodes(): Thenable<ITreeNode[]>;

}