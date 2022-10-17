import { ref, effect } from "./reactivity.js";
function createRenderer() {
    function patch(n1, n2, container) {
        if (!n1) {
            // 如果n1 不存在，意味着挂载
            mountElement(n2, container);
        }
        else {
            // 如果n1不存在，意味着打补丁
        }
    }
    function mountElement(vnode, container) {
        // 创建 DOM 元素
        const el = document.createElement(vnode.type);
        if (typeof vnode.children === "string") {
            // 如果 vnode 的子节点是字符串，代表元素只有文本节点
            // 直接设置textContent就好
            el.textContent = vnode.children;
        }
        // 在容器中添加元素
        container.appendChild(el);
    }
    function render(vnode, container) {
        if (!container) {
            // 如果container不存在，直接返回
            return;
        }
        // 如果vnode存在
        if (vnode) {
            // 对新老vnode做patch
            patch(container._vnode, vnode, container);
        }
        else {
            // 如果vnode不存在，说明是卸载操作
            // 如果老vnode存在，就让内部html清空
            if (container._vnode) {
                container.innerHTML = "";
            }
        }
        // 把当前vnode赋值给_vnode, 作为老vnode
        container._vnode = vnode;
    }
    return render;
}
const renderer = createRenderer();
const count = ref(1);
const vnode = {
    type: "h1",
    children: String(count.value)
};
effect(() => {
    renderer(vnode, document.getElementById("app"));
});
count.value = 2;
