import { ExtensionContext, TreeDataProvider, EventEmitter, TreeItem, Event, window, TreeItemCollapsibleState, Uri, commands, workspace, TextDocumentContentProvider, CancellationToken, ProviderResult } from 'vscode';

import * as Client from 'ftp';
import * as path from 'path';
import { IEntry } from '../models/ientry';


export class FtpNode {
	private _resource: Uri;

	constructor(private entry, private host: string, private _parent: string) {
		var uri = `ftp://${host}${_parent}${entry.name}`;
		this._resource = Uri.parse(uri);
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

	public get dateLastModified(): Date {
		return this.entry.date;
	}

	public get size(): number {
		return this.entry.size;
	}
}

export class FtpModel {
	
	private client:Client;

	constructor(private host: string, private user: string, private password: string, private port: number, private rootDir:string) {
	}

	public connect(): Thenable<Client> {
		return new Promise((c, e) => {
			this.client = new Client();
			this.client.on('ready', () => {
				c(this.client);
			});

			this.client.on('error', error => {
				e('Error while connecting: ' + error.message);
			})

			// this.client.on('close', hadErr => {
			// 	e('Couldnt connect: ' + this.host);
			// })

			// this.client.on('end', () => {
			// 	e('connection closed: ' + this.host);
			// })

			this.client.connect({
				host: this.host,
				user: this.user,
				password: this.password,
				port: this.port,
				connTimeout: 10000
			});
		});
	}

	public disconnect() {
		this.client.end();
	}
	

	public get roots(): Thenable<FtpNode[]> {
		
		return new Promise((c, e) => {
			this.client.list(this.rootDir, (err, list) => {
				if (err) {
					return e(err);
				}

				

				return c(this.sort(
					list.filter(entry => entry.name != "." && entry.name != "..")
					.map(entry => new FtpNode(entry, this.host, this.rootDir))));
			});
		});
	
	}

	public getChildren(node: FtpNode): Thenable<FtpNode[]> {
		
			return new Promise((c, e) => {
				try {
					this.client.list(node.path, (err, list) => {
						if (err) {
							return e(err);
						}

						

						return c(
							this.sort(
								list.filter(entry => entry.name != "." && entry.name != "..")
								.map(entry => new FtpNode(entry, this.host, node.path))));
					});
				} catch(err) { 
					e(err); 
				}
			});
		
	}

	public getRootNode() {
		return new FtpNode({name: "", type:"d"}, this.host, this.rootDir)
	}

	private sort(nodes: FtpNode[]): FtpNode[] {
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

	public getContentFromNode(node:FtpNode):Thenable<string> {
		return new Promise((c, e) => {
			this.client.get(node.path, (err, stream) => {
				if (err) {
					return e(err);
				}

				let string = ''
				stream.on('data', function (buffer) {
					if (buffer) {
						var part = buffer.toString();
						string += part;
					}
				});

				stream.on('end', function () {
					c(string);
				});
			});
		});
	}

	public getContent(resource: Uri): Thenable<string> {
		return this.connect().then(client => {
			return new Promise((c, e) => {
				client.get(resource.path.substr(2), (err, stream) => {
					if (err) {
						return e(err);
					}

					let string = ''
					stream.on('data', function (buffer) {
						if (buffer) {
							var part = buffer.toString();
							string += part;
						}
					});

					stream.on('end', function () {
						client.end();
						c(string);
					});
				});
			});
		});
	}

	public writeFileFromStream(node:FtpNode,stream) {
		return new Promise((resolve,reject) => {
			// stream.once('end', resolve);
			stream.once('error', reject);
			this.client.put(stream,node.path,resolve);
			
		})
	}

	public writeNewFileFromStream(parentFolder:FtpNode,filename:string,stream) {
		return new Promise((resolve,reject) => {
			// stream.once('end', resolve);
			stream.once('error', reject);
			this.client.put(stream,path.join(parentFolder.path,filename),(err) => {
				if (err) 
					reject(err) 
				else 
					resolve();
			});
			
		})
	}

	public createReadStream(node:FtpNode) {
		return new Promise((resolve,reject) => {
			this.client.get(node.path, function(err, stream) {
				
				if (err) {
					reject(err);
				} else {
					// stream.once('close', function() { this.client.end(); });
					resolve(stream);
				}
			});
		});
	
		
	}

	public closeStream() {
		this.client.end();
	}


	public mkdir(parentPath:string,folderName) {
		return new Promise((resolve,reject) => {
			var p = path.join(this.rootDir,parentPath,folderName);
			return this.client.mkdir(p,(err) => {
				if (err) reject(err); else resolve();
			})
		});
	}

}
