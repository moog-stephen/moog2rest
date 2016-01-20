/**
 * Created by Stephen on 29/11/2015.
 */

var util = require('util');
var path = require('path');
var net = require('net');
var fs = require('fs');
var os = require('os');
var XRegExp = require('xregexp');

var express = require('express');
var favicon = require('serve-favicon');
var app = express();
var http = require('http').Server(app);
var moog = require('node-moog');

var sio = require('socket.io');
var io = new sio(http);

var pages = require('./lib/pages');
var reBuildSubs = setUpRe();

const HTTP_PORT = 3000;


// Globals used in the application
//
var GTCPSock;
var GMoogREST;
var GMoogEvent = new moog.MoogEvent();
var GBuffLine;

var appState = initAppState();
var TCPHost = appState.listenPage.host;
var TCPPort = appState.listenPage.port;

var firstRun = true;

app.use(favicon(__dirname + '/public/images/moofavicon.png'));

//
// End of definitions

// Start the application and send the page
//
http.listen(HTTP_PORT, function () {
    console.log("UI Available on: http://localhost:%s", HTTP_PORT);
});


app.use(express.static(path.join(__dirname, 'public')));

app.get('/', function (req, res) {
    //console.log('Any URL query? %j', req.query);
    res.sendFile(__dirname + '/index.html');
});


io.on('connection', function (socket) {
    console.log('Web server socket.io connection %j', socket.handshake.headers.host);

    socket.on('stateData', function (stateData) {
        if (stateData.action === 'load') {
            console.log('Sending State Data ');
            socket.emit('stateData', {confLoad: true, data: JSON.stringify(appState)});
        }
        if (stateData.action === 'save') {
            appState = JSON.parse(stateData.data);
            console.log('Port & host ' + appState.listenPage.port + ' - ' + appState.listenPage.host);
            saveAppState(socket);
        }

    });

    socket.on('page', function (page) {
        console.log('Page request for ' + page);
        pages.sendPage(page, socket);
        if (firstRun) {
            console.log('Load State Data ');
            socket.emit('stateData', {confLoad: true, data: JSON.stringify(appState)});
            firstRun = false;
        }
    });

    socket.on('appState', function (stateChange) {
        if (stateChange.key === 'stream.play') {
            console.log('Start playings events');
            if (GTCPSock) {
                GTCPSock.resume();
            }
        }
        if (stateChange.key === 'stream.stopped') {
            console.log('Stop playings events');
            if (GTCPSock) {
                GTCPSock.end();
            }
        }
        if (stateChange.key === 'stream.paused' && stateChange.value === true) {
            console.log('Pause playings events');
            if (GTCPSock) {
                GTCPSock.pause();
            }
        }
        else if (stateChange.key === 'stream.paused' && stateChange.value === false) {
            console.log('UnPause playings events');
            if (GTCPSock) {
                GTCPSock.resume();
            }
        }
        if (stateChange.key === 'stream.observe') {
            console.log('Sending events to UI ' + stateChange.value);
            appState.stream.observe = stateChange.value;
        }
    });
});


connectMoog();


