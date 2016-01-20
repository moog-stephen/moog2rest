/**
 * Created by Stephen on 29/11/2015.
 */

exports.sendPage = function (page, socket) {

    var fs = require('fs');

    console.log('Sending the page ' + page);

    page = page.replace('#', '');

    fs.readFile('./pages/' + page + '.min.html', 'utf8', function (err, pageContent) {
        if (err) {
            console.log('Error loading page. ' + err);
            socket.emit('page', {pageName: page, pageContent: err});
            return;
        }
        socket.emit('page', {pageName: page, pageContent: pageContent});
    });
};