interface HTMLElement extends Record<string, any>{
    _vnode?: vnode
}

interface vnode {
    type: string,
    children: any,
    // 使用Record限制对象的键名
    props: Record<string, string>
}

interface CreateRendererOptions {
    createElement(tag: string),
    setElementText(el: any, text: string),
    insert(el: any, parent: any, anchor: any = null),
    patchProps(el: any, key: any, prevValue: any, nextValue: any)
}