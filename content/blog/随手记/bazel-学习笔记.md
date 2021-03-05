---
title: Bazel 学习笔记
date: 2021-03-05 14:03:74
category: 随手记
thumbnail: { thumbnailSrc }
draft: false
---

官方文档的大致整理 :)

<!-- separate -->

### 一些基本概念和名词

#### Workspace

拥有一个名为 `WORKSPACE` 文件的目录被称为 `workspace` 的根目录。根目录下的子目录如果拥有 `WORKSPACE` 则会被忽略。`WORKSPACE.bazel` 是别名，只不过优先级更高一些。

#### Repositories

包含 `WORKSPACE` 文件的目录是主仓库的根目录，也被缩写为 `@`。外部的仓库在 `WORKSPACE` 文件中定义。

#### Packages

仓库中代码组织的基本单位是 `package`。包里面包含文件/外部依赖。
包所在的目录应该包含一个名字是 `BUILD` 或者 `BUILD.bazel` 的文件。一个包包含了它的所有**除含有 `BUILD(.bazel)` 的**子目录。

#### Targets

所谓的 `package` （以下写成*包*）就是一个容器。包中的元素被称为 `targets`。`targets` 由**文件** 和 **规则** 组成，另外也有 `package groups`。

- 文件被分为两类。一种是代码文件，一种是构造工具（例如 `Qt Moc`）生成的文件

- 规则。处理输入，生成输出。规则的输出永远被看成生成的文件。规则的输入可能是代码文件，也可能包含其它的规则文件。


#### Labels

`Target` 的名字被称为 `label`（标签）。形式地来讲，

```txt
@myrepo//my/app/main:app_binary
```

1. 如果标签引用的 `target` 在同一个仓库下面，仓库名 `@myrepo` 可以省略。
2. 标签由两个部分组成。由 `//` 打头，包名 (`my/app/main`) 和目标名 (`app_binary`)。如果冒号被省略了，那么就认为目标名和包名的最后一个部分(例子中的 `main`) 一致。
3. 在一个 `BUILD` 规则中，以下形式是等价的
```txt
//my/app:app
//my/app
:app
app
```
4. `BUILD` 规则中可以使用相对（包目录的）路径指向文件。但是如果在别的地方，例如命令行中，有 `//my/app:generate.cc`。
