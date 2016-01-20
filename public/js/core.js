/**
 * Created by Stephen on 29/11/2015.
 */

var socket = io();
var $messages = $("#messages");
var $pageContent = $("#pageContent");
var $statusIcon = $("#status-icon");

var uiState = {};
var eventDataArraySize = 10;
var eventDataArray = [];

var displayEvents = '';


// Max number of characters in the sample string
const SAMPLNG = 20;

if ($.isEmptyObject(uiState)) {
    socket.emit('stateData', {action: 'load'});
}


$(document).ready(function () {
    socket.emit('page', '#listen');
    if ($.isEmptyObject(uiState)) {
        socket.emit('stateData', {action: 'load'});
    }
});

$(window).on('load', function () {
});


$('.nav li').click(function (event) {
    $('.nav li').removeClass('active');
    $(this).addClass('active');
    $messages.html("loading page.. " + JSON.stringify($(this).find('a:first').attr('href')));
    socket.emit('page', $(this).find('a:first').attr('href'));
    $statusIcon.removeClass(function (index, css) {
        return (css.match(/(^|\s)icon-\S+/g) || []).join(' ');
    });
    $pageContent.html("<span class=\"glyphicon glyphicon-refresh glyphicon-refresh-animate\"></span>");
    $statusIcon.addClass('icon-warning');
});


//Monitor graph
var inData = [];
var outData = [];
var discardData = [];
var maximum = 300;
var localData;

series = [
    {
        data: addNext(0, 'I'),
        lines: {
            fill: true
        }
    },
    {
        data: addNext(0, 'O'),
        lines: {
            fill: false
        }
    },
    {
        data: addNext(0, 'D'),
        lines: {
            fill: false
        }
    }
];


function addNext(value, type) {


    if (type === 'I') {
        localData = inData;
    }
    if (type === 'O') {
        localData = outData;
    }
    if (type === 'D') {
        localData = discardData;
    }

    if (localData.length) {
        localData = localData.slice(1);
    }

    while (localData.length < maximum) {
        var y = value;
        localData.push(y < 0 ? 0 : y > 100 ? 100 : y);
    }

    // zip the generated y values with the x values

    var res = [];
    for (var i = 0; i < localData.length; ++i) {
        res.push([i, localData[i]])
    }

    if (localData.length) {
        localData = localData.slice(1);
    }

    if (type === 'I') {
        inData = localData;
    }
    if (type === 'O') {
        outData = localData;
    }
    if (type === 'D') {
        discardData = localData;
    }

    return res;
}

// Update the dataset at each new count
socket.on('eventCount', function (message) {
    debugger;
    message = JSON.parse(message);

    if (!message.inCount || message.inCount < 0) {
        series[0].data = addNext(0, 'I');
    }
    else {
        series[0].data = addNext(message.inCount, 'I');
    }

    if (!message.outCount || message.outCount < 0) {
        series[1].data = addNext(0, 'O');
    }
    else {
        series[1].data = addNext(message.outCount, 'O');
    }

    if (!message.discardCount || message.discardCount < 0) {
        series[2].data = addNext(0, 'D');
    }
    else {
        series[2].data = addNext(message.discardCount, 'D');
    }
});


// Socket.io comms section
//

// Comms from the server
//
socket.on('page', function (pagePartial) {
    $messages.html("Got Page.. ");
    $pageContent.html(pagePartial.pageContent);
    $statusIcon.removeClass(function (index, css) {
        return (css.match(/(^|\s)icon-\S+/g) || []).join(' ');
    });
    $statusIcon.addClass('icon-success');
    fillObject(uiState, 'page', pagePartial.pageName);

    switch (chkPath(uiState, 'page')) {
        case 'listen':
            $listenDataField.html(displayEvents);
            break;
        case 'parse':
            $listenDataField.html(displayEvents);
            break;
        default:
    }
});

