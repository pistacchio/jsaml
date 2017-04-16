# Jsaml

Jsaml is [YAML](http://yaml.org/) extension for javascript that allows to define functions, getters, setters and include other Jsaml files converting the Jsaml source file into a ES6 object litaral.

## Usage

```javascript
const jsaml = require('jsaml');

const jsamlString = `
object:
    inlineFunction: (arg) return arg;`;

const myObj = jsaml.load(jsamlString);

const myObjFromFile = jsaml.load('/path/to/my/jsamlFile.jsaml');
```

## Functions

To declare an inline function:

```javascript
object:
    inlineFunction: (arg) return arg;
```

This will be converted to:

```javascript
{
    object: {
        inlineFunction: function (arg) {
            return arg;
        }
    }
}
```

Functions can also be multiline:

```javascript
object:
    multilineFunction: (arg)
        const argTimesTwo = arg * 2;
        return arg;
```

This will be converted to:

```javascript
{
    object: {
        multilineFunction: function (arg) {
            let argTimesTwo = arg * 2;
            return arg;
        }
    }
}
```

This works for arrays as well:

```javascript
object:
    someArray:
        - (arg)
            const argTimesTwo = arg * 2;
            return arg;
```

### Redefine function syntax

If you don't want to use "()" to signal a function, you can pass different opening / closing signals via the option dictionary.


```javascript
const jsamlString = `
object:
    inlineFunction: {{arg]] return arg;`;

const myObj = jsaml.load(jsamlString, options: {
    open_funcion_bracket:  '{{',
    close_funcion_bracket: ']]'    
});
```
## Getters and setters

If an object has only a "get" function, or a "set" function or both, they'll be converted to setters and getters

```javascript
const jsamlString = `
object:
    property:
        get: () return this.prop
        set: (value) this.prop = value * 2`;

const myObj = jsaml.load(jsamlString);

myObj.property = 21;
console.log(myObj.property); // 42
```

### Redefine getters and setters syntax

If you don't want to use "get" and "set", you can pass different opening / closing signals via the option dictionary.

```javascript
const jsamlString = `
object:
    property:
        myGet: () return this.prop
        mySet: (value) this.prop = value * 2`;

const myObj = jsaml.load(jsamlString, options: {
    get_property: 'myGet',
    set_property: 'mySet'
});
```

## Include files

You can also include external Jsaml files:

```javascript
/* myOtherFile.jsaml

externalFile:
    a: 1
    b:
        - 2
        - 3
*/

object:
    includedProperty: @include myOtherFile.jsaml

```

This will be loaded as:

```javascript
{
    object: {
        includedProperty: {
            externalFile: {
                a: 1,
                b: [2, 3]
            }
        }
    }
}
```

### Redefine include syntax

If you don't want to use "@include", you can pass different opening / closing signals via the option dictionary.

```javascript
const jsamlString = `
object:
    property: @myInclude /path/to/file.jsaml

const myObj = jsaml.load(jsamlString, options: {
    include_signal: '@myInclude'
});
```
