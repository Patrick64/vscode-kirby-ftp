import { getAllProfiles, ISettings } from "../modules/config";
import { ProfileNode } from "../nodes/profileNode";
import * as vscode from 'vscode';
import { FtpTreeDataProvider } from "../providers/compareTree";
import { ITreeNode } from "../nodes/iTreeNode";

export class MainController {

    private profileNodes: ProfileNode[] = [];
    private allTrees:FtpTreeDataProvider[] = [];

    constructor(private compareTree:FtpTreeDataProvider, private filterTree:FtpTreeDataProvider)  {
        this.allTrees = [compareTree, filterTree];
    }

    public async loadAllProfiles() {
		const profiles = await getAllProfiles();
		await this.loadSettingsProfiles(profiles);
    }

    /**
	 * Function called when user clicks the refresh button 
	 * Called from @see activate
	 */
	public async refresh() {
		try {
			await Promise.all(this.profileNodes.map(n => n.disconnect()));
			await this.loadAllProfiles();
		} catch (err) {
			vscode.window.showErrorMessage(err);
		}
	
    }
    
    private updateProfileNode = (nodeToUpdate:ITreeNode) => {
        this.allTrees.forEach(tree => {
            tree.nodeUpdated(nodeToUpdate);
        })
    }

    private addProfileNodesToAllTrees = () => {
        this.allTrees.forEach(tree => {
            tree.setProfileNodes(this.profileNodes);
        });
    }

    /**
     * This kicks everything off by creating the profile node objects, adding them to the treeviews
     * then starting the comparison
     * @param profiles Profile settings object taken from the json in .kirbyftp file
     */
    private async loadSettingsProfiles(profiles:ISettings[]) {
		try {
            this.profileNodes = profiles.map(p => new ProfileNode(p,this.updateProfileNode) );
            this.addProfileNodesToAllTrees();
			this.updateProfileNode(null);
			await Promise.all(this.profileNodes.map(async profileNode =>  {
                await profileNode.connect();
                await profileNode.refreshAll();
                this.updateProfileNode(null);
            }));
		} catch (err) {
			console.log(err);
			return err;
		}
	}
    
}