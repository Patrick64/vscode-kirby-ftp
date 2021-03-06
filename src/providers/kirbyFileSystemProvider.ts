

import * as path from 'path';
import * as vscode from 'vscode';

export class File implements vscode.FileStat {

    type: vscode.FileType;
    ctime: number;
    mtime: number;
    size: number;

    name: string;
    data?: Uint8Array;

    /** Function to call when user saves file which will then write to ftp or semething */
    onSaveFile: Function;
    
    constructor(name: string) {
        this.type = vscode.FileType.File;
        this.ctime = Date.now();
        this.mtime = Date.now();
        this.size = 0;
        this.name = name;
    }
}

export class Directory implements vscode.FileStat {

    type: vscode.FileType;
    ctime: number;
    mtime: number;
    size: number;

    name: string;
    entries: Map<string, File | Directory>;

    constructor(name: string) {
        this.type = vscode.FileType.Directory;
        this.ctime = Date.now();
        this.mtime = Date.now();
        this.size = 0;
        this.name = name;
        this.entries = new Map();
    }

    
}

export type Entry = File | Directory;

/**
 * This class is used to create documents that represent files on the server
 */

export class KirbyFileSystemProvider implements vscode.FileSystemProvider {

    root = new Directory('');

    // --- manage file metadata

    stat(uri: vscode.Uri): vscode.FileStat {
        return this._lookup(uri, false);
    }

    readDirectory(uri: vscode.Uri): [string, vscode.FileType][] {
        const entry = this._lookupAsDirectory(uri, false);
        let result: [string, vscode.FileType][] = [];
        for (const [name, child] of entry.entries) {
            result.push([name, child.type]);
        }
        return result;
    }

    // --- manage file contents

    readFile(uri: vscode.Uri): Uint8Array {
        const data = this._lookupAsFile(uri, false).data;
        if (data) {
            return data;
        }
        throw vscode.FileSystemError.FileNotFound();
    }

    createDirectoryTree(path) {
        let parts = path.split('/');
        let entry: Entry = this.root;
        let curPath = '';
        for (const part of parts) {
            if (!part) {
                continue;
            }
            curPath += '/' + part;
            let child: Entry | undefined;
            if (entry instanceof Directory) {
                child = entry.entries.get(part);
                this.createDirectory(vscode.Uri.parse(curPath));
                child = entry.entries.get(part);
            }
            entry = child;
        }
    }

    openFile(uri: vscode.Uri, content: Uint8Array, onSaveFile:Function): void {
        const options = {create:true, overwrite: true};
        let basename = path.posix.basename(uri.path);
        this.createDirectoryTree(path.posix.dirname(uri.path));
        let parent = this._lookupParentDirectory(uri);
        let entry = parent.entries.get(basename);
        if (entry instanceof Directory) {
            throw vscode.FileSystemError.FileIsADirectory(uri);
        }
        if (!entry && !options.create) {
            throw vscode.FileSystemError.FileNotFound(uri);
        }
        if (entry && options.create && !options.overwrite) {
            throw vscode.FileSystemError.FileExists(uri);
        }
        if (!entry) {
            entry = new File(basename);
            parent.entries.set(basename, entry);
            this._fireSoon({ type: vscode.FileChangeType.Created, uri });
        }
        entry.mtime = Date.now();
        entry.size = content.byteLength;
        entry.data = content;
        entry.onSaveFile = onSaveFile;
        this._fireSoon({ type: vscode.FileChangeType.Changed, uri });
    }

    /**
     * Function called when user Saves this file
     * @param uri 
     * @param content 
     * @param options 
     */
    writeFile(uri: vscode.Uri, content: Uint8Array, options: { create: boolean, overwrite: boolean }): void {
        //this.openFile(uri,content,options);
        var a=1; //also write file??
        let basename = path.posix.basename(uri.path);
        let parent = this._lookupParentDirectory(uri);
        let entry = parent.entries.get(basename);
        if (entry instanceof Directory) {
            throw vscode.FileSystemError.FileIsADirectory(uri);
        }
        if (entry) {
            const oldContent = entry.data;
            entry.mtime = Date.now();
            entry.size = content.byteLength;
            entry.data = content;
            if (entry.onSaveFile) {
                // save file to ftp etc
                entry.onSaveFile(oldContent,content);
            }
            this._fireSoon({ type: vscode.FileChangeType.Changed, uri });
        }
    }

    // --- manage files/folders

    rename(oldUri: vscode.Uri, newUri: vscode.Uri, options: { overwrite: boolean }): void {

        if (!options.overwrite && this._lookup(newUri, true)) {
            throw vscode.FileSystemError.FileExists(newUri);
        }

        let entry = this._lookup(oldUri, false);
        let oldParent = this._lookupParentDirectory(oldUri);

        let newParent = this._lookupParentDirectory(newUri);
        let newName = path.posix.basename(newUri.path);

        oldParent.entries.delete(entry.name);
        entry.name = newName;
        newParent.entries.set(newName, entry);

        this._fireSoon(
            { type: vscode.FileChangeType.Deleted, uri: oldUri },
            { type: vscode.FileChangeType.Created, uri: newUri }
        );
    }

    delete(uri: vscode.Uri): void {
        let dirname = uri.with({ path: path.posix.dirname(uri.path) });
        let basename = path.posix.basename(uri.path);
        let parent = this._lookupAsDirectory(dirname, false);
        if (!parent.entries.has(basename)) {
            throw vscode.FileSystemError.FileNotFound(uri);
        }
        parent.entries.delete(basename);
        parent.mtime = Date.now();
        parent.size -= 1;
        this._fireSoon({ type: vscode.FileChangeType.Changed, uri: dirname }, { uri, type: vscode.FileChangeType.Deleted });
    }

