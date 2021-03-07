/*
 *
 * Difficulty (Updated)
 *
 */

// Import Required Modules
let events = require('events');

// Truncate Integer to Fixed Decimal Places
function toFixed(num, len) {
    return parseFloat(num.toFixed(len));
}

// RingBuffer Main Function
function RingBuffer(maxSize) {

    // Establish Manager Variables
    let data = [];
    let cursor = 0;
    let isFull = false;

    // Append to Ring Buffer
    this.append = function(x) {
        if (isFull) {
            data[cursor] = x;
            cursor = (cursor + 1) % maxSize;
        }
        else {
            data.push(x);
            cursor++;
            if (data.length === maxSize) {
                cursor = 0;
                isFull = true;
            }
        }
    };

    // Average Ring Buffer
    this.avg = function() {
        let sum = data.reduce(function(a, b) { return a + b });
        return sum / (isFull ? maxSize : cursor);
    };

    // Size of Ring Buffer
    this.size = function() {
        return isFull ? maxSize : cursor;
    };

    // Clear Ring Buffer
    this.clear = function() {
        data = [];
        cursor = 0;
        isFull = false;
    };
}

// Difficulty Main Function
let Difficulty = function(port, difficultyOptions, showLogs) {

    // Establish Difficulty Variables
    let _this = this;
    let logging = showLogs;
    let variance = difficultyOptions.targetTime * (difficultyOptions.variancePercent / 100);
    let bufferSize = difficultyOptions.retargetTime / difficultyOptions.targetTime * 4;
    let tMin = difficultyOptions.targetTime - variance;
    let tMax = difficultyOptions.targetTime + variance;

    // Manage Individual Clients
    this.manageClient = function(client) {

        // Check if Client is Connected to VarDiff Port
        let stratumPort = client.socket.localPort;
        if (stratumPort != port) {
            console.error("Handling a client which is not of this vardiff?");
        }

        // Establish Client Variables
        let options = difficultyOptions;
        let lastTs, lastRtc, timeBuffer;

        // Manage Client Submission
        client.on('submit', function() {
            let ts = (Date.now() / 1000) | 0;
            if (!lastRtc) {
                lastRtc = ts - options.retargetTime / 2;
                lastTs = ts;
                timeBuffer = new RingBuffer(bufferSize);
                if (logging) {
                    console.log("Setting difficulty on client initialization")
                }
                return;
            }
            let sinceLast = ts - lastTs;
            timeBuffer.append(sinceLast);
            lastTs = ts;
            let avg = timeBuffer.avg();
            let ddiff = options.targetTime / avg;
            if ((ts - lastRtc) < options.retargetTime && timeBuffer.size() > 0) {
                if (logging) {
                    console.log("No difficulty update required")
                }
                return;
            }
            lastRtc = ts;
            if (avg > tMax && client.difficulty > options.minDiff) {
                if (options.x2mode) {
                    ddiff = 0.5;
                }
                if (ddiff * client.difficulty < options.minDiff) {
                    ddiff = options.minDiff / client.difficulty;
                }
                if (logging) {
                    console.log("Decreasing current difficulty")
                }
            }
            else if (avg < tMin && client.difficulty < options.maxDiff) {
                if (options.x2mode) {
                    ddiff = 2;
                }
                if (ddiff * client.difficulty > options.maxDiff) {
                    ddiff = options.maxDiff / client.difficulty;
                }
                if (logging) {
                    console.log("Increasing current difficulty")
                }
            }
            else {
                if (logging) {
                    console.log("No difficulty update required")
                }
                return;
            }
            let newDiff = toFixed(client.difficulty * ddiff, 8);
            timeBuffer.clear();
            _this.emit('newDifficulty', client, newDiff);
        });
    };
};

// Export Difficulty
module.exports = Difficulty;
Difficulty.prototype.__proto__ = events.EventEmitter.prototype;
