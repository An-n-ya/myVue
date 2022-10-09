// 用来存储副作用函数的容器
// 使用weakMap作用容器
var bucket = new WeakMap();
// 响应式数据
var data = { text: "hello world!" };
var obj = new Proxy(data, {
    get: function (target, p, receiver) {
        if (!activeEffect) {
            // 如果没有activeEffect，直接返回
            return;
        }
        // 根据target从容器中取出 depsMap
        // depsMap 中根据对象属性索引副作用函数
        var depsMap = bucket.get(target);
        if (!depsMap) {
            bucket.set(target, (depsMap = new Map()));
        }
        // 由 p 取出depsMap中保存的副作用函数集合
        var deps = depsMap.get(p);
        // 如果deps不存在，就新建
        if (!deps) {
            depsMap.set(p, (deps = new Set()));
        }
        // 添加activeEffect到桶里
        deps.add(activeEffect);
        // 返回p索引的值
        return target[p];
    },
    set: function (target, p, value, receiver) {
        target[p] = value;
        // 取出depsMap
        var depsMap = bucket.get(target);
        if (!depsMap)
            return;
        // 根据key取出相应的副作用函数们
        var effects = depsMap.get(p);
        // 短路
        effects && effects.forEach(function (fn) {
            fn();
        });
        return true;
    }
});
// 用全局变量存储注册的effect函数
var activeEffect;
function effect(fn) {
    activeEffect = fn;
    fn();
}
effect(function () {
    var node = document.querySelector("#app");
    node.textContent = obj.text;
});
setTimeout(function () {
    obj.text = "hello again!";
}, 1000);