// TCP Socket listener section
//
// Create a server instance, and chain the listen function to it
// The function passed to net.createServer() becomes the event handler for the 'connection' event
// The sock object the callback function receives UNIQUE for each connection
var TCPServer = net.createServer(function (TCPSock) {

    GTCPSock = TCPSock;
    var eventCounters = {};
    eventCounters.inCount = 0;
    eventCounters.outCount = 0;
    eventCounters.discardCount = 0;

    var interval = setInterval(function () {

        console.log('Event Count ' + eventCounters.inCount);
        if (eventCounters.inCount === 0) {
            if (GTCPSock) {
                GTCPSock.resume();
            }
        }

        io.emit('eventCount', JSON.stringify(eventCounters));

        eventCounters.inCount = 0;
        eventCounters.outCount = 0;
        eventCounters.discardCount = 0;
    }, 1000);


    // We have a connection - a socket object is assigned to the connection automatically
    console.log('Event Stream connection CONNECTED from: ' + TCPSock.remoteAddress + ':' + TCPSock.remotePort);

    // Add a 'data' event handler to this instance of socket
    //
    TCPSock.on('data', function (data) {

        console.log('Event Stream connection DATA from: ' + TCPSock.remoteAddress + ': ' + data);

        // Do main processing
        var chunkLines = data.toString().split('\n');
        var completeLine = (data.slice(-1) === '\n');

        for (var line = 0; line < chunkLines.length; line += 1) {
            if (GBuffLine && line === 0) {
                chunkLines[line] = GBuffLine + chunkLines[line];
                GBuffLine = null;
                sendEvent(chunkLines[line], eventCounters, line, chunkLines.length - 1);
                continue;
            }
            if (line < chunkLines.length - 1) {
                sendEvent(chunkLines[line], eventCounters, line, chunkLines.length - 1);
                continue;
            }
            if (line === chunkLines.length - 1 && completeLine) {
                sendEvent(chunkLines[line], eventCounters, line, chunkLines.length - 1);
                continue;
            }
            console.log('Buffering incomplete line: ' + String(chunkLines[line]));
            GBuffLine = chunkLines[line];
            if (GTCPSock) {
                GTCPSock.pause();
            }
        }

        // we will broadcast the data to all users (should only be one)
        //

    });

    // Add a 'close' event handler to this instance of socket
    TCPSock.on('close', function (data) {
        console.log('Event Stream connection was CLOSED by: ' + TCPSock.remoteAddress + ' ' + TCPSock.remotePort);
        clearInterval(interval);
    });
}).listen(TCPPort, TCPHost);

TCPServer.on('listening', function (data) {
    console.log('Event stream Server listening on ' + util.inspect(TCPServer.address()));
});

//
// TCP Socket listener done

/**
 *
 * @param eventLine
 * @param counters
 * @param line
 * @param totLines
 * @returns {boolean}
 */
function sendEvent(eventLine, counters, line, totLines) {

    var epoch = new Date().getTime();

    counters.inCount++;

    if (appState.stream.observe) {
        io.emit('eventData', {dataRow: String(eventLine), sent: epoch});
        //console.log('Event sent: ' + String(eventLine));
    }

    if (mapEvent(eventLine)) {

        if (filterEvent(GMoogEvent)) {

            // console.log('GMoogEvent: '+util.inspect(GMoogEvent));
            // Send event to MOOG REST
            GMoogREST.sendEvent(GMoogEvent, function (res, rtn) {
                if (res.statusCode == 200) {
                    console.log('moogREST message sent, return code: ' + res.statusCode);
                    //console.log('moogREST result: ' + util.inspect(rtn));
                    io.emit('message', {status: 'S', text: res.statusCode + ' - ' + res.statusMessage});
                    counters.outCount++;
                    console.log('Lines processed :' + line + ' of ' + totLines);
                    if (line >= totLines) {
                        if (GTCPSock) {
                            GTCPSock.resume();
                        }
                    }
                    return true;
                }
                else {
                    console.error('moogREST - ' + res.statusCode + ' - ' + res.statusMessage);
                    //console.error('moogREST - ' + util.inspect(rtn));
                    io.emit('message', {status: 'D', text: res.statusCode + ' - ' + res.statusMessage});
                    console.log('Lines processed :' + line + ' of ' + totLines);
                    if (line >= totLines) {
                        if (GTCPSock) {
                            GTCPSock.resume();
                        }
                    }
                    return false;
                }
            });
        }
        else {
            console.error('filterEvent filtered out.');
            counters.discardCount++;
            console.log('Lines processed :' + line + ' of ' + totLines);
            if (line >= totLines) {
                if (GTCPSock) {
                    GTCPSock.resume();
                }
            }
            return false;
        }
    }
    else {
        console.error('mapEvent failed.');
        console.log('Lines processed :' + line + ' of ' + totLines);
        if (line >= totLines) {
            if (GTCPSock) {
                GTCPSock.resume();
            }
        }
        return false;
    }
}


/**
 *
 * @param eventLine
 * @returns {boolean}
 */
