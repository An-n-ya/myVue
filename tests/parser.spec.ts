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
                    props: [],
                    children: [
                        {
                            type: 'Element',
                            tag: 'p',
                            props: [],
                            children: [
                                {
                                    type: 'Text',
                                    content: 'Text1'
                                }
                            ],
                            isSelfClosing: false
                        },
                        {
                            type: 'Element',
                            tag: 'p',
                            props: [],
                            children: [
                                {
                                    type: 'Text',
                                    content: 'Text2'
                                }
                            ],
                            isSelfClosing: false
                        }
                    ],
                    isSelfClosing: false
                }
            ]
        }

        expect(JSON.stringify(res )).toBe(JSON.stringify(expects ))
    })
})