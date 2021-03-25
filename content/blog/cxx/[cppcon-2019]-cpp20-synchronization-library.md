---
title: 「cppcon 2019」cpp20-synchronization-library
date: 2021-03-25 17:03:49
category: cxx
thumbnail: { thumbnailSrc }
draft: false
---

[视频地址](https://www.youtube.com/watch?v=Zcqwb3CWqs4)
[Slides](https://github.com/CppCon/CppCon2019/blob/master/Presentations/cpp20_synchronization_library/cpp20_synchronization_library__r2__bryce_adelstein_lelbach__cppcon_2019.pdf)  

<!-- separate -->

大致介绍了新增的四种同步设施  
- `std::atomic::wait` 和 `std::atomic::notify_*` 
- `std::atomic_ref` 对非 `atomic` 对象的方便地应用 `std::atomic` 操作
- `std::counting_semaphore`
- `std::latch` 和 `std::barrier` 线程同步设施

### `jthread`

1. `j` 代表 `joinable`（也是提案 P0660 的作者之一的名字首字母）
2. 析构的时候如果 `joinable`，会 `join()` 而不是 `terminate`
3. `invocable` 可以接受 `std::stop_token` 作为第一个参数
    - `std::stop_source` 类似于 `promise`
    - `std::stop_token` 类似于 `future`
        - A stop_token object is not generally constructed independently, but rather retrieved from a std::jthread or std::stop_source. This makes it share the same associated stop-state as the std::jthread or std::stop_source.
    - `std::stop_callback` 类似于 `future::then`
        - 要绑定到 `stop_token` 上

### 自旋锁

1. 使用 `std::atomic_flag` 实现

Naive 的版本：

```cpp
struct spin_mutex {
    std::atomic_flag flag = ATOMIC_FLAG_INIT;

    void lock() {
        while (flag.test_and_set(std::memory_order::acquire))
            ;
    }

    void unlock() {
        flag.clear(std::memory_order::release);
    }
};
```

浪费效率。考虑改进：记录自旋次数，然后根据不同的次数做不同的操作。

```cpp
void lock() {
    for (unit64_t i = 0; flag.test_and_set(std::memory_order::acquire); ++i) {
        if (i < 4) ;
        else if (i < 16) // do_nop
        else if (i < 64) // yield
        else //do_sleep
    }
}
```

C++20: 在 `atomic` 上的等待操作

```cpp
void lock() {
    while (flag.test_and_set(std::memory_order::acquire))
        flag.wait(true, std::memory_order_relaxed);
}

void unlock() {
    flag.clear(std::memory_order::release);
    flag.notify_one();
}
```

`wait` 和 `notify` 都有啥实现策略呢？

- Futex: Fast Userspace Mutex
    - 这玩意儿在 Windows 下有类似的实现是 `WaitOnAddress`
    - [Futex vs WaitOnAddress](https://devblogs.microsoft.com/oldnewthing/20170601-00/?p=96265)

- Condition Variables

- Spin Lock

原来的 Slides 上还放了几个方法，但是没找到相关的资料
- Contention Table
- Timed back-off


#### Ticket lock

自旋锁的一种

两个 `atomic`，类似于排队叫号的设计

防止一个线程进入 `lock` 的时候被另一个线程抢先（插队）

```cpp
struct ticket_mutex {
    std::atomic<int> in = ATOMIC_VAR_INIT(0);
    std::atomic<int> out = ATOMIC_VAR_INIT(0);

    void lock() {
        auto const my = in.fetch_add(1, std::memory_order::acquire);
        while (true) {
            auto const now = out.load(std::memory_order::acquire);
            if (my == now) break;
            out.wait(now, std::memory_order::relaxed);
        }
    }

    void unlock() {
        out.fetch_add(1, std::memory_order::release);
        out.notify_all();
    }
};
```

**False Sharing**

`in` 和 `out` 可能会被放到一个 `Cache Line` 中。两个相互独立的原子变量都会导致 Cache 的重新装载

解决方案：
```cpp
alignas(std::hardware_destructive_interference_size)
std::atomic<int> in = ATOMIC_VAR_INIT(0);
```

`std::hardware_constructive_interference_size` 是保证 `True sharing` 的最大上限，
`std::hardware_destructive_interference_size` 是保证 `False sharing` 的最小下限。


### `std::latch` vs `std::barrier`

`latch` 有门闩的意思，实际上很形象：大致作用就是让所有线程们遇到它就阻塞，同时等待某个事件

* Supports asynchronous arrival

考虑这样的一个场景，假设有一个任务队列
```cpp
template <size_t QueueDepth>
struct bounded_depth_task_manager {

    void process_tasks(std::stop_token s) {
        while (!s.stop_requested())
            tasks.deque().operator()();
        // 如果最后一个任务在线程 A deque 之前被线程 B 取走了
        // 那么线程 A 就阻塞到 tasks 中等待，但是这个时候队列是空的
        // 我们需要把它从这个循环中拿出来

        // 确保队列在 `request_stop` 后是空的
        while (true) {
            if (auto task = tasks.try_deque())  std::move(*task)();
            else break;
        }
    }
    ~bounded_depth_task_manager() {
        std::latch l(threads.size() + 1); // 线程数 + 主线程
        // 确保每个线程取到一次这个任务，然后在上面等待
        for (int i : std::views::iota(0, threads.size()))
            tasks.submit([&] { l.arrive_and_wait(); }); 
        threads.request_stop();
        l.count_down();         // 如果所有线程都阻塞在这个任务上了，那么现在的计数值就是 1
        // 主线程释放掉这个，那么所有的线程就可以继续运行，之后正常退出
        // 相当于让所有线程都在等待一件事情
    }
};
```

`std::latch` 是一次性的，也就是它的计数值是不能增加的。
`std::barrier` 就不是一次性的。它拥有多个阶段 (phases)，每个阶段在线程计数值到 0 后调用回调；之后重新将计数值调整到构造函数指定的值。
