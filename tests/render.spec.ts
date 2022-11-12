import {tokenize} from "../parser";

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
})
