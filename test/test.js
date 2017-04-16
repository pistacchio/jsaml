const assert = require('chai').assert;
const jsaml = require('../jsaml');

describe('Test jsaml parser', function () {
    it('should transform inline functions without arguments', () => {
        const testString = `
            object:
                string: A string
                int: 42
                function: () return 'it works';
                array:
                    - item1
                    - 43
                    - () return 'this works as well';
        `;

        const jsamlObj = jsaml.load(testString);

        assert.equal(jsamlObj.object.string, 'A string');
        assert.equal(jsamlObj.object.int, 42);
        assert.equal(jsamlObj.object.function(), 'it works');
        assert.equal(jsamlObj.object.array[2](), 'this works as well');
    });

    it('should transform inline functions with arguments', () => {
        const testString = `
            object:
                string: A string
                int: 42
                function: (a, b) return a + b;
                array:
                    - item1
                    - 43
                    - (a, b) return a * b;
        `;

        const jsamlObj = jsaml.load(testString);

        assert.equal(jsamlObj.object.function(4, 2), 6);
        assert.equal(jsamlObj.object.array[2](4, 2), 8);
    });

    it('should transform inline getters and setters', () => {
        const testString = `
            object:
                withGetter:
                    get: () return 'got';
                withSetter:
                    set: (value) this.setter1 = value + 1;
                withGetterAndSetter:
                    get: () return this.setter2;
                    set: (value) this.setter2 = value + 2;
        `;

        const jsamlObj = jsaml.load(testString);

        assert.equal(jsamlObj.object.withGetter, 'got');
        assert.equal(jsamlObj.object.withSetter, undefined);
        jsamlObj.object.withSetter = 4;
        assert.equal(jsamlObj.object.setter1, 5);
        jsamlObj.object.withGetterAndSetter = 5;
        assert.equal(jsamlObj.object.withGetterAndSetter, 7);
    });

    it('should transform multiline functions', () => {
        const testString = `
            object:
                multiline: ()
                    let val = 42;
                    return val;
                multilineArgs: (num)
                    if (num % 2 == 0)
                        return num * 2;
                    else
                        return num * 3;
                array:
                    - ()
                        const a = 1;
                        return a * 2;
                    - (num)
                        const a = 5;
                        return a * num;
        `;

        const jsamlObj = jsaml.load(testString);
        assert.equal(jsamlObj.object.multiline(), 42);
        assert.equal(jsamlObj.object.multilineArgs(10), 20);
        assert.equal(jsamlObj.object.multilineArgs(11), 33);
        assert.equal(jsamlObj.object.array[0](), 2);
        assert.equal(jsamlObj.object.array[1](3), 15);
    });

    it('should allow the inclusion of external files', () => {
        const testString = `
            object:
                included: @include test/includeTest.jsaml
            array:
                - 'a'
                - @include test/includeTest.jsaml
        `;

        const jsamlObj = jsaml.load(testString);

        assert.equal(jsamlObj.object.included.included.property1, 42);
        assert.equal(jsamlObj.object.included.included.property2[0], 'a');
        assert.equal(jsamlObj.object.included.included.property2[1], 'b');
        assert.equal(jsamlObj.object.included.included.property2[2], 'c');
        assert.equal(jsamlObj.array[0], 'a');
        assert.equal(jsamlObj.array[1].included.property1, 42);
        assert.equal(jsamlObj.array[1].included.property2[0], 'a');
        assert.equal(jsamlObj.array[1].included.property2[1], 'b');
        assert.equal(jsamlObj.array[1].included.property2[2], 'c');
    });

    it('should allow the redefinition of the invlude signal', () => {
        const testString = `
            object:
                included: @my_include test/includeTest.jsaml
        `;

        const jsamlObj = jsaml.load(testString, {
            include_signal: '@my_include'
        });

        assert.equal(jsamlObj.object.included.included.property1, 42);
        assert.equal(jsamlObj.object.included.included.property2[0], 'a');
        assert.equal(jsamlObj.object.included.included.property2[1], 'b');
        assert.equal(jsamlObj.object.included.included.property2[2], 'c');
    });

    it('should allow the redefine brackets', () => {
        const testString = `
            object:
                changedBrackets: [{}] return 42;
        `;

        const jsamlObj = jsaml.load(testString, {
            open_funcion_bracket:  '[{',
            close_funcion_bracket: '}]'
        });

        assert.equal(jsamlObj.object.changedBrackets(), 42);
    });

    it('should allow the redefine getters and setters', () => {
        const testString = `
            object:
                changedGetterSetter:
                    get2: () return this.getterSetterProperty;
                    set2: (value) this.getterSetterProperty = value * 2;
        `;

        const jsamlGetterSetter = require('../jsaml');

        const jsamlObj = jsaml.load(testString, {
            get_property: 'get2',
            set_property: 'set2'
        });

        jsamlObj.object.changedGetterSetter = 21;
        assert.equal(jsamlObj.object.changedGetterSetter, 42);
    });
});
