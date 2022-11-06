import { ref, effect } from "./reactivity.js";
function shouldSetAsProps(el, key, value) {
    // 对一些属性做特殊处理
    // input 的 form 属性是只读的
    if (key === "form" && el.tagName === "INPUT")
        return false;
    return key in el;
}
function normalizeClass(input) {
    let ret = [];
    if (Array.isArray(input)) {
        for (const ele of input) {
            console.log(ele);
            if (typeof ele === 'string') {
                ret.push(ele);
            }
            else if (typeof ele === 'object') {
                for (const key in ele) {
                    if (ele[key]) {
                        ret.push(key);
                    }
                }
            }
        }
    }
    else if (typeof input === 'object') {
        for (const key in input) {
            if (input[key]) {
                ret.push(key);
            }
        }
    }
    return ret.join(" ");
}
function createRenderer(options) {
    // 通过options得到控制 node 的操作
    // 用以跨平台
    const { createElement, insert, setElementText, patchProps, unmount } = options;
    function patch(n1, n2, container, anchor = null) {
        if (!n1) {
            // 如果n1 不存在，意味着挂载
            mountElement(n2, container, anchor);
        }
        else if (n1 && n1.type !== n2.type) {
            // 如果n1存在， 并且n1的类型和n2的类型不一致，则直接卸载n1
            unmount(n1);
            n1 = null;
        }
        else if (n1 && n1.type === n2.type) {
            // 如果n1存在， 并且n1的类型和n2的类型一致，则需要根据n2的type打补丁
            const { type } = n2;
            if (typeof type === "string") {
                // DONE: patchElement(n1, n2)
                patchElement(n1, n2);
            }
            else if (typeof type === 'object') {
                // 如果n2.type是对象，则描述的是组件
            }
        }
    }
    function patchElement(n1, n2) {
        console.log(n1, n2);
        // n1的el赋值给n2 (这个赋值操作，就是所谓的复用DOM了)
        const el = n2.el = n1.el;
        const oldProps = n1.props || {};
        const newProps = n2.props || {};
        // 先更新 props
        for (const key in newProps) {
            if (newProps[key] !== oldProps[key]) {
                patchProps(el, key, oldProps[key], newProps[key]);
            }
        }
        for (const key in oldProps) {
            if (!(key in newProps)) {
                patchProps(el, key, oldProps[key], null);
            }
        }
        if (el) {
            // 再更新 children
            patchChildren(n1, n2, el);
        }
    }
    // 暴力diff算法，先卸载全部旧节点，再挂载新节点 (不能复用DOM节点，需要反复卸载与挂载)
    function bruteDiff(oldChildren, newChildren, container) {
        oldChildren.forEach(c => unmount(c));
        newChildren.forEach(c => patch(null, c, container));
    }
    // 最简单的diff算法 复杂度为O(n2)
    function simpleDiff(oldChildren, newChildren, container) {
        var _a, _b, _c;
        // 维护寻找过程中最大的索引
        // 如果当前索引小于lastIndex，就说明需要调换位置
        let lastIndex = 0;
        for (let i = 0; i < newChildren.length; i++) {
            const newVnode = newChildren[i];
            // 如果在oldChildren找到了newVnode的key，说明可以复用，find为true，否则为false
            let find = false;
            for (let j = 0; j < oldChildren.length; j++) {
                const oldVnode = oldChildren[j];
                if (newVnode.key === oldVnode.key) {
                    // 将find值true
                    find = true;
                    // 如果key相同，即可以复用
                    patch(oldVnode, newVnode, container);
                    if (j < lastIndex) {
                        // 这里进行移动操作
                        // 先获取前一个vnode
                        const prevNode = newChildren[i - 1];
                        // 如果prevNode不存在，说明是第一个节点，不需要移动
                        if (prevNode) {
                            // 将当前节点移动到上一个节点的后面
                            const anchor = (_a = prevNode.el) === null || _a === void 0 ? void 0 : _a.nextSibling;
                            console.log('anchor', anchor);
                            insert(newVnode.el, container, anchor);
                        }
                    }
                    else {
                        // 如果j比较大, 则更新lastIndex
                        lastIndex = j;
                    }
                    break;
                }
            }
            if (!find) {
                // 如果在oldChildren中没有找到，说明当前newVnode是新增的节点
                const prevVNode = newChildren[i - 1];
                let anchor = null;
                if (prevVNode) {
                    // 如果有prevVnode，就用nextSibling作为锚点
                    anchor = ((_b = prevVNode.el) === null || _b === void 0 ? void 0 : _b.nextSibling) == undefined ? null : (_c = prevVNode.el) === null || _c === void 0 ? void 0 : _c.nextSibling;
                }
                else {
                    // 如果没有prevVnode，说明是第一个节点，则使用容器的第一个元素作为锚点
                    anchor = container.firstChild;
                }
                patch(null, newVnode, container, anchor);
            }
        }
        // 进行卸载操作
        for (let i = 0; i < oldChildren.length; i++) {
            const oldVnode = oldChildren[i];
            const has = newChildren.find(vnode => vnode.key === oldVnode.key);
            if (!has) {
                // 如果没有找到，就需要删除
                unmount(oldVnode);
            }
        }
    }
    function patchChildren(n1, n2, container) {
        // 先判断新节点是字符串的情况
        if (typeof n2.children === "string") {
            // 旧节点有三种可能: null 文本子节点 组子节点
            // 只有在旧节点是一组子节点的时候，需要逐个卸载，其他情况什么都不用做
            if (Array.isArray(n1.children)) {
                n1.children.forEach((c) => unmount(c));
            }
            // 最后将新节点(string)设置给容器
            setElementText(container, n2.children);
        }
        else if (Array.isArray(n2.children)) {
            // 如果新节点是一组节点
            if (Array.isArray(n1.children)) {
                // 如果旧节点也是一组节点，需要用到diff算法
                // Done: diff算法
                simpleDiff(n1.children, n2.children, container);
                // bruteDiff(n1.children, n2.children, container)
            }
            else {
                // 旧子节点要么是string要么为空
                // 无论那种情况只需要清空容器，再逐个挂载即可
                setElementText(container, "");
                n2.children.forEach(c => patch(null, c, container, null));
            }
        }
        else {
            // 运行到这里，说明新节点不存在
            if (Array.isArray(n1.children)) {
                // 逐个卸载旧子节点
                n1.children.forEach((c) => unmount(c));
            }
            else if (typeof n1.children === "string") {
                // 旧节点为字符，清空字符即可
                setElementText(container, "");
            }
            // 旧节点也没有子节点，啥都不做
        }
    }
    function mountElement(vnode, container, anchor) {
        // 创建 DOM 元素
        // 把真实 dom 元素和 vnode 关联起来
        const el = vnode.el = createElement(vnode.type);
        if (typeof vnode.children === "string") {
            // 如果 vnode 的子节点是字符串，代表元素只有文本节点
            // 直接设置textContent就好
            // el.textContent = vnode.children
            setElementText(el, vnode.children);
        }
        else if (Array.isArray(vnode.children)) {
            // 递归处理每个子元素
            vnode.children.forEach(child => {
                patch(null, child, el, anchor);
            });
        }
        // 处理props
        if (vnode.props) {
            for (const key in vnode.props) {
                patchProps(el, key, null, vnode.props[key]);
            }
        }
        // 在容器中添加元素
        insert(el, container, anchor);
    }
    function render(vnode, container) {
        if (!container) {
            // 如果container不存在，直接返回
            return;
        }
        // 如果vnode存在
        if (vnode) {
            // 对新老vnode做patch
            patch(container._vnode, vnode, container, null);
        }
        else {
            // 如果vnode不存在，说明是卸载操作
            // 如果老vnode存在，就让内部html清空
            if (container._vnode) {
                unmount(container._vnode);
            }
        }
        // 把当前vnode赋值给_vnode, 作为老vnode
        container._vnode = vnode;
    }
    return render;
}
let createCnt = 0; // 记录使用了多少次创建节点的dom操作
let removeCnt = 0; // 记录使用了多少次删除节点的dom操作
let moveCnt = 0;
const renderer = createRenderer({
    createElement(tag) {
        createCnt += 1;
        return document.createElement(tag);
    },
    setElementText(el, text) {
        el.textContent = text;
    },
    insert(el, parent, anchor = null) {
        moveCnt += 1;
        parent.insertBefore(el, anchor);
    },
    patchProps(el, key, prevValue, nextValue) {
        if (/^on/.test(key)) {
            // 如果是以on开头的，就说明是事件绑定
            const name = key.slice(2).toLowerCase();
            // 获取之前的事件处理函数集合
            let invokers = el._vei || (el._vei = {});
            // 获取key对应的处理函数
            let invoker = invokers[key];
            if (nextValue) {
                if (!invoker) {
                    // 如果之前没有invoker，就直接赋值
                    invoker = el._vei[key] = (e) => {
                        if (Array.isArray(invoker.value)) {
                            // @ts-ignore
                            invoker.value.forEach(fn => fn(e));
                        }
                        else {
                            invoker.value(e);
                        }
                    };
                    // 将真正的事件处理函数赋值给invoker的value
                    invoker.value = nextValue;
                    // 绑定事件
                    el.addEventListener(name, invoker);
                }
                else {
                    // 移出上一次绑定的时间处理函数
                    // DONE: 使用removeEventListener效率低下 考虑使用invoker包装事件
                    // 如果存在，就意味着更新，直接改invoker的value属性即可，不需要调用dom方法
                    // 性能更好
                    invoker.value = nextValue;
                }
            }
            else if (invoker) {
                // 如果nextValue也没有了，说明是注销事件处理函数
                el.removeEventListener(name, invoker);
            }
            prevValue && el.removeEventListener(name, prevValue);
        }
        // 用 shouldSetAsProps 帮助函数确认 key 是否存在于对应的DOM Properties
        else if (key === "class") {
            el.className = nextValue || '';
        }
        else if (shouldSetAsProps(el, key, nextValue)) {
            const type = typeof el[key];
            // 如果类型是布尔 并且 值是空字符串，则设置为true
            if (type === "boolean" && nextValue === "") {
                el[key] = true;
            }
            else {
                // 否则直接把value赋值给el对应的属性
                el[key] = nextValue;
            }
        }
        else {
            // 如果没有对应的 DOM Properties（比如class -- className）
            // 使用setAttribute设置
            el.setAttribute(key, nextValue);
        }
    },
    unmount(vnode) {
        // 将unmount独立出来
        // 这里将来可以添加相关的生命周期函数
        if (!vnode.el)
            return;
        const parent = vnode.el.parentNode;
        if (parent) {
            removeCnt += 1;
            parent.removeChild(vnode.el);
        }
    }
});
function propsTest() {
    const vnode = {
        type: "div",
        props: {
            id: 'foo'
        },
        key: '1',
        children: [
            {
                type: "p",
                children: "hello"
            }
        ]
    };
    helpTest(vnode);
}
function helpTest(vnode, id = "app") {
    effect(() => {
        renderer(vnode, document.getElementById(id));
    });
}
function classTest() {
    const vnode1 = {
        type: "p",
        key: '1',
        props: {
            class: "foo bar"
        },
    };
    const cls = { tee: true, pee: false };
    const vnode2 = {
        type: "p",
        key: '1',
        props: {
            class: normalizeClass(cls)
        }
    };
    const arr = [
        "gee yuu",
        { sww: true }
    ];
    const vnode3 = {
        type: "p",
        key: '1',
        props: {
            class: normalizeClass(arr)
        }
    };
    helpTest(vnode1);
    helpTest(vnode2, "app2");
    helpTest(vnode3, "app3");
}
function unmountTest() {
    const vnode1 = {
        type: "p",
        key: '1',
        children: "你应该看不到我才对"
    };
    helpTest(vnode1);
    helpTest(null);
}
function eventTest() {
    const vnode = {
        type: "button",
        key: '1',
        props: {
            onClick: [
                () => {
                    alert("world!");
                },
                () => {
                    alert("hello again!");
                }
            ]
        },
        children: "hello"
    };
    helpTest(vnode);
}
function baseTest() {
    const count = ref(1);
    console.log(count.value);
    effect(() => {
        const vnode = {
            type: "p",
            key: '1',
            children: `${count.value}`
        };
        helpTest(vnode);
    });
    count.value++;
}
function simpleDiffTest() {
    const oldVnode = {
        type: 'div',
        key: 'oldVnode',
        children: [
            { type: 'p', children: '1', key: 1 },
            { type: 'p', children: '2', key: 2 },
            { type: 'p', children: 'hello', key: 3 },
        ]
    };
    const newVnode = {
        type: 'div',
        key: 'newVnode',
        children: [
            { type: 'p', children: 'world', key: 3 },
            { type: 'p', children: 'world', key: 4 },
            { type: 'p', children: '2', key: 2 },
        ]
    };
    // 挂载
    helpTest(oldVnode);
    setTimeout(() => {
        helpTest(newVnode);
        // 统计信息
        console.log(`共使用了${createCnt}次创建dom操作，${removeCnt}次删除dom操作, ${moveCnt}次移动操作`);
    }, 1000);
}
;
(function test() {
    simpleDiffTest();
    // baseTest()
    // propsTest()
    // classTest()
    // unmountTest()
    // eventTest()
})();
const count = ref(1);
count.value = 2;
