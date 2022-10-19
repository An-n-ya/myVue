import {ref, effect} from "./reactivity.js"


function shouldSetAsProps(el: HTMLElement, key: string, value: any) {
    // 对一些属性做特殊处理

    // input 的 form 属性是只读的
    if (key === "form" && el.tagName === "INPUT") return false

    return key in el
}

function normalizeClass(input: any) {
    let ret = []
    if (Array.isArray(input)) {
        for (const ele of input) {
            console.log(ele)
            if (typeof ele === 'string') {
                ret.push(ele)
            } else if (typeof ele === 'object') {
                for (const key in ele) {
                    if (ele[key]) {
                        ret.push(key)
                    }
                }
            }
        }
    } else if (typeof input === 'object') {
        for (const key in input) {
            if (input[key]) {
                ret.push(key)
            }
        }
    }
    return ret.join(" ")
}

function createRenderer(options: CreateRendererOptions) {
    // 通过options得到控制 node 的操作
    // 用以跨平台
    const {
        createElement,
        insert,
        setElementText,
        patchProps,
        unmount
    } = options
    function patch(n1: vnode | undefined | null, n2: vnode, container: HTMLElement) {
        if (!n1) {
            // 如果n1 不存在，意味着挂载
            mountElement(n2, container)
        } else {
            // 如果n1不存在，意味着打补丁
        }
    }

    function mountElement(vnode: vnode, container: HTMLElement) {
        // 创建 DOM 元素
        // 把真实 dom 元素和 vnode 关联起来
        const el = vnode.el = createElement(vnode.type)
        if (typeof vnode.children === "string") {
            // 如果 vnode 的子节点是字符串，代表元素只有文本节点
            // 直接设置textContent就好
            // el.textContent = vnode.children
            setElementText(el, vnode.children)
        } else if (Array.isArray(vnode.children)) {
            // 递归处理每个子元素
            vnode.children.forEach(child => {
                patch(null, child, el)
            })
        }
        // 处理props
        if (vnode.props) {
            for(const key in vnode.props) {
                patchProps(el, key, null, vnode.props[key])
            }
        }
        // 在容器中添加元素
        insert(el, container)
    }

    function render(vnode: vnode | null | undefined, container: HTMLElement | null) {
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
                unmount(container._vnode)
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
    },
    patchProps(el: HTMLElement, key: string, prevValue: any, nextValue: any) {
        // 用 shouldSetAsProps 帮助函数确认 key 是否存在于对应的DOM Properties
        if (key === "class") {
            el.className = nextValue || ''
        }else if (shouldSetAsProps(el, key, nextValue)) {
            const type = typeof el[key]
            // 如果类型是布尔 并且 值是空字符串，则设置为true
            if (type === "boolean" && nextValue === "") {
                el[key] = true
            } else {
                // 否则直接把value赋值给el对应的属性
                el[key] = nextValue
            }
        } else {
            // 如果没有对应的 DOM Properties（比如class -- className）
            // 使用setAttribute设置
            el.setAttribute(key, nextValue)
        }

    },
    unmount(vnode: vnode) {
        // 将unmount独立出来
        // 这里将来可以添加相关的生命周期函数
        if(!vnode.el) return
        const parent = vnode.el.parentNode
        if (parent) {
            parent.removeChild(vnode.el)
        }
    }
})


function propsTest() {
    const vnode = {
        type: "div",
        props: {
            id: 'foo'
        },
        children: [
            {
                type: "p",
                children: "hello"
            }
        ]
    }
    helpTest(vnode)
}

function helpTest(vnode: vnode | null, id = "app") {
    effect(() => {
        renderer(vnode, document.getElementById(id))
    })
}

function classTest() {
    const vnode1 = {
        type: "p",
        props: {
            class: "foo bar"
        },
    }

    const cls = {tee: true, pee: false}
    const vnode2 = {
        type: "p",
        props: {
            class: normalizeClass(cls)
        }
    }

    const arr = [
        "gee yuu",
        { sww: true }
    ]
    const vnode3 = {
        type: "p",
        props: {
            class: normalizeClass(arr)
        }
    }

    helpTest(vnode1)
    helpTest(vnode2, "app2")
    helpTest(vnode3, "app3")
}

function unmountTest() {
    const vnode1 = {
        type: "p",
        children: "你应该看不到我才对"
    }

    helpTest(vnode1)
    helpTest(null)
}

;(function test() {
    // propsTest()
    // classTest()
    unmountTest()
})()


const count = ref(1)
count.value = 2

