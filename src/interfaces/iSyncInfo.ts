import { CompareNodeState } from "../lib/compareNodeState";

export interface ISyncInfoNode {
	nodeState:CompareNodeState,
	isFolder: boolean,
	children?: {[index:string]:ISyncInfoNode},
	local?: {modified:Date, size: Number, hash: string},
	remote?: {modified:Date, size: Number, hash: string}
}

export interface ISyncInfo {
	host:string,
	port:Number,
	username: string,
	protocol: string,
	localPath: string,
	remotePath: string,
	nodes: ISyncInfoNode
}