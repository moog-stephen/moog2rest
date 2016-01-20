/**
 * Created by Stephen on 01/12/2015.
 */

var $messages = $("#messages");
var $statusIcon = $("#status-icon");
var $saveButton = $('#save-button');
var $cancelButton = $('#cancel-button');
var $observeButton = $('#observe-button');
var $playButton = $('#play-button');
var $pauseButton = $('#pause-button');
var $stopButton = $('#stop-button');

$(document).ready(function () {
    socket.emit('config', {action: 'load'});
});

$saveButton.click(function (event) {
    $messages.html("saving options.. ");
    socket.emit('stateData', {action: 'save', data: JSON.stringify(uiState)});
    $statusIcon.removeClass(function (index, css) {
        return (css.match(/(^|\s)icon-\S+/g) || []).join(' ');
    });
    $statusIcon.addClass('icon-warning');
    toSave('saved');
});

$cancelButton.click(function (event) {
    $messages.html("reset options.. ");
    socket.emit('stateData', {action: 'load'});
    $statusIcon.removeClass(function (index, css) {
        return (css.match(/(^|\s)icon-\S+/g) || []).join(' ');
    });
    $statusIcon.addClass('icon-warning');
});

$observeButton.click(function (event) {
    if ($('span:first', this).hasClass('glyphicon-eye-close')) {
        $('span:first', this).removeClass('glyphicon-eye-close');
        $('span:first', this).addClass('glyphicon-eye-open').removeClass('text-info');
        uiState.stream.observe = true;
    }
    else {
        $('span:first', this).removeClass('glyphicon-eye-open');
        $('span:first', this).addClass('glyphicon-eye-close').addClass('text-info');
        uiState.stream.observe = false;
    }
    socket.emit('appState', {key: 'stream.observe', value: uiState.stream.observe});
});

$playButton.click(function (event) {
    if (!$('span:first', this).hasClass('text-success')) {
        $('span:first', this).addClass('text-success');
        $('span:first', $pauseButton).removeClass('text-warning');
        $pauseButton.prop('disabled', false);
        $('span:first', $stopButton).removeClass('text-danger');
        uiState.stream.play = true;
        uiState.stream.paused = false;
        uiState.stream.stopped = false;
        socket.emit('appState', {key: 'stream.play', value: uiState.stream.play});
    }
});

$pauseButton.click(function (event) {
    if ($('span:first', this).hasClass('text-warning')) {
        $('span:first', this).removeClass('text-warning');
        $('span:first', $playButton).addClass('text-success');
        uiState.stream.paused = false;
        uiState.stream.play = true;
    }
    else {
        $('span:first', this).addClass('text-warning');
        $('span:first', $playButton).removeClass('text-success');
        $('span:first', $stopButton).removeClass('text-danger');
        uiState.stream.play = false;
        uiState.stream.paused = true;
        uiState.stream.stopped = false;
        $messages.html('Please start the event source.');
    }
    socket.emit('appState', {key: 'stream.paused', value: uiState.stream.paused});
});

$stopButton.click(function (event) {
    if (!$('span:first', this).hasClass('text-danger')) {
        $('span:first', this).addClass('text-danger');
        $('span:first', $pauseButton).removeClass('text-warning');
        $pauseButton.prop('disabled', true);
        $('span:first', $playButton).removeClass('text-success');
        uiState.stream.play = false;
        uiState.stream.paused = false;
        uiState.stream.stopped = true;
        socket.emit('appState', {key: 'stream.stopped', value: uiState.stream.stopped});
    }
});

function toSave(action) {

    if (action === 'dirty') {
        if ($('span:first', $saveButton).hasClass('glyphicon-saved')) {
            $('span:first', $saveButton).removeClass('glyphicon-saved');
            $('span:first', $saveButton).addClass('glyphicon-save');
            $('span:first', $saveButton).addClass('text-warning');
        }
    }
    if (action === 'saved' || action === 'loaded') {
        if ($('span:first', $saveButton).hasClass('glyphicon-save')) {
            $('span:first', $saveButton).removeClass('glyphicon-save');
            $('span:first', $saveButton).addClass('glyphicon-saved');
            $('span:first', $saveButton).removeClass('text-warning');
        }
    }
}