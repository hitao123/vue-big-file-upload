# 本项目演示 大文件上传

> 通过本项目你可以了解到一个完整的大文件上传的过程，主要包含客户端分片上传，服务端合并分片，客户端实现暂停和恢复，以及秒传的功能

## 依赖安装

```bash
// 客户端依赖
cd client
npm i || yarn i

// 服务端依赖
cd ../server
npm i || yarn i
```

## 项目启动

```bash

// 客户端启动
npm run serve

// 服务端启动
npm run dev

```

测试的时候可以把网络设置慢一点

<img  src="./img/network.png" />

本文参考学习 https://segmentfault.com/a/1190000023619104
