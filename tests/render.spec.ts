import {tokenize, parse, dump, transform} from "../parser";

describe('tokenize解析', ()=> {
    test('p标签解析', () => {
        const str = `<p>hello world</p>`;
        const expects = [
            { type: 'tag', name: 'p' },
            { type: 'text', content: 'hello world' },
            { type: 'tagEnd', name: 'p' },
        ];
        const tokens = tokenize(str)
        expects.forEach((token, i) => {
            expect(JSON.stringify(token)).toBe(JSON.stringify(tokens[i]))
        })
    })
    test('标签多个解析', ()=>{
        const str = `<div><p>Vue</p><p>Template</p></div>`
        const expects = [
            { type: 'tag', name: 'div' },
            { type: 'tag', name: 'p' },
            { type: 'text', content: 'Vue' },
            { type: 'tagEnd', name: 'p' },
            { type: 'tag', name: 'p' },
            { type: 'text', content: 'Template' },
            { type: 'tagEnd', name: 'p' },
            { type: 'tagEnd', name: 'div' },
        ]
        const tokens = tokenize(str)
        expects.forEach((token, i) => {
            expect(JSON.stringify(token)).toBe(JSON.stringify(tokens[i]))
        })
    })
})

describe('template ast解析', () => {
    test('嵌套标签解析', () => {
        const str = `<div><p>Vue</p><p>Template</p></div>`
        const expects = {
            type: 'Root',
            children: [
                {
                    type: 'Element',
                    tag: 'div',
                    children: [
                        {
                            type: 'Element',
                            tag: 'p',
                            children: [
                                {
                                    type: 'Text',
                                    content: 'Vue'
                                }
                            ]
                        },
                        {
                            type: 'Element',
                            tag: 'p',
                            children: [
                                {
                                    type: 'Text',
                                    content: 'Template'
                                }
                            ]
                        }
                    ]
                }
            ]
        }
        const ast = parse(str)
        expect(JSON.stringify(ast)).toBe(JSON.stringify(expects))
    })

    test('template ast 打印', () => {
        const str = `<div><p>Vue</p><p>Template</p></div>`
        const ast = parse(str)
        expect(ast).not.toBe(undefined)
        const printed = dump(ast, 0)
        const expects = `Root: 
--Element: div
----Element: p
------Text: Vue
----Element: p
------Text: Template\n`
        expect(printed).toBe(expects)
    })

    // test('转换ast', () => {
    //     const str = `<div><p>Vue</p><p>Template</p></div>`
    //     const ast = transform(parse(str))
    //     const expects = {
    //         type: 'Root',
    //         children: [
    //             {
    //                 type: 'Element',
    //                 tag: 'div',
    //                 children: [
    //                     {
    //                         type: 'Element',
    //                         tag: 'h1',
    //                         children: [
    //                             {
    //                                 type: 'Text',
    //                                 content: 'VueVue'
    //                             }
    //                         ]
    //                     },
    //                     {
    //                         type: 'Element',
    //                         tag: 'h1',
    //                         children: [
    //                             {
    //                                 type: 'Text',
    //                                 content: 'TemplateTemplate'
    //                             }
    //                         ]
    //                     }
    //                 ]
    //             }
    //         ]
    //     }
    //
    //     expect(JSON.stringify(ast)).toBe(JSON.stringify(expects))
    // })
})

describe('javascript AST 解析', () => {
    test('render ast', () => {
        const str = `<div><p>Vue</p><p>Template</p></div>`
        const expects = {
            type: 'FunctionDecl', // 函数声明
            id: {
                type: 'Identifier',
                name: 'render'
            },
            params: [],
            body: [
                {
                    type: 'ReturnStatement',
                    return: {
                        type: 'CallExpression',
                        callee: { type: 'Identifier', name: 'h' },
                        arguments: [
                            { type: 'StringLiteral', value: 'div' },
                            { type: 'ArrayExpression', elements: [
                                    {
                                        type: 'CallExpression',
                                        callee: { type: 'Identifier', name: 'h' },
                                        arguments: [
                                            { type: 'StringLiteral', value: 'p' },
                                            { type: 'StringLiteral', value: 'Vue' }
                                        ]
                                    },
                                    {
                                        type: 'CallExpression',
                                        callee: { type: 'Identifier', name: 'h' },
                                        arguments: [
                                            { type: 'StringLiteral', value: 'p' },
                                            { type: 'StringLiteral', value: 'Template' }
                                        ]
                                    }
                                ]
                            }
                        ]
                    }
                }
            ]
        }
        const ast = transform(parse(str))
        console.log(ast)
        expect(JSON.stringify(!ast ? {} : ast.jsNode)).toBe(JSON.stringify(expects))
    })
})