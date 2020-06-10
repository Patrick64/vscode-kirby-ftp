
// FTP connections require you to make one request at a time oterwise it goes wrong so we need to queue up all the operation such as Refresh, upload etc


export class PromiseState {
    public isCancelled:boolean = false;
}

/**
 * A hook that is called when a particular action occurs
 */
class Hook {
    
    constructor(public actionName:string, 
        public func:Function, 
        public priority:Number = 10) {
        
    }
}

type QueueItem = {
    func:(cancel:boolean)=>Promise<void>, 
    priority: number,
    onCancel:()=>Promise<void>
};
export class PromiseQueue {
    // array of functions to be called
    private queue:Array<QueueItem> = [];
    private hooks:Array<Hook> = [];
    private currentPromise = null;
    /** Used for the progress bar - shows number of tasks finished 
     * eg if completedTasks=6 and queue.length=4 it would show 6/10 done.
     * It is reset  */
    private completedTasks = 0;
    // constructor passes in an onError function
    constructor(private onError:(err:any)=>void, 
        private onQueueChanged) {
        
    }
    
    // 
    /**
     * add a a function to the queue to be called. 
     * This will also reeturn a promie that is resolved when the function has finished but best not to `await` it if your
     * in a function that itself has been called from the queue as then it will deadlock.
     * @param func Function to run
     * @param onCancel Function that runs if queue is being cancelled
     */
    public addToQueue(func:()=>Promise<void>, priority = 10, onCancel:()=>Promise<void> = null) {
        return new Promise((resolve,reject) => {
            // add function to queue, also when the function is done then resolve this addToQueue
            var queueItem = {
                func: async () => {
                    // run actial funcion
                    try {
                        if (func !== null) {
                            await func();
                        }
                        resolve();
                    } catch(err) {
                        reject(err);
                    }
                },
                onCancel: () => {
                    if (onCancel !== null) {
                        // run cancellation function
                        return onCancel().then(resolve).catch(reject);
                    } else {
                        reject(new Error('cancel'));
                    }
                },
                priority
            };
              
            this.queue.push(queueItem);
            this.queue = this.queue.sort((a,b) => a.priority < b.priority ? -1 : a.priority > b.priority ? 1 : 0); 
            this.onQueueChanged({queueLength: this.queue.length, lengthChanged: 1});
            // if noting is running then run this function straightaway
            if (this.currentPromise == null) {
                this.runNextItemInQueue();
            } 
        })
        
    }

    public addHook(hook:Hook):void {
        this.hooks[hook.actionName] = this.hooks[hook.actionName] || [];
        this.hooks[hook.actionName].push(hook);
    }

    /**
     * ⁣🌹 🌻 🌷 🌿 🌵 🌾 🌼⁣
     * 👖 👖 👖 👖 👖 👖 👖
     */
    public async emptyQueue():Promise<Boolean> {
        // is something current running?
        if (this.currentPromise) {
            // cancel all operations (just calls resolve() on them all) to prevent memory leeks emoji 🐏 
            this.queue.forEach(queueItem => queueItem.func(true)); 
            this.queue = []; // remove all items from queue
            this.onQueueChanged({queueLength: this.queue.length, lengthChanged: -this.queue.length});
            const lastPromiseHasFinished = async () => {}; // add promise to queue so we know when the operation has finished
            this.addToQueue(lastPromiseHasFinished);
            await lastPromiseHasFinished;
            // last operation has finished.
            return true;
        } else {
            return true;
        }
    }

    // run next function  in the queue
    private runNextItemInQueue():void {
        if (this.queue.length>0) {
            // get function from head of queue
            var nextQueueItem = this.queue.shift();
            try {
                // call the function then run next one in queue recursivly.
                this.currentPromise = nextQueueItem.func(false)
                .then(() => {  
                    
                    this.currentPromise = null;
                    this.runNextItemInQueue(); 
                    
                })
                .catch((err) => { 
                    this.currentPromise = null;
                    this.onError(err);  
                    this.runNextItemInQueue(); 
                })
            } catch (err) {
                this.currentPromise = null;
                this.onError(err);  
                this.runNextItemInQueue(); 
            }
            this.onQueueChanged({queueLength: this.queue.length, lengthChanged: -1});
        }
    }




}