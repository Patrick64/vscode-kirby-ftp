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

	constructor(private host: string, private user: string, private password: string, private port: number) {
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

			this.client.connect({
				host: this.host,
				user: this.user,
				password: this.password,
				port: this.port
			});
		});
	}

	public disconnect() {
		this.client.end();
	}
	

	public get roots(): Thenable<FtpNode[]> {
		
		return new Promise((c, e) => {
			this.client.list((err, list) => {
				if (err) {
					return e(err);
				}

				

				return c(this.sort(list.map(entry => new FtpNode(entry, this.host, '/'))));
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

						

						return c(this.sort(list.map(entry => new FtpNode(entry, this.host, node.path))));
					});
				} catch(err) { 
					e(err); 
				}
			});
		
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
}
