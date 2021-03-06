import { ExtensionContext, TreeDataProvider, EventEmitter, TreeItem, Event, window, TreeItemCollapsibleState, Uri, commands, workspace, TextDocumentContentProvider, CancellationToken, ProviderResult } from 'vscode';

import * as Client from 'ftp';
import * as path from 'path';
import { IEntry } from '../models/ientry';
const fse = require('fs-extra')
import { DiskNode } from '../nodes/diskNode';

export class DiskModel {

	constructor(public rootDir:string) {
	}

	public connect():Thenable<void> {
		// don't need to connect with disk so its just a dummy function
		return Promise.resolve();
	}

	public disconnect() {

	}

	public getContentFromNode(node:DiskNode):Thenable<string> {
		return new Promise((c, e) => {
			// var filepath = path.join(this.rootDir, node.path);
			fse.readFile(node.path, 'utf8', function (err,data) {
				if (err) {
				  e(err);
				}
				c(data);
			  });

		});
	}

	public getBuffer(node:DiskNode):Thenable<Buffer> {
		return new Promise((c, e) => {
			// var filepath = path.join(this.rootDir, node.path);
			fse.readFile(node.path, function (err,data) {
				if (err) {
				  e(err);
				}
				c(data);
			  });

		});
	}

	public createReadStream(node:DiskNode) {
		// c.get('foo.txt', function(err, stream) {
		// 	if (err) throw err;
		// 	stream.once('close', function() { c.end(); });
		// 	stream.pipe(fs.createWriteStream('foo.local-copy.txt'));
		//   });
		return Promise.resolve(fse.createReadStream(node.path));
	}
	
	public closeStream() {
		// nothing to do
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
		try {
			var parentDir = node ? node.path : this.rootDir;
			return fse.readdir(parentDir).then( filenames => {
				let promises = filenames.map(filename => fse.stat( path.join(parentDir, filename) ) );
				return Promise.all(promises).then(  stats => {
					// var filename = list[i];
					return stats.map( (stat:any,i) => new DiskNode({...stat, name:filenames[i], type: (stat.isDirectory() ? 'd' : 'f') }, parentDir ))
				});
				
			}).catch(err => {
				return Promise.reject(err);
			})
		} catch (err) {
			return err;
		}
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

	public getRootNode() {
		return new DiskNode({name:"", type: "d"}, this.rootDir);
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

	public async writeFileFromStream(node: DiskNode,stream: Buffer) {
		await this.writeStream(node.path,stream);
	}

	public async writeNewFileFromStream(parentFolder:DiskNode,filename:string,stream) {
		await this.writeStream(path.join(parentFolder.path,filename), stream);
	}

	public getUri(node:DiskNode):Promise<Uri> {
		return Promise.resolve(Uri.file(node.path));
	}

	public async openForEditor(node,onSaveFile:Function) {
		// todo: think about this
		return;
	}

	private async writeStream(path:string, buffer: Buffer) {
		
		const fd = await fse.open(path, 'w');
		
		// write the contents of the buffer, from position 0 to the end, to the file descriptor returned in opening our file
		// await fse.write(fd, buffer, 0, buffer.length);
		const { bytesWritten, b } = await fse.write(fd, buffer, 0, buffer.length, 0);
		await fse.close(fd);

			
			
		
	}
}
