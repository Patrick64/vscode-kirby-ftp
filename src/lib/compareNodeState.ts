export enum CompareNodeState {
	unknown = 0,
	equal = 200,
	localOnly = 300,
	remoteOnly = 400,
	remoteChanged = 500,
	localChanged = 600,
	unequal = 700,
	bothChanged = 800,
	conflict = 900,
	error = 1000,
}

export function getCompareNodeStateString(state:CompareNodeState):string {
	if (state == CompareNodeState.equal) return 'equal';
	if (state == CompareNodeState.localOnly) return 'localOnly';
	if (state == CompareNodeState.remoteOnly) return 'remoteOnly';
	if (state == CompareNodeState.remoteChanged) return 'remoteChanged';
	if (state == CompareNodeState.localChanged) return 'localChanged';
	if (state == CompareNodeState.unequal) return 'unequal';
	if (state == CompareNodeState.bothChanged) return 'bothChanged';
	if (state == CompareNodeState.conflict) return 'conflict';
	if (state == CompareNodeState.error) return 'error';
	if (state == CompareNodeState.unknown) return 'loading';
	return '';
}
