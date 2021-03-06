import { ExtensionContext, TreeDataProvider, EventEmitter, TreeItem, Event, window, TreeItemCollapsibleState, Uri, commands, workspace, TextDocumentContentProvider, CancellationToken, ProviderResult, WorkspaceFolder } from 'vscode';

import * as Client from 'ftp';
import * as path from 'path';
import { IEntry } from '../models/ientry';
const fse = require('fs-extra')
import { FtpNode } from '../nodes/ftpNode'
import { kirbyFileSystemProvider } from '../providers/kirbyFileSystemProvider';

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
	
/**
 * 
 */
	public get roots(): Thenable<FtpNode[]> {
		
		return new Promise((c, e) => {
			this.client.list(this.rootDir, (err, list) => {
				if (err) {
					e(err);
				} else {
					c(this.sort(
						list.filter(entry => entry && entry.name != "." && entry.name != "..")
						.map(entry => new FtpNode(entry, this.host, this.rootDir))));
				}
			});
		});
	
	}

	public getChildren(node: FtpNode): Thenable<FtpNode[]> {
		
			return new Promise((c, e) => {
				try {
					this.client.list(node.path, (err, list) => {
						try {
							if (err) {
								return e(err);
							}
							if (list)

							
							if (typeof list == "undefined") return [];
							return c(
								this.sort(
									list.filter(entry => entry && entry.name != "." && entry.name != "..")
									.map(entry => new FtpNode(entry, this.host, node.path))));
						} catch (err) { 
							e(err); 
						}
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

	public getContentFromNode(node:FtpNode):Promise<string> {
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


	public getBuffer(node:FtpNode): Promise<Buffer> {
		
		return new Promise((c, e) => {
			this.client.get(node.path, (err, stream) => {
				try {
					if (err) {
						return e(err);
					}
					var bufs = [];
					
					stream.on('data', function (data) {
						bufs.push(data);
						
					});

					stream.on('end', function () {
						c( Buffer.concat(bufs));
					});
					stream.on("error", (err)=>{
						e(err);
					});
				} catch(err) {
					e(err);
				}
			});
		});
		
	}


	public writeFileFromStream(node:FtpNode,stream) {
		return new Promise((resolve,reject) => {
			// stream.once('end', resolve);
			if (stream.once) {
				stream.once('error', reject);
			}
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
			let wait = setTimeout(() => {
				reject("Timeout")
			},2000);
			this.client.get(node.path, function(err, stream) {
				clearTimeout(wait);
				if (err) {
					reject(err);
				} else {
					//stream.once('close', function() { this.client.end(); });
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

		public async getUri(node:FtpNode,workspaceFolder:WorkspaceFolder):Promise<Uri> {
			return node.resource;
		}

		public async openForEditor(node:FtpNode,onSaveFile:Function) {
		// var filepath = path.join(workspaceFolder.uri.fsPath, ".vscode/kirby-ftp/tmp", node.name);
		const content:Buffer = await this.getBuffer(node);
		// const uri = Uri.parse("kirby:/" + node.name);
		await kirbyFileSystemProvider.openFile(
			node.resource,
			content,
			onSaveFile
		);
		}
	
	
}


