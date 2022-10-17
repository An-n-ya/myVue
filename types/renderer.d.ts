interface HTMLElement {
    _vnode?: vnode
}

interface vnode {
    type: string,
    children: string | vnode
}

interface CreateRendererOptions {
    createElement(tag: string),
    setElementText(el: any, text: string),
    insert(el: any, parent: any, anchor: any = null)
}