function mapEvent(eventLine) {
    var mapArray;
    var sigArray = appState.mapPage.signature.slice(0);
    var i;
    var sigIdx;
    var eventFieldObj = createSample(eventLine);

    if (!eventFieldObj) {
        return false;
    }

    // We use the Global Event object (GMoogEvent) to reduce GC

    if (appState.mapPage.fieldMapArray && appState.mapPage.fieldMapArray.length > 0) {
        mapArray = appState.mapPage.fieldMapArray;
        for (i = 0; i < mapArray.length; i += 1) {
            //console.log('Mapping: '+mapArray[i].name+' - '+mapArray[i].source+' -
            // '+eventFieldObj[mapArray[i].source]);
            GMoogEvent[mapArray[i].name] = eventFieldObj[mapArray[i].source];
            sigIdx = sigArray.indexOf(mapArray[i].name);
            if (sigIdx >= 0) {
                sigArray[sigIdx] = GMoogEvent[mapArray[i].name];
            }
        }
        //console.log('Mapping: signature'+' - '+eventFieldObj.signature);
        GMoogEvent.signature = sigArray.join(':');
        return true;
    }
    return false;
}


/**
 *
 * @param eventObj
 * @returns {boolean}
 */
function filterEvent(eventObj) {
    var filterArray;

    if (appState.filterPage.fieldArray && appState.filterPage.fieldArray.length > 0) {
        filterArray = appState.filterPage.fieldArray;

        for (i = 0; i < filterArray.length; i = i + 1) {
            switch (filterArray.check) {
                case "Equals" :
                    if (GMoogEvent[filterArray[i].field] == filterArray[i].value) {
                        util.log('Filter out: ' + filterArray[i].field + ' = ' + filterArray[i].value);
                        return false;
                    }
                    break;
                case "Starts With":
                    if (GMoogEvent[filterArray[i].field].startsWith(filterArray[i].value)) {
                        util.log('Filter out: ' + filterArray[i].field + ' starts with ' + filterArray[i].value);
                        return false;
                    }
                    break;
                case "Contains":
                    if (GMoogEvent[filterArray[i].field].includes(filterArray[i].value)) {
                        util.log('Filter out: ' + filterArray[i].field + ' contains ' + filterArray[i].value);
                        return false;
                    }
                    break;
                default:
            }
        }
    }

    return true;
}


/**
 * This same function is used in the client parse.html too.
 * TODO (maybe we should put in a shared lib and load here as well)
 * @param sampleLine
 * @returns {Object}
 */
function createSample(sampleLine) {

    var delimiter = appState.parsePage.delimiter ? appState.parsePage.delimiter : '';
    var matchRe = appState.parsePage.matchGroupRe;
    var matchObject = {};
    var matchArray;
    var signature;
    var fieldCount = 0;
    var eventObj = {};
    var fieldObject = {};
    var reValidField = /[a-z]{3,}[0-9]+/;
    var re;

    //console.log('createSample for ' + sampleLine+' - '+sigArray);

    if (!matchRe && delimiter) {
        matchArray = sampleLine.split(delimiter);
        matchArray.forEach(function (match) {
            fieldObject.name = 'field' + fieldCount++;
            if (match) {
                fieldObject.value = match;
            }
            else {
                fieldObject.value = 'NULL';
            }
            eventObj[fieldObject.name] = fieldObject.value;
            fieldObject = {};
        });
    }
    else {
        re = XRegExp.build(matchRe, reBuildSubs, 'in');
        matchObject = XRegExp.exec(sampleLine, re);

        if (matchObject && typeof matchObject === 'object') {
            for (var match in matchObject) {
                if (matchObject.hasOwnProperty(match) && reValidField.test(match)) {
                    fieldObject.name = match;
                    if (matchObject[match]) {
                        fieldObject.value = matchObject[match];
                    }
                    else {
                        fieldObject.value = 'NULL';
                    }
                    eventObj[fieldObject.name] = fieldObject.value;
                    fieldObject = {};
                }
            }
        }
    }

    //console.log('createSample sample ' + util.inspect(eventObj));

    return eventObj;
}


/**
 * MOOG REST connection section
 */
