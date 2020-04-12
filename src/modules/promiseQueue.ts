
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

export class PromiseQueue {
    // array of functions to be called
    private queue:Array<()=>Promise<void>> = [];
    private hooks:Array<Hook> = [];
    private currentPromise = null;
    // constructor passes in an onError function
    constructor(private onError:(err:any)=>void) {
        
    }
    
    // add a a function to the queue to be called. This will also reeturn a promie that is resolved when the function has finished.
    public addToQueue(func:()=>Promise<void>) {
        return new Promise((resolve,reject) => {
            // add function to queue, also when the function is done then resolve this addToQueue
            var queueItem = () => func().then(resolve).catch(reject);
            this.queue.push(queueItem);
            
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
     * 
     */
    public async emptyQueue():Promise<Boolean> {
        // is something current running?
        if (this.currentPromise) {
            this.queue = []; // remove all items from queue
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
            var nextFunc = this.queue.shift();
            try {
                // call the function then run next one in queue recursivly.
                this.currentPromise = nextFunc()
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
        }
    }




}