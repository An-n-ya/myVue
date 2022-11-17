export {parse}
const TextModes = {
    'DATA':'DATA',
    'RCDATA':'RCDATA',
    'RAWTEXT':'RAWTEXT',
    'CDATA':'CDATA'
}

/**
 * parse入口函数
 * @param str
 */
function parse(str: string) {
    // 定义上下文结构
    const context:ParseCtx = {
        source: str,
        mode: TextModes.CDATA
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
    const {mode, source} = context

    // 开启while循环对context的字符串持续解析
    while (!isEnd(context, ancestors)) {
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
                    console.error("无效的结束标签")
                    continue
                } else if (/a-z/i.test(source[1])) {
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
    if (!context.source) return true
    // 取得父标签节点
    const parent = ancestors[ancestors.length - 1]
    // 如果遇到结束标签，并且与父标签节点同名，则停止
    if (parent && context.source.startsWith(`</${parent.tag}`)) return true

    return false

}

function parseElement(context: ParseCtx, ancestors: Ancestor[]) {

}