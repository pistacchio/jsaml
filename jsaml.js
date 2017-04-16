"use strict";

(function () {
    const root = this;
    const previousJsaml = root.jsaml;

    const hasRequire = typeof require !== 'undefined';
    let jsyaml = root.jsyaml;

    // Default syntax, can be overwritten with options
    let OPEN_FUNCION_BRACKET  = '(';
    let CLOSE_FUNCION_BRACKET = ')';
    let GET_PROPERTY          = 'get';
    let SET_PROPERTY          = 'set';
    let INCLUDE_SIGNAL        = '@include';

    // Once found the various hooks in the source, they're replaced with
    // signals before being actually converted to funcions
    const SIGNAL_FN    = '__jsaml_fn__';
    const INCLUDE_FILE = '__jsaml_include__';

    // Jsaml needs jsyaml
    if(typeof jsyaml === 'undefined') {
      if(hasRequire) {
        jsyaml = require('js-yaml');
      }
      else throw new Error('jsaml requires js-yaml, see https://github.com/nodeca/js-yaml');
    }

    const optionsDefault = {
        open_funcion_bracket:  OPEN_FUNCION_BRACKET,
        close_funcion_bracket: CLOSE_FUNCION_BRACKET,
        get_property:          GET_PROPERTY,
        set_property:          SET_PROPERTY,
        include_signal:        INCLUDE_SIGNAL
    };

    /**
     * Parse a Jsaml string into a ES6 Javascript object
     * @param  {String} string                        - Input string in Jsaml format
     * @param  {Object} [options={}]                  - By default, load() uses the options defined in
     *                                                - optionsDefault, but all of them can be overwritten
     * @param  {String} options.open_funcion_bracket  - By default a function is signaled by '(' and ')',
     *                                                  but opening and closing brackets can be overwritten
     *                                                  (eg: "[{}]")
     * @param  {String} options.close_funcion_bracket - By default a function is signaled by '(' and ')',
                                                        but opening and closing brackets can be overwritten
                                                        (eg: "[{}]")
     * @param  {String} options.get_property          - By default, if an object has only a "get" and / or a "set" function,
     *                                                  they're converted into ES6 getters and setters.
     *                                                  The name of those getter / setter functions can be redefined
     *                                                  (eg: my_get)
     * @param  {String} options.set_property          - By default, if an object has only a "get" and / or a "set" function,
     *                                                  they're converted into ES6 getters and setters.
     *                                                  The name of those getter / setter functions can be redefined
     *                                                  (eg: my_set)
     * @param  {String} options.include_signal        - By default, Jsaml files can include other Jsaml files with "@include"
     *                                                  This can be redefined (eg: @my_include)
     * @return {Object}                               - Object created from parsing the input string
     */
    function load (string, options = {}) {
        // Clone the default options dictionary to prevent littering it
        // and merge it with use-provided options
        const optionsDefaultCopy = Object.assign({}, optionsDefault);
        options = Object.assign(optionsDefaultCopy, options);

        // The signals will be looked for line by line, so treat the source text as
        // an array of strings
        const lines = string.split('\n');

        // Regular expressions looking for Jsam signals.
        // singleLineFunctionObjRegex:     functionProperty: (arg1, arg2) return 42;
        // singleLineFunctionArrayRegex:   - (arg1, arg2) return 42;
        // multiLineFunctionObjRegex:      functionProperty: (arg1, arg2)
        // multiLineFunctionArrayRegex:    - (arg1, arg2)
        // includeObjRegex:                includedProperty: @include /path/to/file
        // includeArrayRegex:              - @include /path/to/file
        const singleLineFunctionObjRegex   = new RegExp(`^(\\s*)(.*?)\\s*\\:\\s*\\${options.open_funcion_bracket}(.*?)\\${options.close_funcion_bracket}(.*?)$`);
        const singleLineFunctionArrayRegex = new RegExp(`^(\\s*)-\\s*\\${options.open_funcion_bracket}(.*?)\\${options.close_funcion_bracket}(.*?)$`);
        const multiLineFunctionObjRegex    = new RegExp(`^(\\s*)(.*?)\\s*\\:\\s*\\${options.open_funcion_bracket}(.*?)\\${options.close_funcion_bracket}\\s*$`);
        const multiLineFunctionArrayRegex  = new RegExp(`^(\\s*)-\\s*\\${options.open_funcion_bracket}(.*?)\\${options.close_funcion_bracket}\\s*$`);
        const includeObjRegex              = new RegExp(`^(\\s*)(.*?)\\s*\\:\\s*\\${options.include_signal}\\s+(.*?)\\s*$`);
        const includeArrayRegex            = new RegExp(`^(\\s*)-\\s*\\${options.include_signal}\\s+(.*?)\\s*$`);

        // Comparing arrays is done by JSON.stringifying them. These are the
        // strings to check if an object has only get / set attributes
        const getJSON = JSON.stringify([options.get_property]);
        const setJSON = JSON.stringify([options.set_property]);
        const getSetJSON = JSON.stringify([options.get_property, options.set_property]);

        // Loop each line and use the previously defined regular expressions to find Jsaml syntax
        // and place signals that will be used the followin pass
        for (let i = 0; i < lines.length; i++) {
            // Indentation of the following line (used to indent multiline functions)
            let nextLineIndentation = 0;
            if (i+1 < lines.length) {
                const match = lines[i+1].match(/(\s*)/);
                if (match.length > 0) nextLineIndentation = match[0];
            }

            // Place all the signals. For instance
            // propertyFunction: (arg1) return 42; -> propertyFunction: __jsaml_fn__(arg1) return 42;
            lines[i] = lines[i].replace(multiLineFunctionObjRegex, `$1$2: >\n${nextLineIndentation}${SIGNAL_FN}($3)`);
            lines[i] = lines[i].replace(multiLineFunctionArrayRegex, `$1- >\n${nextLineIndentation}${SIGNAL_FN}($2)`);
            lines[i] = lines[i].replace(singleLineFunctionObjRegex, `$1$2: ${SIGNAL_FN}($3) $4`);
            lines[i] = lines[i].replace(singleLineFunctionArrayRegex, `$1- ${SIGNAL_FN}($2) $3`);
            lines[i] = lines[i].replace(includeObjRegex, `$1$2: ${INCLUDE_FILE} $3`);
            lines[i] = lines[i].replace(includeArrayRegex, `$1- ${INCLUDE_FILE} $2`);
        }

        string = lines.join('\n');

        // Convert the YAML-formatted string into a Javascript object
        let yml = jsyaml.safeLoad(string);

        /**
         * Recursive function. When it finds a string value, checks to see if it has
         * a signal and actually converts the string into a function, a getter or a setter
         * or includes a string
         * @param  {Object} obj - Javascript object parsed from the source YAML string
         * @return {Object}     - The same object with inserted functions / files / getters / setters
         */
        function replaceSignals (obj) {
            let k;
            if (obj instanceof Object) {
                for (k in obj) {
                    if (obj.hasOwnProperty(k)) {
                        if (typeof obj[k] === 'string') {
                            // If the string has a function signal, extract the arguments,
                            // the body and creates an actual function.
                            // Example:
                            // propertyFunction: __jsaml_fn__(arg1) return 42; -> propertyFunction: function (arg1) {return 42};
                            if (obj[k].trim().indexOf(SIGNAL_FN) === 0) {
                                const rex = new RegExp(`${SIGNAL_FN}\\((.*?)\\)`);
                                const [match, args] = rex.exec(obj[k]);
                                const body = obj[k].replace(rex, '');
                                const argsPlusBody = args.split(',').concat([body]);
                                obj[k] = Function.constructor.apply(obj, argsPlusBody);

                            // If the string has an include signal, includes the Jsaml file (loading it)
                            // Loading Jsaml files and parsing them is recursive
                            } else if (obj[k].trim().indexOf(INCLUDE_FILE) === 0) {
                                const rex = new RegExp(`${INCLUDE_FILE}\\s+(.*)`);
                                const [match, file] = rex.exec(obj[k]);
                                obj[k] = loadFromFile(file, options);
                            }
                        } else {
                            replaceSignals(obj[k]);

                            // If an object has only a "get" function, or a "set" function or both,
                            // convert them into actual ES6 getters and setters
                            if (obj[k] instanceof Object) {
                                const objKeys = JSON.stringify(Object.keys(obj[k]).sort());
                                if (objKeys === getJSON || objKeys === setJSON || objKeys === getSetJSON) {
                                    let getSetObj = {};
                                    if (obj[k].hasOwnProperty(options.get_property)) {
                                        getSetObj.get = obj[k][options.get_property].bind(obj)
                                    }
                                    if (obj[k].hasOwnProperty(options.set_property)) {
                                        getSetObj.set = obj[k][options.set_property].bind(obj)
                                    }
                                    Object.defineProperty(obj, k, getSetObj);
                                    delete obj[options.get_property];
                                    delete obj[options.set_property];
                                }
                            }
                        }
                    }
                }
            }


            return obj
        }

        return replaceSignals(yml);
    }

    /**
     * Loads a Jsaml file and converts it. It is also used when including files
     * @param  {String} filename - Path to the file to load
     * @param  {Object} options  - See the description of options in load()
     * @return {Object}          - Object created from parsing the input file
     */
    function loadFromFile (filename, options) {
        let fs = root.fs;

        if(typeof fs === 'undefined') {
          if(hasRequire) {
            fs = require('fs');
          }
          else throw new Error('jsaml cannot load from files in a browser environment.');
        }

        let filecontent = fs.readFileSync(filename).toString();
        return load(filecontent, options);
    }

    const jsaml = {
        load,
        loadFromFile
    }

    jsaml.noConflict = function() {
      root.jsaml = previousJsaml;
      return jsaml;
    }

    if( typeof exports !== 'undefined' ) {
        if( typeof module !== 'undefined' && module.exports ) {
            exports = module.exports = jsaml;
        }
        exports.jsaml = jsaml;
    } else {
        root.jsaml = jsaml
    }
}).call(this);
