interface AstNode {
    type: string,
    children?: AstNode[],
    tag?: string,
    content?: string
}