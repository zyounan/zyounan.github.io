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

相对路径不能被用来指向其他包中的 `targets`。这个时候就必须用完整路径了。举一个例子，例如代码目录包含包$A$ `my/app` 和包 $B$ `my/app/testdata` 。包 $B$ 包含有 `testdepot.zip` 这个文件。那么
`testdata/testdepot.zip` 这样的写法不行、但是 `//my/app/testdata:testdepot.zip` 这样的写法是可以的。

以 `@//` 打头的标签指向的是主仓库(从外部仓库的视角来看也是这样的!) 因此 `@//a/b/c` 和 `//a/b/c` 是不一样的。


#### `Labels` 的命名规则


- 目标名, `//...:target-name`

1. 规则的名字就是 `BUILD` 文件中 `name` 的值
2. 文件的名字就是相对于包含 `BUILD` 文件的路径名
3. 允许使用的符号 ``!%-@^_` "#$&'()*-+,;<=>?[]{|}~/.`` 以及 `[0-9A-Za-z]`
4. 如果要指代其他的包，请不要使用 `..` 这样的符号。使用 `//packagename:filename`。路径名必须是相对的，但是 `..` 和 `./` 和用 `/` 作为路径的开头和结尾这样的作法是被禁止的。当然多次出现的 `//` 也是不被允许的(为啥捏？因为 `target` 名有可能含有 `.`)

- 包名, `//package-name:...`

1. 包含 `BUILD` 文件的目录名就是包名，例如 `my/app`。注意包名中不能含有 `/`
2. 不能含有 `//`，不能以 `/` 结尾


#### 规则

给个样例看一下，
```txt
cc_binary(
    name = "my_app",
    srcs = ["my_app.cc"],
    deps = [
        "//absl/base",
        "//absl/strings",
    ],
)
```

- `srcs` 属性 [ `labels` 的一个列表]

- `outs` 属性 [ `output labels` 的一个列表]
    - 不能含有包的部分

#### BUILD 文件

`BUILD` 文件使用的命令式语言是 `Starlark` 。虽然说注意顺序是必要的，但是大部分的情形下，`BUILD` 文件仅仅包含*构建规则* 的声明，并且这些声明的先后顺序是无关紧要的。当一个构建规则函数，例如 `cc_library` 被执行的时候，它在 *依赖图* 中创建一个新的 *目标*。这个目标之后可以被通过 *标签* 引用。所以仅仅更改声明顺序是没有关系的。

`BUILD` 文件中不能包含函数的定义，`for` 语句或者 `if` 语句。但是 `list comprehensions` 和 `if` 表达式是 OK 的。函数在 `.bzl` 文件中声明，另外 `*args` 和 `**kwargs` 不被允许出现在 `BUILD` 文件中，只能显式地全部列出来。

不能在 `Starlark` 中随意使用 `IO`。

编码只能使用 `ASCII`。（连 `utf-8` 都不支持的吗！）


#### 加载插件

插件是以 `.bzl` 结尾的文件。

```txt
load("//foo/bar:file.bzl", "some_library")
```

这段代码将会加载 `foo/bar/file.bzl` 并且把符号 `some_library` 添加到环境中。可以用来加载规则、字符串、函数、常量。注意 `load` 接受可变参数用来添加多个符号；实参必须是**字符串字面量**，不能是变量。不能把 `load` 放到函数里，只能放到顶层。语句中的相对标签应该使用 `:` 作为起始。`load` 也支持别名。把这些规则缝合到一起看一下，


```txt
load(":my_rules.bzl", "some_rule", nice_alias = "some_other_rule")
```

注意 `.bzl` 文件中， 以下划线开头的符号不会被导出、并且不能被其他的导入。目前也不需要使用 `exports_files` 让某个符号可见。

#### 构建规则的类型

不同语言使用的构建语句成组出现。例如，对于 C++ ，`cc_binary`, `cc_library`, `cc_test` 对应可执行、库、测试。Java 的前缀是 `java_*` 。当然你自己创建一些新的规则也是可以的，

- `*_binary` 规则使用给定的语言构造可执行程序。执行构建后，对应名字的可执行文件将会出现在当前规则标签的输出树中。例如 `//my:program` 将会出现在 `$(BINDIR)/my/program`

- `*_library`

- `*_test`

#### 依赖

依赖图是 **DAG**. 直接依赖、传递依赖

##### 实际和声明的依赖

目标 $X$ 实际依赖目标 $Y$ 当且仅当 $Y$ 存在，并且是最新版本时才可正确构建目标 $X$。

目标 $X$ 声明依赖目标 $Y$ 当且仅当在包 $X$ 中有一条从 $X$ 到 $Y$ 的依赖边。

