import * as vscode from 'vscode';
import * as path from 'path';
import { WorkspaceFolder, workspace } from 'vscode';
import { isArray } from 'util';
const fse = require('fs-extra');

const defaultConfig = [{
    host: 'host',
    port: 22,
    username: 'username',
    password: null,
    protocol: 'sftp',
    agent: null,
    privateKeyPath: null,
    passphrase: null,
    passive: false,
    interactiveAuth: false,
  
    remotePath: '/',
    localPath: '.',
    uploadOnSave: false,
  
    syncMode: 'update',
  
    watcher: {
      files: false,
      autoUpload: false,
      autoDelete: false,
    },
  
    ignore: ['**/.vscode/**', '**/.git/**', '**/.DS_Store']
    }];

export interface ISettings {
  workspaceFolder: WorkspaceFolder,
  settings: {
      host?: string,
      port?: number,
      username?: string,
      password?: string,
      protocol: string,
      localPath?: string,
      remotePath?: string
  }
  }
  

export function newConfig(basePath) {
    const configPath = path.join(basePath, ".vscode/kirby-ftp/.kirby-ftp-config"); 

    const showConfigFile = () =>
        vscode.workspace.openTextDocument(configPath).then(vscode.window.showTextDocument);

    return fse
        .pathExists(configPath)
        .then(exist => {
        if (exist) {
            return showConfigFile();
        }

        return fse.outputJson(configPath, defaultConfig, { spaces: 4 }).then(showConfigFile);
        })
        .catch(error => {
            vscode.window.showErrorMessage(error);
        });
}
  


export function editConfig() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders.length === 1) {
      newConfig(workspaceFolders[0].uri.fsPath);
      return;
    }
  
    const initDirs = workspaceFolders.map(folder => ({
      value: folder.uri.fsPath,
      label: folder.name,
      description: folder.uri.fsPath,
    }));
  
    vscode.window
      .showQuickPick(initDirs, {
        ignoreFocusOut: true,
        placeHolder: 'Select a folder...(ESC to cancel)',
      }).then(item => {
        if (item === undefined) {
          return;
        }
        newConfig(item.value);
      });
  }

  // check that the settings JSON for a profile is valid (ie has all the right settings in)
  function isSettingsProfileValid(profileJson) {
    return "protocol" in profileJson;
  }

  function readSettingsJson(configPath, workspaceFolder):Thenable<ISettings[]> {
    try {
    return fse.readJson(configPath).then(json => {
      if (!Array.isArray(json))  {
        return []; 
      } else {
        return json.map(settings => { return { workspaceFolder: workspaceFolder, settings: settings }})
      }
    })
    } catch (err) { 
      console.error(err); return Promise.reject(err)
    }
  }

  export function getAllProfiles():Thenable<ISettings[]> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    // var profileSettings: ISettings[];

    // for all the workspace folders in current workspace
    return Promise.all(workspaceFolders.map((folder:WorkspaceFolder) => {
      const configPath = path.join(folder.uri.fsPath, ".vscode/kirby-ftp/.kirby-ftp-config"); 
      return fse.pathExists(configPath).then(exist => {
        // check config file exists return the config json else just empty array
        return (exist ? readSettingsJson(configPath, folder) : []);
      // }).then((profiles) => {
      //   profileSettingsByWorkspace.reduce((p,c) => { c.profilesJson.map(  )})
      //   if (Array.isArray(profilesJson)) {
      //     profilesJson
      //     .filter(profileJson => isSettingsProfileValid (profileJson))
      //     .map((profileJson) => {
      //       profileJson.workspaceFolder = workspaceFolder;
      //       return profileJson;
      //     });     
      //   } else { return []; }
      // })
    })
    }))
    //.then(configFileJsons => configFileJsons.reduce((p:ISettings[],c:ISettings[]) => p.concat(c),[]) )   // flatten array of arrays to one array of profile settings
    .then(configFileJsons => [].concat.apply([], configFileJsons)) // flatten array
    .catch(error => {
        vscode.window.showErrorMessage(error);
    });
  
  }