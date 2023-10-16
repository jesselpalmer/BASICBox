const fs = require('fs');

class BasicBox {
    BASIC_DATA_FILE = 'basic_data.bin';
    TYPE_HEADER = 0x01;
    TYPE_EOF = 0x02;
    TYPE_DELETED = 0x03;

    encodeHeader(name, length) {
        const nameBuffer = Buffer.from(name, 'utf-8');
        const typeBuffer = Buffer.from([this.TYPE_HEADER]);
        const timestampBuffer = Buffer.alloc(8);
        timestampBuffer.writeBigInt64LE(BigInt(Date.now()));
        const locationBuffer = Buffer.alloc(4);
        locationBuffer.writeInt32LE(this.getNextLocation());
        const nameLengthBuffer = Buffer.alloc(4);
        nameLengthBuffer.writeInt32LE(nameBuffer.length);
        const dataLengthBuffer = Buffer.alloc(4);
        dataLengthBuffer.writeInt32LE(length);
        return Buffer.concat([typeBuffer, timestampBuffer, locationBuffer, nameLengthBuffer, dataLengthBuffer, nameBuffer]);
    }

    getNextLocation() {
        if (!fs.existsSync(this.BASIC_DATA_FILE)) return 1;
        const tapeContents = this.loadTapeContents();
        let locationCount = 0;
        tapeContents.forEach(item => {
            if (item.type === 'header') locationCount++;
        });
        return locationCount + 1;
    }

    encodeProgram(name, data) {
        const dataBuffer = Buffer.from(data, 'utf-8');
        const headerBuffer = this.encodeHeader(name, dataBuffer.length);
        const eofBuffer = Buffer.from([this.TYPE_EOF]);
        return Buffer.concat([headerBuffer, dataBuffer, eofBuffer]);
    }

    saveOrUpdateToTape(name, data) {
        const programBuffer = this.encodeProgram(name, data);
        const deletedSlotIndex = this.findDeletedSlot(programBuffer.length);
        if (deletedSlotIndex !== -1) {
            this.writeToTapeAtPosition(deletedSlotIndex, programBuffer);
        } else {
            fs.appendFileSync(this.BASIC_DATA_FILE, programBuffer);
        }
    }

    findDeletedSlot(requiredLength) {
        const tapeContents = this.loadTapeContents();
        for (let i = 0; i < tapeContents.length; i++) {
            if (tapeContents[i].type === 'deleted' && tapeContents[i].length >= requiredLength) {
                return this.findStartPositionOfItem(i);
            }
        }
        return -1;
    }

    writeToTapeAtPosition(position, dataBuffer) {
        const fileBuffer = fs.readFileSync(this.BASIC_DATA_FILE);
        const newFileBuffer = Buffer.concat([
            fileBuffer.slice(0, position),
            dataBuffer,
            fileBuffer.slice(position)  // Preserve the data after the position
        ]);
        fs.writeFileSync(this.BASIC_DATA_FILE, newFileBuffer);
    }

    loadTapeContents() {
        if (!fs.existsSync(this.BASIC_DATA_FILE)) return [];
        const fileBuffer = fs.readFileSync(this.BASIC_DATA_FILE);
        const tapeContents = [];
        let pointer = 0;
        while (pointer < fileBuffer.length) {
            const type = fileBuffer[pointer];
            if (type === this.TYPE_HEADER || type === this.TYPE_DELETED) {
                const timestamp = fileBuffer.readBigInt64LE(pointer + 1);
                const location = fileBuffer.readInt32LE(pointer + 9);
                const nameLength = fileBuffer.readInt32LE(pointer + 13);
                const dataLength = fileBuffer.readInt32LE(pointer + 17);
                pointer += 21; // move past the header
                if (type === this.TYPE_HEADER) {
                    const name = fileBuffer.toString('utf-8', pointer, pointer + nameLength);
                    tapeContents.push({type: 'header', timestamp, location, name, length: dataLength});
                    pointer += nameLength; // move past the name
                    tapeContents.push(fileBuffer.slice(pointer, pointer + dataLength).toString('utf-8'));
                    pointer += dataLength; // move past the data
                } else {
                    tapeContents.push({type: 'deleted', length: dataLength});
                    pointer += dataLength; // move past the deleted data
                }
            } else if (type === this.TYPE_EOF) {
                tapeContents.push({type: 'EOF'});
                pointer++;
            } else {
                console.error("Unrecognized data format!");
                break;
            }
        }
        return tapeContents;
    }

    removeProgramByName(name) {
        const tapeContents = this.loadTapeContents();
        for (let i = 0; i < tapeContents.length; i++) {
            if (tapeContents[i].type === 'header' && tapeContents[i].name === name) {
                const startPosition = this.findStartPositionOfItem(i);
                const deleteBuffer = Buffer.alloc(1, this.TYPE_DELETED);
                const fd = fs.openSync(this.BASIC_DATA_FILE, 'r+');
                fs.writeSync(fd, deleteBuffer, 0, 1, startPosition);
                fs.closeSync(fd);
                return true;
            }
        }
        return false;
    }

    loadProgramByName(name) {
        const tapeContents = this.loadTapeContents();
        for (let i = 0; i < tapeContents.length; i++) {
            if (tapeContents[i].type === 'header' && tapeContents[i].name === name) {
                return tapeContents[i + 1];
            }
        }
        return null;
    }

    findStartPositionOfItem(index) {
        if (!fs.existsSync(this.BASIC_DATA_FILE)) return 0;
        const fileBuffer = fs.readFileSync(this.BASIC_DATA_FILE);
        let pointer = 0;
        for (let i = 0; i < index; i++) {
            const type = fileBuffer[pointer];
            if (type === this.TYPE_HEADER || type === this.TYPE_DELETED) {
                const dataLength = fileBuffer.readInt32LE(pointer + 17);
                pointer += 21 + dataLength;
            } else {
                pointer++;
            }
        }
        return pointer;
    }

    getDebugRepresentation() {
        const tapeContents = this.loadTapeContents();
        let debugOutput = [];
        tapeContents.forEach(item => {
            if (item.type === 'header') {
                debugOutput.push(`Header (Name: ${item.name}, Timestamp: ${new Date(Number(item.timestamp)).toISOString()}, Location: ${item.location}, Length: ${item.length})`);
            } else if (item.type === 'EOF') {
                debugOutput.push('EOF_MARKER');
            } else if (item.type === 'deleted') {
                debugOutput.push(`Deleted Slot (Length: ${item.length})`);
            } else {
                debugOutput.push(`Data: ${item}`);
            }
        });
        return debugOutput.join('\n');
    }

    recoverProgramByName(name) {
        const tapeContents = this.loadTapeContents();
        for (let i = 0; i < tapeContents.length; i++) {
            if (tapeContents[i].type === 'header' && tapeContents[i].name === name) {
                const startPosition = this.findStartPositionOfItem(i);
                const fileBuffer = fs.readFileSync(this.BASIC_DATA_FILE);
                if (fileBuffer[startPosition] === this.TYPE_DELETED) {
                    const recoveryBuffer = Buffer.alloc(1, this.TYPE_HEADER);
                    const fd = fs.openSync(this.BASIC_DATA_FILE, 'r+');
                    fs.writeSync(fd, recoveryBuffer, 0, 1, startPosition);
                    fs.closeSync(fd);
                    return true;
                }
                return false;  // Program is not marked as deleted
            }
        }
        return false;  // Program not found
    }
}

module.exports = BasicBox;
