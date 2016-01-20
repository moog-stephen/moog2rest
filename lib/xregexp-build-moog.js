/**
 * Created by Stephen on 09/12/2015.
 */


// XRegExp named sub patterns used by Moog
// Always add a space at start and end
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

// 13th May 2014 - 14 July 2017
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

function runReTests(textToTest) {
    textToTest = textToTest.trim();

    return reTests.filter(function (test) {
        return XRegExp.test(textToTest, eval(test));
    })
}

