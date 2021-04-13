---
title: 「cppcon-2018」 RVO-harder-than-it-looks
date: 2021-04-13 22:04:51
category: cxx
thumbnail: { thumbnailSrc }
draft: false
---

[视频地址](https://www.youtube.com/watch?v=hA1WNtNyNbo&ab_channel=CppCon)
[Slides](https://github.com/CppCon/CppCon2018/blob/master/Presentations/return_value_optimization_harder_than_it_looks/return_value_optimization_harder_than_it_looks__arthur_odwyer__cppcon_2018.pdf)

<!-- separate -->

1. Return slot

`x86-64` 的调用约定中，对于某些返回值不能塞入寄存器（往往是 `rax`）中的情形，编译器会额外地添加一个隐式参数（`return slot address`），用于传递一个指向返回值的地址（往往是 `rdi`）。

调用方拥有 `return slot`

```cpp
struct S {
    S(S&&);
};
auto foo(bool cond) {
    S x = ...
    S y = ...
    return std::move(cond ? x : y);
}
```

注意到这里由于没有办法立刻知道返回的结果，所以不能直接把对象构造到 `return slot` 中。

2. 复制消除

C++17 强制要求

什么时候不能？
```cpp
auto foo(int x, S y) {
    return y;
}
```
不知道 `y` 的实际位置，所以没办法直接把 `y` 给 `return slot`。以此类推，
```cpp
static S x;
auto foo() { return x; }
```

也无法进行复制消除。（我们不知道 `x` 实际存放在哪里）

继承……？
如果子类比父类的 `size` 大
```cpp
struct SS : S {
    double member;
};

S foo() {
    SS something = ...;
    return something;
}
```

同样也不会进行 RVO

3. 隐式移动 (Implicitly move)

[CWG 1579](https://wg21.cmeerw.net/cwg/issue1579)，做了一些修正.

优先把对象当成“右值”，根据重载决议选择移动构造函数。如果重载决议失败了，或者说重载决议选择的构造函数的第一个参数**不是一个指向该对象的右值引用（可以有 cv 限定）**，那么就再把它当成“左值”再去进行一次重载决议。

目前的[([class.copy.elison]/3)](http://eel.is/c++draft/class.copy.elision#3)是，如果 `return` 语句中的表达式是 `id-expression`，并且这个表达式指代的对象在函数体或者参数中，并且可以被移动，那么就优先考虑移动操作。


所以如果是继承的对象的话，即使有移动构造函数，但是如果不是完全匹配的话，那么仍然不会进行隐式移动。

这个提案被加进去的原因之一是因为 `std::unique_ptr`，
```cpp
std::unique_ptr<ConfigManager> create() {
    auto p = std::make_unique<ConfigManagerImpl>();
    return p;
}
```
这里面就不需要 `conversion operators`，只需要有一个接受右值引用的构造函数(`converting constructors`)就行了。

还是他的一篇博文：
https://quuxplusone.github.io/blog/2021/03/07/copy-elision-borks-escape-analysis/

