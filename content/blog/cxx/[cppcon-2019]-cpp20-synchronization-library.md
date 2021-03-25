---
title: [cppcon 2019] cpp20-synchronization-library
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