    createDirectory(uri: vscode.Uri): void {
        let basename = path.posix.basename(uri.path);
        let dirname = uri.with({ path: path.posix.dirname(uri.path) });
        let parent = this._lookupAsDirectory(dirname, false);

        let entry = new Directory(basename);
        parent.entries.set(entry.name, entry);
        parent.mtime = Date.now();
        parent.size += 1;
        this._fireSoon({ type: vscode.FileChangeType.Changed, uri: dirname }, { type: vscode.FileChangeType.Created, uri });
    }

    // --- lookup

    private _lookup(uri: vscode.Uri, silent: false): Entry;
    private _lookup(uri: vscode.Uri, silent: boolean): Entry | undefined;
    private _lookup(uri: vscode.Uri, silent: boolean): Entry | undefined {
        let parts = uri.path.split('/');
        let entry: Entry = this.root;
        for (const part of parts) {
            if (!part) {
                continue;
            }
            let child: Entry | undefined;
            if (entry instanceof Directory) {
                child = entry.entries.get(part);
            }
            if (!child) {
                if (!silent) {
                    throw vscode.FileSystemError.FileNotFound(uri);
                } else {
                    return undefined;
                }
            }
            entry = child;
        }
        return entry;
    }

    private _lookupAsDirectory(uri: vscode.Uri, silent: boolean): Directory {
        let entry = this._lookup(uri, silent);
        if (entry instanceof Directory) {
            return entry;
        }
        throw vscode.FileSystemError.FileNotADirectory(uri);
    }

    private _lookupAsFile(uri: vscode.Uri, silent: boolean): File {
        let entry = this._lookup(uri, silent);
        if (entry instanceof File) {
            return entry;
        }
        throw vscode.FileSystemError.FileIsADirectory(uri);
    }

    private _lookupParentDirectory(uri: vscode.Uri): Directory {
        const dirname = uri.with({ path: path.posix.dirname(uri.path) });
        return this._lookupAsDirectory(dirname, false);
    }

    // --- manage file events

    private _emitter = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
    private _bufferedEvents: vscode.FileChangeEvent[] = [];
    private _fireSoonHandle?: NodeJS.Timer;

    readonly onDidChangeFile: vscode.Event<vscode.FileChangeEvent[]> = this._emitter.event;

    watch(_resource: vscode.Uri): vscode.Disposable {
        // ignore, fires for all changes...
        return new vscode.Disposable(() => { });
    }

    private _fireSoon(...events: vscode.FileChangeEvent[]): void {
        this._bufferedEvents.push(...events);

        if (this._fireSoonHandle) {
            clearTimeout(this._fireSoonHandle);
        }

        this._fireSoonHandle = setTimeout(() => {
            this._emitter.fire(this._bufferedEvents);
            this._bufferedEvents.length = 0;
        }, 5);
    }
    
}

// export class KirbyFileSystemProvider implements vscode.FileSystemProvider {
//     // onDidChangeFile: vscode.Event<vscode.FileChangeEvent[]>;
//     private _emitter = new vscode.EventEmitter<vscode.FileChangeEvent[]>();

//     readonly onDidChangeFile: vscode.Event<vscode.FileChangeEvent[]> = this._emitter.event;

//     watch(uri: vscode.Uri, options: { recursive: boolean; excludes: string[]; }): vscode.Disposable {
//         throw new Error("Method not implemented.");
//     }
//     stat(uri: vscode.Uri): vscode.FileStat | Thenable<vscode.FileStat> {
//         throw new Error("Method not implemented.");
//     }
//     readDirectory(uri: vscode.Uri): [string, vscode.FileType][] | Thenable<[string, vscode.FileType][]> {
//         throw new Error("Method not implemented.");
//     }
//     createDirectory(uri: vscode.Uri): void | Thenable<void> {
//         throw new Error("Method not implemented.");
//     }
//     readFile(uri: vscode.Uri): Uint8Array | Thenable<Uint8Array> {
//         throw new Error("Method not implemented.");
//     }
//     writeFile(uri: vscode.Uri, content: Uint8Array, options: { create: boolean; overwrite: boolean; }): void | Thenable<void> {
//         // throw new Error("Method not implemented.");
//         let basename = path.posix.basename(uri.path);
//         let parent = this._lookupParentDirectory(uri);
//         let entry = parent.entries.get(basename);
//         if (entry instanceof Directory) {
//             throw vscode.FileSystemError.FileIsADirectory(uri);
//         }
//         if (!entry && !options.create) {
//             throw vscode.FileSystemError.FileNotFound(uri);
//         }
//         if (entry && options.create && !options.overwrite) {
//             throw vscode.FileSystemError.FileExists(uri);
//         }
//         if (!entry) {
//             entry = new File(basename);
//             parent.entries.set(basename, entry);
//             this._fireSoon({ type: vscode.FileChangeType.Created, uri });
//         }
//         entry.mtime = Date.now();
//         entry.size = content.byteLength;
//         entry.data = content;

//         this._fireSoon({ type: vscode.FileChangeType.Changed, uri });
//     }
//     delete(uri: vscode.Uri, options: { recursive: boolean; }): void | Thenable<void> {
//         throw new Error("Method not implemented.");
//     }
//     rename(oldUri: vscode.Uri, newUri: vscode.Uri, options: { overwrite: boolean; }): void | Thenable<void> {
//         throw new Error("Method not implemented.");
//     }
//     copy?(source: vscode.Uri, destination: vscode.Uri, options: { overwrite: boolean; }): void | Thenable<void> {
//         throw new Error("Method not implemented.");
//     }
    
// }
const kirbyFileSystemProvider = new KirbyFileSystemProvider();
export { kirbyFileSystemProvider };