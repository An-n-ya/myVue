export {parse}
const TextModes = {
    'DATA':'DATA',
    'RCDATA':'RCDATA',
    'RAWTEXT':'RAWTEXT',
    'CDATA':'CDATA'
}

function printASCII(str: string) {
    let res = ''
    for (let i = 0; i < str.length; i++) {
        res += str.charCodeAt(i).toString(16)
    }
    console.log(res, str)
}

/**
 * parse入口函数
 * @param str
 */
function parse(str: string) {
    // 定义上下文结构
    const context:ParseCtx = {
        source: str,
        mode: TextModes.DATA,
        advanceBy(num: number) {
            context.source = context.source.slice(num)
        },
        advanceSpaces() {
            // 匹配空白字符
            // printASCII(context.source)
            const match = /^[\t\r\n\f ]+/.exec(context.source)
            if (match) {
                // 消费空白字符
                context.advanceBy(match[0].length)
            }
            // console.log('after')
            // printASCII(context.source)
        }
    }

    // 解析子节点
    const nodes = parseChildren(context, [])

    // 返回根节点作为解析结果
    return <TemplateAstNode>{
        type: 'Root',
        children: nodes
    }
}

function parseChildren(context: ParseCtx, ancestors: Ancestor[]) {
    let nodes: TemplateAstNode[] = []
    let {mode, source, advanceSpaces} = context

    // 开启while循环对context的字符串持续解析
    while (!isEnd(context, ancestors)) {
        advanceSpaces()
        mode = context.mode
        source = context.source

        // if (ancestors.length != 0) {
        //     console.log(context)
        //     console.log(context.mode, context.source[0], context.source[1])
        // }
        let node: TemplateAstNode | null = null
        // 只在DATA模式和RCDATA模式支持差值表达式的解析
        if (mode === TextModes.DATA || mode === TextModes.RCDATA) {
            if (mode === TextModes.DATA && source[0] === '<') {
                if(source[1] === '!') {
                    if (source.startsWith('<!--')) {
                        // 解析注释
                        node = parseComment(context)
                    } else if (source.startsWith('<![CDATA[')) {
                        node = parseCDATA(context, ancestors)
                    }
                } else if (source[1] === '/') {
                    // 运行到这里说明标签有交替嵌套
                    // console.error("无效的结束标签")
                    continue
                } else if (/[a-z]/i.test(source[1])) {
                    // 如果第二个字符是字母，说明是标签
                    node = parseElement(context, ancestors)
                }
            } else if (source.startsWith('{{')) {
                // 解析插值表达式
                node = parseInterpolation(context)
            }
        }

        if (!node) {
            // 如果node不存在，说明既不是DATA模式也不是RCDATA模式
            // 这时候统一作为文本节点解析
            node = parseText(context)
        }

        // 将解析完的node加入nodes中
        if (node) nodes.push(node)
    }
    // while循环完后，说明子节点解析完毕，返回nodes
    return nodes
}

/**
 * 判断是否解析完毕
 * @param context
 * @param ancestors
 */
function isEnd(context: ParseCtx, ancestors: Ancestor[]) {
    // 如果source已经被消费完了，直接返回true
    if (context.source.length === 0) return true
    // 取得父标签节点
    const parent = ancestors[ancestors.length - 1]
    // 如果遇到结束标签，并且与父标签节点同名，则停止
    if (parent && context.source.startsWith(`</${parent.tag}>`)) return true

    return false

}

function parseElement(context: ParseCtx, ancestors: Ancestor[]) {
    const element = parseTag(context)
    if (!element || !element.tag) return null
    // 如果是自闭合，直接返回
    if (element.isSelfClosing) return element

    // 切换到对应的文本模式 (三种模式）
    if (element.tag === 'textarea' || element.tag === 'title') {
        context.mode = TextModes.RCDATA
    } else if (/style|xmp|iframe|noembed|noframes|noscript/.test(element.tag)) {
        context.mode = TextModes.RAWTEXT
    } else {
        context.mode = TextModes.DATA
    }

    // 解析子标签
    ancestors.push(element)
    element.children = parseChildren(context, ancestors)
    ancestors.pop()

    // 检查结束标签
    if (context.source.startsWith(`</${element.tag}`)) {
        parseTag(context, 'end')
    } else {
        console.error(`${element.tag} 标签缺少闭合标签 ${context.source}`)
    }
    return element

}