function connectMoog() {

    console.log('Connecting to MOOG');
    var proto = 'https';

    var options = {
        // TODO Accommodate https and the cert files in the UI
        'url': proto + '://' + appState.sendPage.host + ':' + appState.sendPage.port
    };

    if (appState.sendPage.user) {
        options.authUser = appState.sendPage.user;
        options.authPass = appState.sendPage.pass;
    }

    if (proto === 'https') {
        options.certFile = '';
        options.caFile = '';
    }

    // Set the global Moog connection object
    //
    GMoogREST = moog.moogREST(options);

    console.log('MOOG Connected ' + util.inspect(GMoogREST.url.href));
}

/**
 * Read the config from a file, or init a new one
 * @param fileName
 * @returns {{}}
 */
function initAppState(fileName) {

    // If fromFile is passed read from that config file
    //
    fileName = fileName ? fileName : './config/rest_moog_reader.conf';

    var createFile = false;
    var appState = {};

    var iFaces = [];
    iFaces.push(os.hostname());
    iFaces = iFaces.concat(getNetworkAddresses(os.networkInterfaces()));

    if (!existsSync(fileName)) {
        console.log('File : ' + fileName + ' not found using defaults');
    }
    else if (readableSync(fileName)) {
        appState = JSON.parse(fs.readFileSync(fileName, 'utf8'));
        appState.file = {};
        appState.file.readOnly = !readOnlySync(fileName);
    }
    else {
        console.log('File : ' + fileName + ' not readable');
    }

    // General init parameters
    appState.stream = {};
    appState.stream.play = true;
    appState.stream.paused = false;
    appState.stream.stopped = false;
    appState.stream.observe = true;
    appState.stream.events = {};
    appState.stream.events.ps = 0;
    appState.stream.events.lastMin = 0;
    appState.stream.events.last5Min = 0;
    appState.stream.events.last15Min = 0;
    appState.stream.events.last1Hour = 0;

    if (!appState.page) {
        appState.page = 'listen';
    }

    if (!appState.listenPage) {
        // Listen page parameters
        appState.listenPage = {};
        appState.listenPage.host = 'localhost';
        appState.listenPage.port = 8641;
        appState.listenPage.state = 'PAUSED';
    }
    // Always refresh the iFaces
    appState.listenPage.iFaces = iFaces;


    if (!appState.parsePage) {
        // Parse page parameters
        appState.parsePage = {};
        appState.parsePage.regex = {};
        appState.parsePage.regex.flagG = true;
        appState.parsePage.regex.flagI = true;
        appState.parsePage.regex.flagM = true;
        appState.parsePage.regex.flagS = true;
        appState.parsePage.start = '';
        appState.parsePage.delimiter = ',';
        appState.parsePage.quote = '"';
        appState.parsePage.quotedText = false;
        appState.parsePage.removeQuotes = false;
        appState.parsePage.matchGroupRe = '';
        appState.parsePage.fieldArray = [
            {name: 'fieldName', value: 'sampleValue'}
        ];
    }

    if (!appState.mapPage) {
        // Map page parameters
        appState.mapPage = {};
        appState.mapPage.host = 'localhost';
        appState.mapPage.port = 6411;
        appState.mapPage.state = 'PAUSED';
        appState.mapPage.observe = true;
        appState.mapPage.signature = ['source', 'agent', 'manager', 'type'];
        appState.mapPage.sampleSig = '';

        if (!appState.mapPage.fieldMapArray) {
            appState.mapPage.fieldMapArray = [
                {name: 'source', source: '', value: 'none', type: 'text', conversion: 'NONE'},
                {name: 'source_id', source: '', value: 'none', type: 'text', conversion: 'NONE'},
                {name: 'external_id', source: '', value: 'none', type: 'text', conversion: 'NONE'},
                {name: 'description', source: '', value: 'none', type: 'text', conversion: 'NONE'},
                {name: 'manager', source: '', value: 'none', type: 'text', conversion: 'NONE'},
                {name: 'class', source: '', value: 'none', type: 'text', conversion: 'NONE'},
                {name: 'type', source: '', value: 'none', type: 'text', conversion: 'NONE'},
                {name: 'agent', source: '', value: 'none', type: 'text', conversion: 'NONE'},
                {name: 'agent_location', source: '', value: 'none', type: 'text', conversion: 'NONE'},
                {name: 'severity', source: '', value: 'none', type: 'text', conversion: 'NONE'},
                {name: 'agent_time', source: '', value: 'none', type: 'number', conversion: 'NONE'},
                {name: 'custom_info', source: '', value: 'none', type: 'text', conversion: 'NONE'}
            ]
        }
    }

    if (!appState.filterPage) {
        // Filter page parameters
        appState.filterPage = {};
        appState.filterPage.fieldArray = [
            {field: 'fieldName', value: 'sampleValue'}
        ];
    }

    if (!appState.sendPage) {
        // Send page parameters
        appState.sendPage = {};
        appState.sendPage.host = 'localhost';
        appState.sendPage.port = 8888;
        appState.sendPage.secret = '';
        appState.sendPage.authUser = 'graze';
        appState.sendPage.authPass = 'graze';
    }

    return appState;
}


