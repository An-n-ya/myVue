var bucket = new Set();
var data = { text: "hello world!" };
var obj = new Proxy(data, {
    get: function (target, p, receiver) {
        bucket.add(effect);
        return target[p];
    },
    set: function (target, p, value, receiver) {
        target[p] = value;
        bucket.forEach(function (fn) {
            fn();
        });
        return true;
    }
});
function effect() {
    var node = document.querySelector("#app");
    node.textContent = obj.text;
    // window.document.body.innerHTML = obj.text
}
effect();
setTimeout(function () {
    obj.text = "hello again!";
}, 1000);
