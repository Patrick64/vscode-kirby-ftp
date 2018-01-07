import * as vscode from 'vscode';
import * as path from 'path';
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
    uploadOnSave: false,
  
    syncMode: 'update',
  
    watcher: {
      files: false,
      autoUpload: false,
      autoDelete: false,
    },
  
    ignore: ['**/.vscode/**', '**/.git/**', '**/.DS_Store']
    }];

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