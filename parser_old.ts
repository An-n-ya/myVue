export {tokenize, parse, dump, transform, generate}
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
 * 将字符串切割为token
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

/**
 * 将字符串解析为template ast
 * @param str
 * @return template ast
 */
function parse(str: string) {


    // 先进行tokenize
    const tokens = tokenize(str)

    const root: TemplateAstNode = {
        type: 'Root',
        children: []
    }

    // element栈，起初只有Root节点
    const elementStack = [root]
    while (tokens.length) {
        // 栈顶元素为父元素
        const parent = elementStack[elementStack.length - 1]
        // 将组件加入父组件
        const t = tokens[0]
        switch(t.type) {
            case 'tag':
                const elementNode = {
                    type: 'Element',
                    tag: t.name,
                    children: []
                }
                if (!parent.children) {
                    console.error('父组件必须要有children')
                    return
                }
                parent.children.push(elementNode)
                elementStack.push(elementNode)
                break
            case 'text':
                const textNode = {
                    type: 'Text',
                    content: t.content
                }
                if (!parent.children) {
                    console.error('父组件必须要有children')
                    return
                }
                parent.children.push(textNode)
                break
            case 'tagEnd':
                // 遇到结束标签，弹出栈顶
                elementStack.pop()
                break
        }
        // 消费tokens
        tokens.shift()
    }
    return root
}

function dump(node: TemplateAstNode | undefined, indent = 0) {
    if (!node) {
        return ''
    }
    let res = ''
    const type = node.type
    const desc = node.type === 'Root'
        ? ''
        : node.type === 'Element'
            ? node.tag
            : node.content
    console.log(`${'-'.repeat(indent)}${type}: ${desc}`)
    res = res + `${'-'.repeat(indent)}${type}: ${desc}\n`

    if (node.children) {
        // 递归的打印子节点
        node.children.forEach(n => res += dump(n, indent + 2))
    }
    return res
}

function traverseNode(ast: TemplateAstNode | undefined, context: TraverseCtx) {
    if (!ast) return
    context.currentNode = ast
    // 退出阶段的回调函数数组
    const exitFns = []
    const currentNode = ast


    const transforms = context.nodeTransforms
    if (transforms) {
        for (let i = 0; i < transforms.length; i++) {
            // 转换函数的返回值作为退出阶段的回调函数
            const onExit = transforms[i](currentNode, context)
            if (onExit) {
                exitFns.push(onExit)
            }
            if (!context.currentNode) return
        }
    }

    const children = currentNode.children
    if (children) {
        for (let i = 0; i < children.length; i++) {
            context.parent = context.currentNode
            context.childIndex = i
            traverseNode(children[i], context)
        }
    }
    // console.log(exitFns)
    for (let i = 0; i < exitFns.length; i++) {
        exitFns[i]()
    }
}

/**
 * 将Template AST转化为JavaScript AST
 * @param ast
 * @return ast JavaScriptAST在ast的jsNode属性里
 */
function transform(ast: TemplateAstNode | undefined) {
    if(!ast) return
    const context: TraverseCtx = {
        currentNode: null,
        childIndex: 0,
        parent: null,
        nodeTransforms: [
            transformElement,
            transformText,
            transformRoot
        ],
        replaceNode(node: TemplateAstNode) {
            if (context.parent && context.parent.children) {
                context.parent.children[context.childIndex] = node
            }
            context.currentNode = node
        },
        removeNode(node: TemplateAstNode) {
            if (context.parent && context.parent.children) {
                context.parent.children.splice(context.childIndex, 1)
                context.currentNode = null
            }
        }
    }
    traverseNode(ast, context)
    return ast
}

function transformElement(node: TemplateAstNode, context: TraverseCtx) {
    // 返回一个回调函数，这个回调函数将在退出阶段调用
    return () => {
        if (node.type !== 'Element' || !node.tag) return
        // 创建h函数
        const callExp = createCallExpression('h', [
            createStringLiteral(node.tag)
        ])
        const ArrayElements: Literal[] = []
        // 处理h函数调用的参数
        if (node.children?.length === 1) {
            if (node.children && node.children[0].jsNode) {
                callExp.arguments.push(node.children[0].jsNode)
            }
        } else {
            if (node.children){
                callExp.arguments.push(
                    createArrayExpression(node.children.map(c => c.jsNode as Literal))
                )
            }
        }
        node.jsNode = callExp
    }
}

