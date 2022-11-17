import {parse} from '../parse'

describe('基础parser', () => {
    test('div标签解析', () => {
        const template = `<div>
    <p>Text1</p>
    <p>Text2</p>
</div>`
        const res = parse(template)
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
                                    content: 'Text1'
                                }
                            ]
                        },
                        {
                            type: 'Element',
                            tag: 'p',
                            children: [
                                {
                                    type: 'Text',
                                    content: 'Text2'
                                }
                            ]
                        }
                    ]
                }
            ]
        }

        expect(JSON.stringify(res)).toBe(JSON.stringify(expects))
    })
})