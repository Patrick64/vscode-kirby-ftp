import { ExtensionContext, TreeDataProvider, EventEmitter, TreeItem, Event, window, TreeItemCollapsibleState, Uri, commands, workspace, TextDocumentContentProvider, CancellationToken, ProviderResult } from 'vscode';

import * as Client from 'ftp';
import * as path from 'path';
import { IEntry } from '../models/ientry';
const fse = require('fs-extra')

export class DiskNode {
	private _resource: Uri;

	constructor(private entry: IEntry, private _parent: string) {
		// var uri = `ftp://${host}${_parent}${entry.name}`;
		// this._resource = Uri.parse(uri);
	}

	public get resource(): Uri {
		return this._resource;
	}

	public get path(): string {
		return path.join(this._parent, this.name);
	}

	public get name(): string {
		return this.entry.name;
	}

	public get isFolder(): boolean {
		return this.entry.type === 'd' || this.entry.type === 'l';
	}
}

export class DiskModel {

	constructor(public rootDir:string) {
	}

	// public connect(): Thenable<Client> {
	// 	return new Promise((c, e) => {
	// 		const client = new Client();
	// 		client.on('ready', () => {
	// 			c(client);
	// 		});

	// 		client.on('error', error => {
	// 			e('Error while connecting: ' + error.message);
	// 		})

	// 		client.connect({
	// 			host: this.host,
	// 			user: this.user,
	// 			password: this.password,
	// 			port: this.port
	// 		});
	// 	});
	// }

	public get roots(): Thenable<DiskNode[]> {
        return this.getChildren(null);
		// return this.connect().then(client => {
		// 	return new Promise((c, e) => {
		// 		client.list((err, list) => {
		// 			if (err) {
		// 				return e(err);
		// 			}

		// 			client.end();

		// 			return c(this.sort(list.map(entry => new DiskNode(entry, this.host, '/'))));
		// 		});
		// 	});
		// });
	}

	public getChildren(node: DiskNode): Thenable<DiskNode[]> {
        var parentDir = node ? node.path : this.rootDir;
        return fse.readdir(parentDir).then( filenames => {
            let promises = filenames.map(filename => fse.stat( path.join(parentDir, filename) ) );
            return Promise.all(promises).then(  stats => {
                // var filename = list[i];
                return stats.map( (stat,i) => new DiskNode({name:filenames[i], type: (stat.isDirectory() ? 'd' : 'f') }, parentDir ))
            });
            
        })
		// return this.connect().then(client => {
		// 	return new Promise((c, e) => {
		// 		client.list(node.path, (err, list) => {
		// 			if (err) {
		// 				return e(err);
		// 			}

		// 			client.end();

		// 			return c(this.sort(list.map(entry => new DiskNode(entry, this.host, node.path))));
		// 		});
		// 	});
		// });
	}

	private sort(nodes: DiskNode[]): DiskNode[] {
		return nodes.sort((n1, n2) => {
			if (n1.isFolder && !n2.isFolder) {
				return -1;
			}

			if (!n1.isFolder && n2.isFolder) {
				return 1;
			}

			return n1.name.localeCompare(n2.name);
		});
	}

	public getContent(resource: Uri): Thenable<string> {
        return Promise.resolve("not done");
		// return this.connect().then(client => {
		// 	return new Promise((c, e) => {
		// 		client.get(resource.path.substr(2), (err, stream) => {
		// 			if (err) {
		// 				return e(err);
		// 			}

		// 			let string = ''
		// 			stream.on('data', function (buffer) {
		// 				if (buffer) {
		// 					var part = buffer.toString();
		// 					string += part;
		// 				}
		// 			});

		// 			stream.on('end', function () {
		// 				client.end();
		// 				c(string);
		// 			});
		// 		});
		// 	});
		// });
	}
}
