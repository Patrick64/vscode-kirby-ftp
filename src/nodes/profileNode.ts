import { ITreeNode } from './iTreeNode';
import { WorkspaceFolder } from "vscode";
var  path = require('path');
var pathIsInside = require("path-is-inside");
import { CompareModel } from '../models/compareModel';
import { DiskModel } from '../models/diskModel';
import { FtpModel } from '../models/ftpModel';
import { CompareNode } from '../models/compareModel';
import { ISettings } from '../modules/config';

export class ProfileNode implements ITreeNode{
    private children:CompareNode[] = [];
    private compareModel:CompareModel;
    private nodeName:string;
    contextValue = "profile";
    constructor(private profileSettings:ISettings,private nodeUpdated:Function) {
        var workspaceFolder = profileSettings.workspaceFolder;
        var settings = profileSettings.settings;
        var fullLocalPath = path.join(workspaceFolder.uri.fsPath,settings.localPath ? settings.localPath : '.');
        if (!pathIsInside(fullLocalPath, workspaceFolder.uri.fsPath)) throw("localPath settings must be within workspace directory");
        this.nodeName = workspaceFolder.name + " ↔ ️" + settings.protocol + '://' + settings.host + settings.remotePath;
        this.compareModel = new CompareModel(
            new DiskModel(fullLocalPath), 
            new FtpModel(settings.host, settings.username, settings.password,settings.port),
            nodeUpdated );	
    }

    public get name() {
        return this.nodeName;
    }

    public get isFolder() {
        return true;
    }

    public get iconName() {
        return "profile";
    }

    public get path() {
        return 'dunno';
    }

    public updateFolderState() {
        // don't need to do anything
    }

    public getChildNodes():Thenable<ITreeNode[]> {
        return this.compareModel.roots;
    }

    public refreshAll() {
        return this.compareModel.refreshAll();
    }

}