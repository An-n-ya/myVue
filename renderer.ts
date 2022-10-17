import {ref, effect} from "./reactivity.js"

function createRenderer(options: CreateRendererOptions) {
    // 通过options得到控制 node 的操作
    // 用以跨平台
    const {
        createElement,
        insert,
        setElementText
    } = options
    function patch(n1: vnode | undefined, n2: vnode, container: HTMLElement) {
        if (!n1) {
            // 如果n1 不存在，意味着挂载
            mountElement(n2, container)
        } else {
            // 如果n1不存在，意味着打补丁
        }
    }

    function mountElement(vnode: vnode, container: HTMLElement) {
        // 创建 DOM 元素
        const el = createElement(vnode.type)
        if (typeof vnode.children === "string") {
            // 如果 vnode 的子节点是字符串，代表元素只有文本节点
            // 直接设置textContent就好
            // el.textContent = vnode.children
            setElementText(el, vnode.children)
        }
        // 在容器中添加元素
        insert(el, container)
    }

    function render(vnode: vnode, container: HTMLElement | null) {
        if(!container) {
            // 如果container不存在，直接返回
            return
        }
        // 如果vnode存在
        if (vnode) {
            // 对新老vnode做patch
            patch(container._vnode, vnode, container)
        } else {
            // 如果vnode不存在，说明是卸载操作
            // 如果老vnode存在，就让内部html清空
            if (container._vnode) {
                container.innerHTML = ""
            }
        }
        // 把当前vnode赋值给_vnode, 作为老vnode
        container._vnode = vnode
    }

    return render
}

const renderer = createRenderer({
    createElement(tag: string) {
        return document.createElement(tag)
    },
    setElementText(el: HTMLElement, text: string) {
        el.textContent = text
    },
    insert(el: HTMLElement, parent: HTMLElement, anchor: Node | null = null) {
        parent.insertBefore(el, anchor)
    }
})

const count = ref(1)

const vnode = {
    type: "h1",
    children: String(count.value)
}

effect(() => {
    renderer(vnode, document.getElementById("app"))
})

count.value = 2