要求所有的实际依赖必须在声明依赖中出现。不过过多的声明依赖让构造速度减慢。

在构建目标 $X$ 的时候，构建工具检查 $X$ 依赖的传递闭包，确保这些目标的所有更改都能影响最终的结果，如果需要的话，重新构建中间件。

考虑这样的一个问题，

一开始，事情很美好。
```txt
# In file a/BUILD

rule(
    name = "a",
    srcs = "a.in",
    deps = "//b:b",
)
```

```txt
# In file b/BUILD

rule(
    name = "b",
    srcs = "b.in",
    deps = "//c:c",
)
```

```js
// a/a.in
import b;
b.foo();

```

```js
// b/b.in
import c;

function foo() {
    c.bar();
}

```

之后我们在 `a.in` 中引入一点东西，

```diff
import b;
+ import c;

b.foo();
+ c.garply();
```
但是这个时候我们没有在 `a/BUILD` 中引入对 `c` 的 `deps`。换句话说，这个时候的 *声明引用* 是这样的，  

![](https://docs.bazel.build/versions/master/images/a_b_c.svg)

与此同时 *实际引用* 是这样的，  

![](https://docs.bazel.build/versions/master/images/a_b_c_ac.svg)

这两个图的传递闭包是一样的，所以构造的时候应该没什么问题——但是这个时候，有个人重构了 `b` , `b` 不再依赖 `c` 了：
```txt
# In file b/BUILD
rule(
    name = "b",
    srcs = "b.in",
    deps = "//d:d",
)
```

```js
// b/b.in
import d;
function foo() {
    d.baz();
}
```

*声明引用* 现在变成了这个样子，
![](https://docs.bazel.build/versions/master/images/ab_c.svg),

*实际引用* 是这样的，
![](https://docs.bazel.build/versions/master/images/a_b_a_c.svg),

你发现 *实际引用* 中的这条边 `a --> c` 并未在 *声明引用* 中出现 —— 这就会让构建出现问题。

##### 依赖的类型

大部分的构造规则拥有三种的依赖类型：`srcs`, `deps`, `data`。

- `srcs` 依赖

直接被规则使用或者输出源文件的构建规则

- `deps` 依赖

指向被独立构建模块的规则。这些独立构建的模块提供头文件、符号、库……

- `data` 依赖

例如单元测试中使用的数据文件。

##### 使用标签指代目录


### 命令

- `bazel build path/to/srcs:target` 
- `bazel run path/to/srcs:target`
- `bazel test path/to/srcs:target`
- `bazel clean`


如果 `target` 是 `all`，那么就是构建当前目录下的所有东西。例如 `bazel build src:all`; 但是如果要构建 `workspace` 下面的所有目标，可以使用 `...` 这样的模式。


### 引入其他语言

`WORKSPACE` 可以 `load` 一些东西……

自带的先引进来
```starlark
load("@bazel_tools//tools/build_defs/repo:http.bzl", "http_archive")
# 类似的还有 git_repostiory
load("@bazel_tools//tools/build_defs/repo:git.bzl", "git_repository")
```

然后你就可以引入外部的规则啦! 引入的东西下载到 `bazel-<workspace_name>/external/` 下面。
引入一个 `Golang` 的试一下，首先先下载，
```bazel
http_archive(
    name = "io_bazel_rules_go",
    urls = ["https://github.com/bazelbuild/rules_go/releases/download/v0.26.0/rules_go-v0.26.0.tar.gz"],
)
```
之后这个规则对应的仓库名就叫 `io_bazel_rules_go`，初始化一下，
```bazel
load("@io_bazel_rules_go//go:deps.bzl", "go_register_toolchains", "go_rules_dependencies")

go_rules_dependencies()

go_register_toolchains(
    version = "host",
)
```

好了，现在可以在 `BUILD` 下面写规则了

```bazel
load("@io_bazel_rules_go//go:def.bzl", "go_binary")
go_binary(
    name = "hello_world_go",
    srcs = ["hello_world.go"],
)
```

引入 `Rust`，参考 https://bazelbuild.github.io/rules_rust/  

```bazel
http_archive(
    name = "rules_rust",
    sha256 = "e6d835ee673f388aa5b62dc23d82db8fc76497e93fa47d8a4afe97abaf09b10d",
    strip_prefix = "rules_rust-f37b9d6a552e9412285e627f30cb124e709f4f7a",
    urls = [
        # Master branch as of 2021-01-27
        "https://github.com/bazelbuild/rules_rust/archive/f37b9d6a552e9412285e627f30cb124e709f4f7a.tar.gz",
    ],
)

load("@rules_rust//rust:repositories.bzl", "rust_repositories")

rust_repositories()
```
之后是 `BUILD`，

```bazel
rust_binary(
    name = "hello_world_rust",
    srcs = ["hello_world.rs"],
)
```

### 引入 Protobuf 依赖

以 C++ 为例。首先在 `WORKSPACE` 中引入 `proto` 依赖，

```bazel
load("@bazel_tools//tools/build_defs/repo:git.bzl", "git_repository")

git_repository(
    name = "rules_proto",
    remote = "https://github.com/bazelbuild/rules_proto.git",
    commit = "f7a30f6f80006b591fa7c437fe5a951eb10bcbcf",
    verbose = True,
)

load("@rules_proto//proto:repositories.bzl", "rules_proto_dependencies", "rules_proto_toolchains")

rules_proto_dependencies()

rules_proto_toolchains()
```

这里不用 `http_archive` 的原因是官方文档给的 `README` 过于久远没有更新，所以和新版的 `Bazel` 有不兼容的地方... 

接着我们在 `src` 下面写一个 `proto`, 

```protobuf
syntax = "proto3";

package transmission_object;

message TransmissionObject {
    float value = 1;
    string message = 2;
}
```

保存为 `transmission_object.proto`。接着写 `BUILD` 文件，

```bazel
load("@rules_proto//proto:defs.bzl", "proto_library")

proto_library(
    name = "transmission_object_proto",
    srcs = ["transmission_object.proto"],
)

cc_proto_library(
    name = "transmission_object_cxx_proto",
    deps = [":transmission_object_proto"],
)
```

`bazel` 将会根据这个生成 C++ 对应的 `protobuf` 头文件和代码。我们写一个测试程序，
```cpp
#include <iostream>
#include <string>
#include "src/transmission_object.pb.h"

int main() {
    std::ios_base::sync_with_stdio(false);
    GOOGLE_PROTOBUF_VERIFY_VERSION;
    float value;
    std::string message;
    std::cin >> value >> message;

    transmission_object::TransmissionObject obj;
    obj.set_message(message);
    obj.set_value(value);

    std::cout << obj.DebugString() << std::endl;
    return 0;
}
```

接着在 `BUILD` 中加入 `cc_binary`，
```bazel
cc_binary(
    name = "proto_cxx_test",
    srcs = [
        "run.cc",
    ],
    deps = [":transmission_object_cxx_proto"],
)
```

就可以愉快地构建啦！ `bazel run src:proto_cxx_test`  

注意 `cc` 中包含 `transmission_object.pb.h` 的方式。`bazel` 默认将 `proto` 生成在 `bazel-bin/src/` 下面。

```bash
# bazel run src:proto_cxx_test
INFO: Analyzed target //src:proto_cxx_test (0 packages loaded, 0 targets configured).
INFO: Found 1 target...
Target //src:proto_cxx_test up-to-date:
  bazel-bin/src/proto_cxx_test.exe
INFO: Elapsed time: 0.207s, Critical Path: 0.01s
INFO: 1 process: 1 internal.
INFO: Build completed successfully, 1 total action
INFO: Build completed successfully, 1 total action
2.7182818 Hello,protobuf
value: 2.71828175
message: "Hello,protobuf"
```

想用 GCC 的话可以先查询一下目前有的工具链， 
```shell
bazel query @local_config_cc//:toolchain --output=build
```

`MinGW-w64` 对应的名字是 `mingw-gcc`

```bazel
# Hardcoded toolchain, legacy behaviour.
cc_toolchain_suite(
    name = "toolchain",
    toolchains = {
        "armeabi-v7a|compiler": ":cc-compiler-armeabi-v7a",
        "x64_windows|msvc-cl": ":cc-compiler-x64_windows",
        "x64_x86_windows|msvc-cl": ":cc-compiler-x64_x86_windows",
        "x64_arm_windows|msvc-cl": ":cc-compiler-x64_arm_windows",
        "x64_arm64_windows|msvc-cl": ":cc-compiler-x64_arm64_windows",
        "x64_windows|msys-gcc": ":cc-compiler-x64_windows_msys",
        "x64_windows|mingw-gcc": ":cc-compiler-x64_windows_mingw",
        "x64_windows|clang-cl": ":cc-compiler-x64_windows-clang-cl",
        "x64_windows_msys": ":cc-compiler-x64_windows_msys",
        "x64_windows": ":cc-compiler-x64_windows",
        "x64_x86_windows": ":cc-compiler-x64_x86_windows",
        "x64_arm_windows": ":cc-compiler-x64_arm_windows",
        "x64_arm64_windows": ":cc-compiler-x64_arm64_windows",
        "armeabi-v7a": ":cc-compiler-armeabi-v7a",
    },
)
```

运行 `bazel build src:proto_cxx_test --compiler="mingw-gcc"` 即可。

当然你也可以在 `.bazelrc` 中强行钦点。