function parseTag(context: ParseCtx, type:string='start'): TemplateAstNode | null {
    const {advanceBy, advanceSpaces} = context
    advanceSpaces()
    const match = type === 'start'
        // 匹配开始标签
        ? /^<([a-z][^\t\r\n\f />]*)/i.exec(context.source)
        // 匹配结束标签
        : /^<\/([a-z][^\t\r\n\f />]*)/i.exec(context.source)
    if (!match) {
        // 既没有解析到 开始标签 也没有解析到 结束标签  报错
        console.error("没有可解析的标签" + context.source + " match: " + match)
        return null
    }
    // 第一个捕获组就是标签名
    const tag = match[1]
    // 消费正则表达式匹配的全部内容，比如<div  或  </div
    advanceBy(match[0].length)
    // 消费无用的空白
    advanceSpaces()

    // 解析标签属性
    const props = parseAttribute(context)

    // 判断是否是自闭合
    const isSelfClosing = context.source.startsWith('/>')
    // 如果是自闭合，消费 />  否则消费 >
    advanceBy(isSelfClosing ? 2 : 1)

    return {
        type: 'Element',
        tag,
        props,
        children: [],
        isSelfClosing

    }
}

function parseAttribute(context: ParseCtx) {
    const props: Prop[] = []
    const {advanceBy, advanceSpaces} = context

    while (
        !context.source.startsWith('>') &&
        !context.source.startsWith('/>')
    ) {
        // 解析属性名
        const match = /^[^\t\r\n\f />][^\t\r\n\f />=]*/.exec(context.source)
        if (!match) {
            console.error("名称解析失败" + context.source)
            return props
        }
        const name = match[0]
        // 消费属性名
        advanceBy(name.length)
        advanceSpaces()
        // 消费等号
        advanceBy(1)
        advanceSpaces()

        // 属性值
        let value = ''
        const quote = context.source[0]
        const isQuoted = quote === '"' || quote === "'"

        if (isQuoted) {
            // 如果属性值被引号阔起来了
            // 消费引号
            advanceBy(1)
            // 获取下一个引号的位置
            const endQuoteIndex = context.source.indexOf(quote)
            if (endQuoteIndex > -1) {
                // 如果能够找到下一个引号
                // 令value等于两个引号之间的字符串
                value = context.source.slice(0, endQuoteIndex)
                // 消费属性值
                advanceBy(value.length)
                // 消费引号
                advanceBy(1)
            } else {
                // 缺少引号错误
                console.error("缺少引号" + context.source)
            }
        } else {
            // 属性没有被引号括起来，说明是一个变量
            // 下一个空格之前的值就是变量名
            const match = /^[^\t\r\n\f >]+/.exec(context.source)
            if (!match) {
                console.error('没有找到属性值' + context.source)
            } else {
                value = match[0]
                // 消费变量
                advanceBy(value.length)
            }
        }
        // 消费属性之后的空格
        advanceSpaces()

        // 压入props数组
        props.push({
            type: "Attribute",
            name,
            value
        })
    }

    return props
}

function parseText(context: ParseCtx) {
    let endIndex = context.source.length
    const ltIndex = context.source.indexOf('<')
    const delimiterIndex = context.source.indexOf('{{')

    if (ltIndex > -1 && ltIndex < endIndex) {
        endIndex = ltIndex
    }
    if (delimiterIndex > -1 && delimiterIndex < endIndex) {
        endIndex = delimiterIndex
    }

    // 到endIndex为止都是文本内容
    const content = context.source.slice(0, endIndex)

    if (!content) {
        return null
    }
    // 消费文本
    context.advanceBy(content.length)

    return {
        type: 'Text',
        content: content
    }
}

function parseInterpolation(context: ParseCtx): TemplateAstNode {
    context.advanceBy('{{'.length)
    const closeIndex = context.source.indexOf('}}')
    if (closeIndex < 0) {
        console.error("缺少插值结束界定符")
    }
    // 开始符到结束符之间的内容提取出来
    const content = context.source.slice(0, closeIndex)
    // 消费表达式内容
    context.advanceBy(content.length)
    context.advanceBy("}}".length)

    return {
        type: 'Interpolation',
        content: {
            type: 'Expression',
            content: content
        }
    }

}

function parseComment(context: ParseCtx) {
    context.advanceBy('<!--'.length)
    const closeIndex = context.source.indexOf('-->')
    if (closeIndex < 0) {
        console.error('缺少注释结束界定符')
    }
    // 获取注释内容
    const content = context.source.slice(0, closeIndex)
    context.advanceBy(content.length)
    context.advanceBy('-->'.length)
    return {
        type: 'Comment',
        content
    }
}

function parseCDATA(context: ParseCtx, ancestors: Ancestor[]) {
    return {
        type: 'Text',
        content: 'CDATA未完成！'
    }
}