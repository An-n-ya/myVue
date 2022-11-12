export {tokenize}
const State = {
    initial: 1,     // 初始状态
    tagOpen: 2,     // 标签开始状态
    tagName: 3,     // 标签名称状态
    text: 4,        // 文本状态
    tagEnd: 5,      // 结束标签状态
    tagEndName: 6   // 结束标签名称状态
}

// region 帮助函数
function isAlpha(char: string) {
    return char >= 'a' && char <= 'z' || char >= 'A' && char <= 'Z'
}
function isText(char: string) {
    return char >= 'a' && char <= 'z' || char >= 'A' && char <= 'Z' || char == ' ' || char == '\n'
}

// endregion

/**
 * 讲字符串切割为token
 * @param str 输入字符串
 * @return token 数组
 */
function tokenize(str: string) {
    let currentState = State.initial
    const chars = []
    const tokens = []
    while (str.length != 0) {
        const char = str[0]
        switch (currentState) {
            case State.initial:
                if (char === '<') {
                    // 遇到 <，状态机切换到标签开始状态
                    currentState = State.tagOpen
                } else if (isAlpha(char)) {
                    // 遇到字母，切换到text状态
                    currentState = State.text
                    chars.push(char)
                }
                break
            case State.tagOpen:
                if (isAlpha(char)) {
                    // 遇到字母，切换到tagName状态
                    currentState = State.tagName
                    chars.push(char)
                } else if (char === '/') {
                    // 说明是 "</"开头的，是结束标签
                    currentState = State.tagEnd
                }
                break
            case State.tagName:
                if (isAlpha(char)) {
                    chars.push(char)
                } else if (char === '>') {
                    currentState = State.initial
                    tokens.push({
                        type: 'tag',
                        name: chars.join('')
                    })
                    // 清空chars
                    chars.length = 0
                }
                break
            case State.text:
                if(isText(char)) {
                    chars.push(char)
                } else if (char === '<') {
                    // 文本状态结束
                    currentState = State.tagOpen
                    tokens.push({
                        type: 'text',
                        content: chars.join('')
                    })
                    // 清空chars
                    chars.length = 0
                }
                break
            case State.tagEnd:
                if (isAlpha(char)) {
                    currentState = State.tagEndName
                    chars.push(char)
                }
                break
            case State.tagEndName:
                if (isAlpha(char)) {
                    chars.push(char)
                } else if (char === '>') {
                    // 结束标签结束
                    currentState = State.initial
                    tokens.push({
                        type: 'tagEnd',
                        name: chars.join('')
                    })
                    chars.length = 0
                }
                break
        }

        str = str.slice(1)
    }
    return tokens
}
