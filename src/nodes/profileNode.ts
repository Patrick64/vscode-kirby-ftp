import { ITreeNode } from './iTreeNode';
import { WorkspaceFolder } from "vscode";
var  path = require('path');
var pathIsInside = require("path-is-inside");
import { CompareModel } from '../models/compareModel';
import { DiskModel } from '../models/diskModel';
import { FtpModel } from '../models/ftpModel';
import { CompareNode } from '../nodes/compareNode';
import { ISettings } from '../modules/config';
import { ISyncInfo } from '../interfaces/iSyncInfo';
import { Database } from '../modules/database';


export enum ConnectionStatus {
    Connecting=1,
    Connected=2,
    ConnectFailed=3
}

export class ProfileNode extends CompareNode {
    
    public isFailed:boolean = false; 
    private nodeName:string;
    public connectionStatus:ConnectionStatus = ConnectionStatus.Connecting;
    constructor(
        private profileSettings:ISettings,
        private nodeUpdated:Function, 
        private database: Database,
        {onQueueChanged}
        ) {
        // just call super function will nulls for now, we'll add the reuiqred values below
        super(null,null,"",path.sep,true,null, null);
        
        var workspaceFolder = profileSettings.workspaceFolder;
        var settings = profileSettings.settings;
        var fullLocalPath = path.join(workspaceFolder.uri.fsPath,settings.localPath ? settings.localPath : '.');
        if (!pathIsInside(fullLocalPath, workspaceFolder.uri.fsPath)) throw("localPath settings must be within workspace directory");
        //this.nodeName = workspaceFolder.name + " ↔ ️" + settings.protocol + '://' + settings.host + settings.remotePath;
        this.nodeName =   settings.host;
        var remoteModel = new FtpModel(settings.host, settings.username, settings.password,settings.port,settings.remotePath);
        var localModel = new DiskModel(fullLocalPath);
        this.compareModel = new CompareModel(
            localModel,
            remoteModel,
            nodeUpdated,
            this,
            this.database,
            { onQueueChanged } );	
        // setup values for this being CompareNode
        this.localNode = localModel.getRootNode();
        this.remoteNode = remoteModel.getRootNode(); 
        this._parent = "";
        this.filename = path.sep; 
        this._isFolder = true;
        this.parentNode = null;
        
        
    }

    public connect():Promise<void> {
        return this.compareModel.connect();
    }
    public async disconnect():Promise<void> {
        return await this.compareModel.disconnect();
    }
    public get name() {
        return this.nodeName;
    }

    public get isFolder() {
        return true;
    }
    public get isRootNode():boolean {
        return true;
    }

    public get path(): string {
		return "";
	}

    public get iconName() {
        if (this.isFailed || this.connectionStatus == ConnectionStatus.ConnectFailed) return "profile_fail"
        else if (this.connectionStatus == ConnectionStatus.Connecting) return "loading";
        else if (this.connectionStatus == ConnectionStatus.Connected) return "profile";
        
        
    }


    public get workspaceFolder() {
        return this.profileSettings.workspaceFolder;
    }

    public updateFolderState() {
        // don't need to do anything
    }

    // public getChildNodes():Promise<ITreeNode[]> {
    //     return Promise.resolve(this.children);
    // }

    public get hasChildren():boolean {
		return true;
    }

    public get contextValue():string {
        return "profile_node";
         
    }

    
    public refreshAll() {
        return this.compareModel.refreshAll();
    }

    public userRequestsPause() {
        this.compareModel.userRequestsPause();
    }

    public getSyncInfo():ISyncInfo   {
        return {
            host:this.profileSettings.settings.host,
            port:this.profileSettings.settings.port,
            username:this.profileSettings.settings.username,
            protocol:this.profileSettings.settings.protocol,
            localPath:this.profileSettings.settings.localPath,
            remotePath:this.profileSettings.settings.remotePath,
            nodes: this.getSyncInfoNode()
        }

    }

    /** Get previous sync info, used to know what state (ie equal, changed etc) the files were in */
    public getSyncInfoFromDatabase = async():Promise<ISyncInfo> => {
        return await this.database.getSyncInfo(this.profileSettings.settings);
    }

}