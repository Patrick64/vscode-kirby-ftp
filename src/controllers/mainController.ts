import { getAllProfiles, ISettings } from "../modules/config";
import { ProfileNode } from "../nodes/profileNode";
import * as vscode from 'vscode';
import { FtpTreeDataProvider } from "../providers/compareTree";
import { ITreeNode } from "../nodes/iTreeNode";
import { Database } from "../modules/database";

export class MainController {

    private profileNodes: ProfileNode[] = [];
    private allTrees:FtpTreeDataProvider[] = [];
    private loadingProgress: Array<{max: number, queueLength: number}>;

    constructor(private compareTree:FtpTreeDataProvider, private filterTree:FtpTreeDataProvider, private database:Database)  {
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

    private queueChanged({profileIndex,queueLength,lengthChanged}) {
        const progress = this.loadingProgress[profileIndex];
        if (lengthChanged > 0) {
            progress.max += lengthChanged;
        }
        progress.queueLength = queueLength;
        this.updateProgressBar();
    }

    private updateProgressBar() {
        const max = this.loadingProgress.reduce((p,c) => p + c.max, 0 );
        const queueLength = this.loadingProgress.reduce((p,c) => p + c.queueLength, 0 );
        vscode.window.setStatusBarMessage("Progress: " + (max - queueLength) + "/" + max,1000);
    }

    /**
     * This kicks everything off by creating the profile node objects, adding them to the treeviews
     * then starting the comparison
     * @param profiles Profile settings object taken from the json in .kirbyftp file
     */
    private async loadSettingsProfiles(profiles:ISettings[]) {
		try {
            this.loadingProgress = profiles.map(p => ({
                max: 0,
                queueLength: 0
            }))
            this.profileNodes = profiles.map((p, profileIndex) => new ProfileNode(
                p,
                this.updateProfileNode,
                this.database,
                {
                    onQueueChanged: ({queueLength, lengthChanged}) => {
                        this.queueChanged({profileIndex, queueLength, lengthChanged});
                    }
                }
            ) );
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