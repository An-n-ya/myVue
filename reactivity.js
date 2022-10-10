// 用来存储副作用函数的容器
// 使用weakMap作用容器
// 这里使用weakMap的原因是，在被代理对象引用失效后，不持续引用， 方便垃圾回收
var bucket = new WeakMap();
// 用全局变量存储注册的effect函数
var activeEffect;
// 使用一个栈存放effect函数
var effectStack = [];
// 响应式数据
var data = { ok: true, text: "hello world!", val: 1, foo: 2 };
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
    effectsToRun && effectsToRun.forEach(function (effectFn) {
        if (effectFn.options.scheduler) {
            // 如果有调度函数
            // 把effectFn控制权交给定义调度函数的用户
            effectFn.options.scheduler(effectFn);
        }
        else {
            effectFn();
        }
    });
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
        deps.delete(effectFn);
    }
    effectFn.deps.length = 0;
}
// 实现watch
function watch(source, cb) {
    // 用来支持为函数的source
    var getter;
    if (typeof source == 'function') {
        getter = source;
    }
    else {
        getter = function () { return traverse(source); };
    }
    // 定义旧值和新值
    var oldValue, newValue;
    var effectFn = effect(
    // 调用traverse函数递归读取source
    function () { return getter(); }, {
        lazy: true,
        scheduler: function () {
            // 在 scheduler 中重新执行副作用函数，得到的是新值
            newValue = effectFn();
            // 调用回调函数
            cb(newValue, oldValue);
            // 更新旧值
            oldValue = newValue;
        }
    });
    // 手动调用副作用函数，拿到旧值
    oldValue = effectFn();
}
function traverse(value, seen) {
    if (seen === void 0) { seen = new Set(); }
    // *终止条件* 如果要读取的数据不是对象，或者已经被读取了
    if (typeof value != 'object' || value === null || seen.has(value))
        return;
    // 将数据加入seen
    seen.add(value);
    for (var k in value) {
        traverse(value[k], seen);
    }
    return value;
}
// 实现computed  计算属性
function computed(getter) {
    // value 用来缓存上一次计算的值
    var value;
    // 用来标识是否需要重新计算
    var dirty = true;
    // 把 getter 作为副作用函数，创建一个lazy的effect
    var effectFn = effect(getter, { lazy: true, scheduler: function () {
            // 在改变的时候重置dirty
            dirty = true;
            // 当计算属性依赖的响应式数据变化时，手动调用trigger
            trigger(obj, 'value');
        } });
    var obj = {
        get value() {
            // 只有在dirty状态下需要重新计算
            if (dirty) {
                // 在读取value时，调用effectFn
                value = effectFn();
                dirty = false;
            }
            // 当读取value时，手动调用track函数跟踪依赖
            track(obj, 'value');
            return value;
        }
    };
    return obj;
}
function effect(fn, options) {
    if (options === void 0) { options = {}; }
    var effectFn = function () {
        // 当effectFn执行时， 将其设置为activeEffect
        cleanup(effectFn);
        activeEffect = effectFn;
        // 在调用副作用函数之前，把activeEffect入栈
        effectStack.push(activeEffect);
        // 把结果保存下来返回
        var res = fn();
        // 副作用函数执行完后，弹出
        effectStack.pop();
        // 还原activeEffect
        activeEffect = effectStack[effectStack.length - 1];
        return res;
    };
    // 将options添加到effectFn上
    effectFn.options = options;
    // activeEffect.deps 用来存放与该副作用函数相关联的依赖
    // 依赖在track函数中收集
    effectFn.deps = [];
    // 只有在非lazy是运行
    if (!options.lazy) {
        effectFn();
    }
    return effectFn;
}
function test() {
    // test_basic()
    // test_branch()
    // test_recursion()
    // test_stackoverflow()
    // test_scheduler()
    // test_lazy()
    // test_computed()
    // test_computed_with_recursion()
    test_watch();
}
// 测试watch
function test_watch() {
    watch(obj, function () {
        console.log("obj变啦！");
    });
    obj.val++;
    // watch也可以处理函数
    watch(function () { return obj.foo; }, function () { return console.log("obj.foo变啦！"); });
    // 下面这个会同时触发两个watch
    obj.foo++;
    // 这个只会触发一个
    obj.val++;
    watch(function () { return obj.val; }, function (nv, ov) {
        console.log("\u65B0\u503C\u662F" + nv + ", \u65E7\u503C\u662F" + ov);
    });
    obj.val++;
}
// 测试涉及嵌套的计算函数
function test_computed_with_recursion() {
    var res = computed(function () {
        console.log("缓存结果，只有在值改变的时候你能看到我");
        return obj.val + obj.foo;
    });
    effect(function () {
        console.log(res.value);
    });
    // 应该会触发上面的effect，输出4
    obj.val++;
}
// 测试计算函数
function test_computed() {
    var res = computed(function () {
        console.log("缓存结果，只有在值改变的时候你能看到我");
        return obj.val + obj.foo;
    });
    console.log(res.value);
    console.log(res.value);
    console.log(res.value);
    obj.val++;
    console.log(res.value);
}
// 测试lazy
function test_lazy() {
    var effectFn = effect(function () {
        console.log(obj.val);
    }, {
        lazy: true
    });
    // 这是已经不能执行副作用函数了
    obj.val++;
    // 需要手动调用
    effectFn();
}
// 测试调度执行
function test_scheduler() {
    // console.log("=====before=====")
    // effect(() => {
    //     console.log(obj.val)
    // })
    // obj.val++
    // console.log("over")
    // console.log("===============")
    console.log("=====after=====");
    effect(function () {
        console.log(obj.val);
    }, {
        scheduler: function (fn) {
            // 将fn放到宏任务执行
            setTimeout(fn);
        }
    });
    obj.val++;
    console.log("over");
    console.log("===============");
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