/**
 * Save the configuration to a local file
 * @param socket
 * @param fileName
 */
function saveAppState(socket, fileName) {

    // If fileName is passed read from that config file
    //
    fileName = fileName ? fileName : './config/rest_moog_reader.conf';

    var appStateFileContent = JSON.stringify(appState, null, '\t');

    //console.log(appStateFileContent);

    fs.writeFile(fileName, appStateFileContent, function (err) {
        if (err) {
            console.log('Config file write error ' + fileName);
            socket.emit('message', {status: 'D', text: 'File Save ERROR.'});
        }
        else {
            console.log('Config file saved ' + fileName);
            socket.emit('message', {status: 'S', text: 'Config saved okay.'});
        }
    });

    // Broadcast new state
    io.emit('stateData', {confLoad: true, data: JSON.stringify(appState)});

}


/**
 * Get the local network adapter configs.
 * @param ifaces
 * @returns {Array}
 */
function getNetworkAddresses(ifaces) {
    var interfaces = [];

    Object.keys(ifaces).forEach(function (ifname) {
        var alias = 0;

        ifaces[ifname].forEach(function (iface) {
            if ('IPv4' !== iface.family || iface.internal !== false) {
                // skip over internal (i.e. 127.0.0.1) and non-ipv4 addresses
                return;
            }

            if (alias >= 1) {
                // this single interface has multiple ipv4 addresses
                console.log(ifname + ':' + alias, iface.address);
                interfaces.push(iface.address);
            }
            else {
                // this interface has only one ipv4 adress
                console.log(ifname, iface.address);
                interfaces.push(iface.address);
            }
            ++alias;
        });
    });

    return interfaces;
}

function existsSync(filename) {
    try {
        fs.accessSync(filename);
        return true;
    }
    catch (ex) {
        return false;
    }
}

function readOnlySync(filename) {
    try {
        fs.accessSync(filename, fs.W_OK);
        return true;
    }
    catch (ex) {
        return false;
    }
}

function readableSync(filename) {
    try {
        fs.accessSync(filename, fs.R_OK);
        return true;
    }
    catch (ex) {
        return false;
    }
}


/**
 * XRegExp named sub patterns used by Moog
 * @returns {{}}
 */
