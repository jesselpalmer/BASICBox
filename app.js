const readlineSync = require('readline-sync');
const fs = require('fs');
const VirtualTapeDrive = require('./BasicBox'); 

const tapeDrive = new VirtualTapeDrive();

while (true) {
    console.log("\nOptions:");
    console.log("1. Save or update program to tape");
    console.log("2. Load program by name");
    console.log("3. Remove program");
    console.log("4. Restore program");
    console.log("5. Display debug representation");
    console.log("6. Dump debug representation to file");
    console.log("7. Exit");
    const choice = readlineSync.question("Enter your choice: ");

    switch (choice) {
        case '1':
            const saveName = readlineSync.question("Enter program name: ");
            const saveData = readlineSync.question("Enter program data: ");
            tapeDrive.saveOrUpdateToTape(saveName, saveData);
            console.log(`Program "${saveName}" saved to tape.`);
            break;

        case '2':
            const loadName = readlineSync.question("Enter program name to load: ");
            const programData = tapeDrive.loadProgramByName(loadName);
            if (programData) {
                console.log(`Program "${loadName}" loaded: ${programData}`);
            } else {
                console.log(`Program "${loadName}" not found.`);
            }
            break;

        case '3':
            const removeName = readlineSync.question("Enter program name to remove: ");
            if (tapeDrive.removeProgramByName(removeName)) {
                console.log(`Program "${removeName}" was marked as deleted.`);
            } else {
                console.log(`Program "${removeName}" not found.`);
            }
            break;

        case '4': 
          const programName = readlineSync.question("Enter program name to recover: ");
          const success = tapeDrive.recoverProgramByName(programName);
          if (success) {
              console.log(`Program "${programName}" was recovered.`);
          } else {
              console.log(`Program "${programName}" not found or not deleted.`);
          }
          break;
  
        case '5':
            console.log(tapeDrive.getDebugRepresentation());
            break;

        case '6':
            const filename = readlineSync.question("Enter filename for debug output (default is debug_output.txt): ") || 'debug_output.txt';
            fs.writeFileSync(filename, tapeDrive.getDebugRepresentation());
            console.log(`Debug representation saved to ${filename}.`);
            break;

        case '7':
            console.log("Goodbye!");
            process.exit(0);
            break;

        default:
            console.log("Invalid choice. Please try again.");
            break;
    }
}
