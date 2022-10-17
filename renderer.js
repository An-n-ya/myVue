import { ref, effect } from "./reactivity.js";
function renderer(domString, container) {
    container.innerHTML = domString;
}
const count = ref(1);
effect(() => {
    renderer(`<h1>${count.value}</h1>`, document.getElementById("app"));
});
console.log(count);
count.value = 2;