function transformText(node: TemplateAstNode, context: TraverseCtx) {
    // 创建文本jsAST
    if (node.type === 'Text' && node.content) {
        node.jsNode = createStringLiteral(node.content)
    }
}

function transformRoot(node: TemplateAstNode, context: TraverseCtx) {
    return () => {
        if (node.type !== 'Root' || !node.children) return
        const vnodeJSAST = node.children[0].jsNode
        node.jsNode = {
            type: "FunctionDecl",
            id: {
                type: 'Identifier',
                name: 'render'
            },
            params: [],
            body: [{ type: "ReturnStatement", return: vnodeJSAST } as ReturnStatement]
        } as FunctionASTNode
    }
}


// region 创建JavaScriptAST节点的帮助函数
function createStringLiteral(value: string): StringLiteral {
    return <StringLiteral>{
        type: "StringLiteral",
        value
    }
}

function createIdentifier(name: string) {
    return {
        type: 'Identifier',
        name
    }
}

function createArrayExpression(elements: Literal[]): ArrayLiteral {
    return <ArrayLiteral>{
        type: "ArrayExpression",
        elements
    }
}

function createCallExpression(callee: string, args: Literal[]): CallExpressionNode {
    return <CallExpressionNode>{
        type: "CallExpression",
        callee: createIdentifier(callee),
        arguments: args
    }
}

// endregion

/**
 * 根据JavaScript AST生成JS代码
 * @param node
 */
function generate(node: JSASTNode | undefined): string {
    const context: GenerateCtx = {
        code: '',
        push(code: string) {
            context.code += code
        },
        currentIndent: 0, // 当前缩进
        newline() {
            context.code += '\n' + " ".repeat(context.currentIndent)
        },
        indent() {
            context.currentIndent += 2
            context.newline()
        },
        deIndent() {
            context.currentIndent -= 2
            context.newline()
        }
    }

    if (!node) {
        return ''
    }

    genNode(node, context)

    return context.code
}

function genNode(node: JSASTNode, context: GenerateCtx) {
    switch (node.type) {
        case 'FunctionDecl':
            genFunctionDecl(node as FunctionASTNode, context)
            break
        case 'ReturnStatement':
            genReturnStatement(node as ReturnStatement, context)
            break
        case 'CallExpression':
            genCallExpression(node as CallExpressionNode, context)
            break
        case 'StringLiteral':
            genStringLiteral(node as StringLiteral, context)
            break
        case 'ArrayExpression':
            genArrayExpression(node as ArrayLiteral, context)
            break
    }
}


function genFunctionDecl(node: FunctionASTNode, context: GenerateCtx) {
    const { push, indent, deIndent } = context
    push(`function ${node.id.name}`)
    push('(')
    genNodeList(node.params, context)
    push(') ')
    push('{')
    indent()
    node.body.forEach(n => genNode(n, context))
    deIndent()
    push('}')
}

// 解析nodes数组 以逗号作为分隔符
function genNodeList(nodes: JSASTNode[], context: GenerateCtx) {
    const { push } = context
    for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i]
        genNode(node, context)
        if (i < nodes.length - 1) {
            push(', ')
        }
    }
}

function genArrayExpression(node: ArrayLiteral, context: GenerateCtx) {
    const {push} = context
    push('[')
    genNodeList(node.elements, context)
    push(']')
}

function genReturnStatement(node: ReturnStatement, context: GenerateCtx) {
    const {push} = context
    if (!node.return) {
        push('return')
    } else {
        push('return ')
        genNode(node.return, context)
    }
}

function genCallExpression(node: CallExpressionNode, context: GenerateCtx) {
    const {push} = context
    const {callee, arguments: args} = node
    push(`${callee.name}(`)
    genNodeList(args, context)
    push(')')
}

function genStringLiteral(node: StringLiteral, context: GenerateCtx) {
    const {push} = context
    push(`'${node.value}'`)
}

