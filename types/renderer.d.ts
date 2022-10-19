interface HTMLElement {
    _vnode?: vnode
}

interface vnode {
    type: string,
    children: any
}

interface CreateRendererOptions {
    createElement(tag: string),
    setElementText(el: any, text: string),
    insert(el: any, parent: any, anchor: any = null)
}