import {tokenize, parse} from "../parser";

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

})