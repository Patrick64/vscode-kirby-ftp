
// FTP connections require you to make one request at a time oterwise it goes wrong so we need to queue up all the operation such as Refresh, upload etc


export class PromiseState {
    public isCancelled:boolean = false;
}

export class PromiseQueue {
    // array of functions to be called
    private queue:Array<()=>Promise<void>> = [];
    private currentPromise = null;
    // constructor passes in an onError function
    constructor(private onError:(err:any)=>void) {
        
    }
    
    // add a a function to the queue to be called. This will also reeturn a promie that is resolved when the function has finished.
    public addToQueue(func:()=>Promise<{}>) {
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