socket.on('eventData', function (dataMessage) {
    var bold = false;
    $messages.html("Got data...");
    if (eventDataArray.length < eventDataArraySize) {
        eventDataArray.push(String(dataMessage.dataRow));
    }
    else {
        eventDataArray.shift();
        eventDataArray.push(String(dataMessage.dataRow));
    }
    if (eventDataArray.length > eventDataArraySize) {
        do {
            eventDataArray.shift();
        } while (eventDataArray.length > eventDataArraySize);
    }

    if (chkPath(uiState, 'page') === 'listen' || chkPath(uiState, 'page') === 'parse') {
        displayEvents = '';
        eventDataArray.forEach(function (row) {
            if (bold) {
                displayEvents += '<p><strong>' + row + '</strong></p>';
                bold = false;
            }
            else {
                displayEvents += '<p>' + row + '</p>';
                bold = true;
            }
        });
        /*if (chkPath(uiState, 'page') === 'parse') {
         // highlightMatches is found in the parse.html script
         displayEvents = highlightMatches(displayEvents);
         }*/
        $listenDataField.html(displayEvents);
    }
});

socket.on('stateData', function (config) {
    if (config.confLoad) {
        $messages.html("Options loaded.. ");
        uiState = JSON.parse(config.data);
        if (uiState.readOnly) {
            $saveButton.prop('disabled', true);
        }
        toSave('loaded');
    }

    $statusIcon.removeClass(function (index, css) {
        return (css.match(/(^|\s)icon-\S+/g) || []).join(' ');
    });
    $statusIcon.addClass('icon-success');

    if (chkPath(uiState, 'listen.cache')) {
        eventDataArraySize = chkPath(uiState, 'listen.cache');
    }

    if (chkPath(uiState, 'stream.play')) {
        $playButton.trigger('click');
    }

    // TODO Load the data into the input fields
    switch (chkPath(uiState, 'page')) {
        case 'listen':
            $('#listen_data_field').html(displayEvents);
            break;
        default:
    }
});

socket.on('message', function (message) {
    $statusIcon.removeClass(function (index, css) {
        return (css.match(/(^|\s)icon-\S+/g) || []).join(' ');
    });

    if (message.status == 'D') {
        $statusIcon.addClass('icon-danger');
    }
    if (message.status == 'S') {
        $statusIcon.addClass('icon-success');
    }
    $messages.html(message.text);
});

/**
 *
 * @param {string} str
 * @param {string} find
 * @param {string} replace
 * @returns {string}
 */
function replaceAll(str, find, replace) {
    return str.replace(new RegExp(find, 'g'), replace);
}

/**
 * Set field defaults and attach change event handler
 * @param {string} param
 */
function setField(param) {
    var subParam;
    var inputId = param.replace(/\./g, '_');
    var defParam = chkPath(uiState, param);
    var $element = $('#' + inputId);

    if ($element.length === 0) {
        return;
    }

    $element = $element ? $element : $("input[name='" + inputId + "'][value='" + defParam + "']");


    if (typeof defParam === 'object') {
        for (subParam in defParam) {
            if (defParam.hasOwnProperty(subParam)) {
                setField(param + '.' + subParam);
            }
        }
    }
    fillObject(uiState, param, defParam);

    if ($element.is(':checkbox')) {
        $element.prop('checked', defParam);
    }
    if ($element.is(':radio')) {
        $element.prop('checked', true);
    }
    if ($element.is(':text') || $element.is('textarea') || $element.is(':password') || $element.prop('type') === 'number') {
        $element.val(defParam);
    }
}

/**
 * Wire up a change handler to every input field
 */
function connectChange() {
    $(":input")
        .change(function () {
            var $element = $(this);
            var id = this.id.replace(/_/g, '.');
            if (id) {
                if ($element.is(':checkbox')) {
                    fillObject(uiState, id, $element.prop('checked'));
                }
                else {
                    fillObject(uiState, id, $element.val());
                }
                toSave('dirty');
            }
        });
}

