import path = require("path");

const { getCollection, initDB, getDB } = require("lokijs-promise");
const fs = require("fs").promises;

export class Database {
  private dbPath;
  constructor(private storagePath: string) {
    this.dbPath = path.join(this.storagePath, "sync-data.json");
  }

  public init = async () => {
    if (this.storagePath === undefined || this.storagePath === null) {
      //vscode.window.showErrorMessage("Open a folder use TODO manager");
    } else {
      try {
        await fs.mkdir(this.storagePath);
      } catch (err) {
        // dont care
      }
      // Always run this at the start/top of your app to instantiate the DB
      initDB(this.dbPath, 1000); // A file called v1.json will be created in your project repo and will be used as the DB, and it will have an autosave interval of 1000ms (1 second, essentially)
    }
  };

  public someAsyncFunctionAnywhereInYourCode = async () => {
    // Get Insect Collections if exists, if not, it will create one in the DB
    let insects = await getCollection("insects");

    // Query for results
    console.log("\n\n\nQuerying for Existing Records...\n\n");
    let results_1 = insects.find({});
    console.log(results_1);

    // Insert in a new record
    insects.insert({
      insect_name: "Dragonfly",
      insect_description: "A very nice looking insect.",
    });

    // Query for results
    console.log("\n\n\nQuerying after DB Insertion...\n\n");
    let results_2 = insects.find({});
    console.log(results_2);

    // Do whatever LokiJS stuff etc
    let db = await getDB();
    await db.close();
    //....
    //....
    // Examples on how to use `db` found here in the LokiJs documentation: https://rawgit.com/techfort/LokiJS/master/jsdoc/index.html
  };
}

// import {loki} from 'lokijs';

// export class Database {

//     private db;
//     /** array of promises to resolve when database has loaded */
//     private databaseReadyPromises = []; // = async () => {};
//     private isDbReady =false;

//     constructor(private dbPath:string) {

//         this.db = new loki(this.dbPath, {
//             autoload: true,
//             autoloadCallback : this.databaseInitialize,
//             autosave: true,
//             autosaveInterval: 4000
//         });
//     }

//     // implement the autoloadback referenced in loki constructor
//     private  databaseInitialize = () => {
//       var entries = this.db.getCollection("entries");
//       if (entries === null) {
//         entries = this.db.addCollection("entries");
//       }

//       // kick off any program logic or start listening to external events
//       this.runProgramLogic();
//     }

//     // example method with any bootstrap logic to run after database initialized
//     private async runProgramLogic() {
//         this.isDbReady = true;
//         this.databaseReadyPromises.forEach(p => p.resolve() )
//         // var entryCount = this.db.getCollection("entries").count();
//         // console.log("number of entries in database : " + entryCount);
//     }

//     private waitForDbReady = async() => {
//         if (!this.isDbReady) {
//             const promise = async () => {};
//             this.databaseReadyPromises.push(promise);
//             await promise;
//         }
//     }

//     private df = async () => {
//         await this.waitForDbReady();
//         var entryCount = this.db.getCollection("entries").count();
//         // console.log("number of entries in database : " + entryCount);
//     }

// }
