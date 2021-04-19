---
title: 「cppcon-2019」A Unifying Abstraction for Async in C++
date: 2021-04-19 22:04:00
category: cxx
thumbnail: { thumbnailSrc }
draft: false
---

[视频地址](https://www.youtube.com/watch?v=tF-Nz4aRWAM)
[Slides](https://github.com/CppCon/CppCon2019/blob/master/Presentations/a_unifying_abstraction_for_async_in_cpp/a_unifying_abstraction_for_async_in_cpp__eric_niebler_david_s_hollman__cppcon_2019.pdf)

<!-- separate -->

1. Parallelism vs Concurrency

Parallelism: 多个并行执行的任务，之间没有内部的依赖关系。Schedular 可以自由调度线程之间的执行  
Concurrency: 多个逻辑线程，之间有**未知的**依赖关系。调度器不一定能够知道完整的这些依赖关系。
```cpp
std::atomic<int> x = 0;
// Worker A
while (x.load() == 0);
printf("Hello");

// Worker B
x.store(1);
```

调度器没有义务保证任务 A 一定要输出 `Hello`（可以一直选择调度 A 而忽略 B）。除非满足 *Concurrent forward progress guarantee*


Parallelism 给调度器提供了更多的自由度；而 Concurrency 给了用户提供了更多的自由度.  

Concurrency 拥有比串行执行更强的调度保证 (Scheduling guarantee).  

使用 "Concurrency" 模拟 "Parallelism" 的时候，其实是有额外的开销的。

C++ 17 引入了 parallel 算法，它们的速度就比使用线程池或者线程快。原因就在于它们直接让用户告诉调度器，这些任务之间的依赖在哪里。换句话说，它们把整个任务的依赖关系图告诉了调度器。但是当你用 concurrency 的技术的时候，即使这些任务没有依赖关系，调度器也会假定这些任务之间存在依赖，以引入不必要的开销。

2. Senders and Recievers

### "`std::promise/future` 就是慢!"

```cpp
std::future<int> async_algo() {
    std::promise<int> p;
    auto f = p.get_future();
    std::thread t {
        [p = std::move(p)] () mutable {
            int ans = // something
            p.set_value(ans);
        }
    };
    t.detach();
    return f;
}

int main() {
    auto f = async_algo();
    auto f2 = f.then([] (int i) {
        return i + rand();
    });
    printf("%d\n", f2.get());
}
```
`promise` 和 `future` 包含什么？
- `value`
- `continuation`
- `mutex`
- `cond var`
- `ref count`
这里，`p.set_value` 和 `f.then` 引入了不必要的同步开销。

我们可以把 `then` 移到 `async_algo` 里（向 `async_algo` 传递一个 `continuation`），或者泛化一下……

延迟启动 `async work`，在启动任务之前让 `caller` 把 `continuation` 添加到 `async work` 中。

### Lazy Future

```cpp
auto async_algo() {
    // It is a lazy future
    return [] (auto promise) {
        std::thread t {
            [p = std::move(promise)] () mutable {
                int ans = //...
                p.set_value(ans);
            }
        };
        t.detach();
    };
}

int main() {
    auto f = async_algo();
    auto f2 = then(f, [] (int i) {
        return i + rand();
    });
    // ...
}
```

怎么实现 `then` 呢？

```cpp
auto then(auto task, auto fun) {
    // return a lazy future
    return [] (auto p) {
        struct promise {
            decltype(p) p_;
            decltype(fun) func_;
            void set_value(auto ...vals) { p_.set_value(func_(vals...)); }
            void set_exception(auto e) { p_.set_exception(e); }
        };
        task(promise{p, fun});
    };
}
```

但是这样子我们只是简单地把任务组装在了一起，我们还需要做一个同步等待……

### Blocking
```cpp
template <class T, class Task>
T sync_wait(Task task) {
    struct _state {
        mutex mtx;
        condition_variable cv;
        variant<monostate, exception_ptr, T> data;
    };

    struct final_promise {
        _state<T>* pst;

        template<int I> void _set(auto ...xs) {
            auto lk = std::unique_lock {pst->mtx};
            pst->data.template emplace<I>(xs...);
            pst->cv.notify_one();
        }

        void set_value(auto... val) { _set<2>(val...); }
        void set_exception(auto e) { _set<1>(e); }

    };

    // state
    _state<T> state;
    // launch the task
    task(final_promise<T> {&state});

    {
        auto lk = std::unique_lock {state.mtx};
        state.cv.wait(lk, [&state] {
            return state.data.index() != 0;
        });
    }
    // Handle the exception...
    if (state.data.index() == 1) 
        std::rethrow_exception(get<1>(state.data));
    return get<2>(state.data);
}
```
