// 用来存储副作用函数的容器
// 使用weakMap作用容器
// 这里使用weakMap的原因是，在被代理对象引用失效后，不持续引用， 方便垃圾回收
var bucket = new WeakMap();
// 用全局变量存储注册的effect函数
var activeEffect;
// 使用一个栈存放effect函数
var effectStack = [];
// 响应式数据
var data = { ok: true, text: "hello world!", val: 1 };
function track(target, key) {
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
    var deps = depsMap.get(key);
    // 如果deps不存在，就新建
    if (!deps) {
        depsMap.set(key, (deps = new Set()));
    }
    // 添加activeEffect到桶里
    deps.add(activeEffect);
    // 这里的deps就是与当前副作用函数存在联系的依赖集合
    // 将deps添加到 activeEffect.deps 中去
    activeEffect.deps.push(deps);
}
function trigger(target, key) {
    // 取出depsMap
    var depsMap = bucket.get(target);
    if (!depsMap)
        return;
    // 根据key取出相应的副作用函数们
    var effects = depsMap.get(key);
    // 在临时容器中执行 防止无线循环
    var effectsToRun = new Set();
    effects && effects.forEach(function (effectFn) {
        // 如果trigger触发执行的副作用函数与当前正在执行的副作用函数相同，就不执行了, 防止栈溢出
        if (effectFn != activeEffect) {
            effectsToRun.add(effectFn);
        }
    });
    effectsToRun && effectsToRun.forEach(function (effectFn) { return effectFn(); });
}
var obj = new Proxy(data, {
    get: function (target, p, receiver) {
        track(target, p);
        // 返回p索引的值
        return target[p];
    },
    set: function (target, p, value, receiver) {
        target[p] = value;
        trigger(target, p);
        return true;
    }
});
function cleanup(effectFn) {
    for (var i = 0; i < effectFn.deps.length; i++) {
        // 将effectFn从它的依赖集合中删除
        var deps = effectFn.deps[i];
        deps["delete"](effectFn);
    }
    effectFn.deps.length = 0;
}
function effect(fn) {
    var effectFn = function () {
        // 当effectFn执行时， 将其设置为activeEffect
        cleanup(effectFn);
        activeEffect = effectFn;
        // 在调用副作用函数之前，把activeEffect入栈
        effectStack.push(activeEffect);
        fn();
        // 副作用函数执行完后，弹出
        effectStack.pop();
        // 还原activeEffect
        activeEffect = effectStack[effectStack.length - 1];
    };
    // activeEffect.deps 用来存放与该副作用函数相关联的依赖
    // 依赖在track函数中收集
    effectFn.deps = [];
    effectFn();
}
function test() {
    // test_basic()
    // test_branch()
    // test_recursion()
    test_stackoverflow();
}
// 避免无线递归，栈溢出
function test_stackoverflow() {
    effect(function () {
        // 下面这个操作既有读 又有写，会导致无限递归
        obj.val++;
    });
    console.log(obj.val);
}
// 嵌套测试
function test_recursion() {
    var tmp1, tmp2;
    effect(function () {
        console.log("外层执行");
        effect(function () {
            console.log("内层执行");
            tmp2 = obj.ok;
        });
        tmp1 = obj.text;
    });
    // 理想情况应该是：
    // 外层执行
    // 内层执行
    // 外层执行
    // 内层执行
    obj.text = "haha";
}
// 分支测试
function test_branch() {
    effect(function () {
        console.log("你应该只看到我两次！");
        var node = document.querySelector("#app");
        node.textContent = obj.ok ? obj.text : 'not';
    });
    // 切换成false之后， text上的副作用函数应该取消监听
    obj.ok = false;
    // 改变这个将不会触发副作用函数
    obj.text = "hello";
}
// 基础测试
function test_basic() {
    effect(function () {
        var node = document.querySelector("#app");
        node.textContent = "hello world!";
    });
    setTimeout(function () {
        obj.text = "hello again!";
    }, 1000);
}
test();
