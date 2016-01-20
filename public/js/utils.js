/**
 * Created by Stephen on 02/12/2015.
 */
/**
 * Tests for the existence of a value or sub-object included in the object tree to access the object/value.
 * @param {object} obj Core object to test
 * @param {string} path The full path to the node required
 * @returns {*} undefined or the value of the node
 */
function chkPath(obj, path) {
    'use strict';

    //console.log('chkPath');

    var keys = path.split('.');
    var cur = obj;
    var key;

    if (!cur || cur == null || typeof(cur) === 'undefined') {
        console.log("chkPath: Object passed was not defined for path " + path);
        return;
    }
    // Start from 0 because we don't expect the base object name to be index 0
    //
    for (var i = 0; i < keys.length; i++) {
        key = keys[i];
        cur = cur[key];
        if (typeof(cur) === 'undefined') {
            return;
        }
    }
    return cur;
}
//
// End function chkPath

/**
 * @function fillObject
 * @description fillObject populates an object property tree dynamically.
 * @param {object} obj - the target object by reference
 * @param {string} path - full path to the leaf name
 * @param {*} value - value to add to the leaf defined in path
 * @param {boolean} [merge] - True to merge existing keys with the new or false or overwrite, default false
 * @returns {object} o by reference
 * @borrows {function} isEmpty
 */
function fillObject(obj, path, value, merge) {
    'use strict';

    if (typeof(merge) === 'undefined') {
        merge = true;
    }

    if (typeof(obj) !== "object") {
        console.log("fillObject failed because first parameters is not an object type. type:  " + typeof(obj) + " Path:" + path);
        return false;
    }

    if (obj == null) {
        console.log("fillObject failed because first parameters is null, Path:" + path);
        return false;
    }

    var keys = path.split('.');
    var objType;
    var valType;
    if (Object.prototype.toString.call(value) === '[object Array]') {
        valType = "array";
    }

    for (var i = 0; i < keys.length; i++) {

        if (obj === {} || !obj.hasOwnProperty(keys[i])) {
            if (i < keys.length - 1) {
                obj = obj[keys[i]] = {};
            }
            else {
                obj[keys[i]] = value;
            }
        }
        else {
            objType = typeof obj[keys[i]];
            if (Object.prototype.toString.call(obj[keys[i]]) === '[object Array]') {
                objType = "array";
            }

            if (objType === 'object') {
                if (merge) {
                    obj = obj[keys[i]];
                }
                else {
                    obj = obj[keys[i]] = {};
                }
            }
            else if (objType === 'array' && valType === 'array' && merge) {
                obj = obj[keys[i]] = obj[keys[i]].concat(value);
            }
            else {
                if (i < keys.length - 1) {
                    obj = obj[keys[i]] = {};
                }
                else {
                    obj[keys[i]] = value;
                }
            }
        }
    }
}
//
//  End function fillObject