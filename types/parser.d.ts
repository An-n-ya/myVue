interface TemplateAstNode {
    type: string,
    children?: TemplateAstNode[],
    tag?: string,
    content?: string,
    jsNode?: JSASTNode
}

type TransformFn = (ast: TemplateAstNode, context: TraverseCtx) => Fn | void

interface TraverseCtx {
    currentNode: TemplateAstNode | null,
    childIndex: number,
    parent: TemplateAstNode | null,
    replaceNode(node: TemplateAstNode),
    removeNode(node: TemplateAstNode),
    nodeTransforms?: TransformFn[]
}

enum JSASTType {
    'FunctionDecl'='FunctionDecl',
    'CallExpression'='CallExpression',
    'StringLiteral'='StringLiteral',
    'ArrayExpression'='ArrayExpression',
}

enum StatementType {
    'ReturnStatement'='ReturnStatement'
}

interface Statement {
    type: StatementType
}

interface ReturnStatement extends Statement{
    return?: JSASTNode
}

interface JSASTNode {
    type: JSASTType, // 节点类型
}

interface FunctionASTNode extends JSASTNode {
    id: {
        type: string,
        name: string
    },
    params: any[], // 参数
    body: Statement[]
}

interface Literal {

}

interface CallExpressionNode extends JSASTNode, Literal {
    callee: {
        type: string,
        name: string
    },
    arguments: Literal[]
}

interface StringLiteral extends JSASTNode, Literal {
    value: string
}

interface ArrayLiteral extends JSASTNode, Literal {
    elements: Literal[]
}