function setUpRe() {

    var reBuildSubs = {};

    var time = XRegExp.build('^' +
        '{{hours}}{{minutes}}:{{seconds}}|' +
        '{{hours}}{{minutes}} ?{{ampm}}|' +
        '{{hours}}{{minutes}}:{{seconds}}[ -]{1}{{tltz}}$', {
        hours: XRegExp.build('{{h12}} : | {{h24}}', {
            h12: /1[0-2]|0?[1-9]/,
            h24: /2[0-3]|[01][0-9]/
        }, 'x'),
        minutes: /^[0-5][0-9]$/,
        seconds: /^[0-5][0-9]$/,
        ampm: /^(am|AM|pm|PM)$/,
        tltz: /^[A-Z]{3}$/
    });

    reBuildSubs.time = time;

    var date = XRegExp.build('^' +
        '{{day}}\\-{{month}}\\-({{year}}|{{shortYear}})|' +
        '{{day}}\\/{{month}}\\/({{year}}|{{shortYear}})|' +
        '{{month}}\\-{{day}}\\-({{year}}|{{shortYear}})|' +
        '{{month}}\\/{{day}}\\/({{year}}|{{shortYear}})|' +
        '{{year}}{{month}}{{day}}|' +
        '{{year}}\\/{{month}}\\/{{day}}|' +
        '{{year}}\\-{{month}}\\-{{day}}|' +
        '{{day}} {{shortMonth}} {{year}}' +
        '{{day}}[sth]{0,2}\\, ({{shortMonth}}|{{longMonth}}) {{year}}' +
        '{{shortDay}}\\, {{day}}[sth]{0,2} {{longMonth}} {{year}}' +
        '$', {
        day: /^([0-3][1-9]|[0-9])$/,
        month: /^(0?[1-9]|[1][0-2])$/,
        year: /^(19?[5-9][0-9]|20?[0-5][0-9])$/,
        shortYear: /^[0-9]{2}$/,
        shortMonth: /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)$/,
        longMonth: /^(January|February|March|April|May|June|July|August|September|October|November|December)$/,
        shortDay: /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)$/
    });

    reBuildSubs.date = date;

    // Epoch range 13th May 2014 - 14 July 2017
    var epoch = /^14[0-9]{8}$/;

    reBuildSubs.epoch = epoch;

    var dateTime = XRegExp.build('^{{date}}[ T]{1}{{time}}$', {date: date, time: time});

    reBuildSubs.dateTime = dateTime;

    var hostName = XRegExp('^(?!\\d*$)([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9\\-]){1,61}[a-zA-Z0-9]$');

    reBuildSubs.hostName = hostName;

    var fqdn = XRegExp.build('^({{hostname}}\\.)+[a-zA-Z]{2,30}$', {hostname: hostName});

    reBuildSubs.fqdn = fqdn;

    var ipv4 = /^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])$/;

    reBuildSubs.ipv4 = ipv4;

    var strict_ipv4 = /^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

    reBuildSubs.strict_ipv4 = strict_ipv4;

    var basic_ipv4 = /^((\d{1,3}\.){3}\d{1,3})$/;

    reBuildSubs.basic_ipv4 = basic_ipv4;

    var ipv6 = new RegExp('^(' +
        '([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|' +
        '([0-9a-fA-F]{1,4}:){1,7}:|' +
        '([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|' +
        '([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|' +
        '([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|' +
        '([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|' +
        '([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|' +
        '[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|' +
        ':((:[0-9a-fA-F]{1,4}){1,7}|:)|' +
        'fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|' +
        '::(ffff(:0{1,4}){0,1}:){0,1}' +
        '((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}' +
        '(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|' +
        '([0-9a-fA-F]{1,4}:){1,4}:' +
        '((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}' +
        '(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])' +
        ')$'
    );

    reBuildSubs.ipv6 = ipv6;

    var email = XRegExp.build('^{{name}}@{{fqdn}}$', {
        name: /^\S{2,50}$/,
        fqdn: fqdn
    });

    reBuildSubs.email = email;

    var severity = XRegExp('^(' +
        'CRITICAL|' +
        'ERROR|' +
        'WARNING|' +
        'MAJOR|' +
        'INDETERMINATE|' +
        'CLEAR|' +
        'FAIL|' +
        'PASS' +
        ')$');

    reBuildSubs.severity = severity;

    var number = XRegExp('^[0-9]+?$');

    reBuildSubs.number = number;

    var text = XRegExp('^.+?$');

    reBuildSubs.text = text;

    var any = XRegExp('^.*?$');

    reBuildSubs.any = any;


    // A list of all tests above in order of checking
    //
    var reTests = ['time', 'date', 'dateTime', 'epoch', 'severity', 'hostName', 'ipv4', 'ipv6', 'email', 'fqdn', 'number', 'text', 'any'];

    return reBuildSubs;
}